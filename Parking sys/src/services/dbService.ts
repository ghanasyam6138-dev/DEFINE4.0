import { database } from '../config/firebase';
import { ref, get, set, update, onValue } from 'firebase/database';
import type {
  User,
  ParkingArea,
  ParkingLevel,
  Slot,
  Booking,
  Visit,
  BlockedCarIncident,
  StaffTask,
  AuditLogEntry,
  StaffShiftConfig
} from '../types';
import { createDemoSeedData, DEMO_MALL_ID } from './seedData';

type Listener = () => void;

interface DBState {
  users: Record<string, User>;
  parkingAreas: Record<string, ParkingArea>;
  slots: Record<string, Slot>;
  bookings: Record<string, Booking>;
  visits: Record<string, Visit>;
  incidents: Record<string, BlockedCarIncident>;
  tasks: Record<string, StaffTask>;
  auditLogs: Record<string, AuditLogEntry>;
  shifts: Record<string, StaffShiftConfig>;
}

type CollectionKey = keyof DBState;
type RecordMap = Record<string, unknown>;
type ShadowMap = Record<CollectionKey, Record<string, string>>;

const COLLECTIONS: CollectionKey[] = [
  'users',
  'parkingAreas',
  'slots',
  'bookings',
  'visits',
  'incidents',
  'tasks',
  'auditLogs',
  'shifts'
];

// Audit logs are append-only (see database.rules.json): never update or delete them.
const IMMUTABLE_COLLECTIONS = new Set<CollectionKey>(['auditLogs']);

const CACHE_KEY = 'parksmart_db_cache_v2';
const LEGACY_CACHE_KEY = 'parksmart_db_cache_v1';
const ROOT_PATH = 'parksmart';
const FLUSH_DEBOUNCE_MS = 250;
const INITIAL_LOAD_TIMEOUT_MS = 8000;
const MAX_PATHS_PER_UPDATE = 300;

const emptyState = (): DBState => ({
  users: {},
  parkingAreas: {},
  slots: {},
  bookings: {},
  visits: {},
  incidents: {},
  tasks: {},
  auditLogs: {},
  shifts: {}
});

const emptyShadow = (): ShadowMap => ({
  users: {},
  parkingAreas: {},
  slots: {},
  bookings: {},
  visits: {},
  incidents: {},
  tasks: {},
  auditLogs: {},
  shifts: {}
});

/**
 * Strip everything Firebase RTDB cannot store (undefined, null, NaN, empty
 * arrays/objects). The result is exactly what the server will hold, so it is
 * both the write payload and the basis for change detection.
 */
function clean(value: unknown): unknown {
  if (value === undefined || value === null || typeof value === 'function') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    const arr = value.map(clean).filter(v => v !== undefined);
    return arr.length > 0 ? arr : undefined;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const c = clean(v);
      if (c !== undefined) out[k] = c;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return value;
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    // Firebase may hand arrays back as index-keyed objects (and vice versa), so compare them the same way.
    const out: Record<string, unknown> = {};
    value.forEach((v, i) => { out[String(i)] = sortDeep(v); });
    return out;
  }
  if (value && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) out[k] = sortDeep(src[k]);
    return out;
  }
  return value;
}

/** Canonical, key-order-independent string used to compare records. */
function stable(value: unknown): string {
  const c = clean(value);
  return c === undefined ? '' : JSON.stringify(sortDeep(c));
}

/** Firebase drops empty arrays and may return arrays as objects; put them back. */
function asArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value.filter(v => v !== undefined && v !== null) as T[];
  if (value && typeof value === 'object') {
    const src = value as Record<string, T>;
    return Object.keys(src)
      .sort((a, b) => Number(a) - Number(b))
      .map(k => src[k]);
  }
  return [];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalizeRecord(collection: CollectionKey, raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  switch (collection) {
    case 'parkingAreas':
      return {
        ...raw,
        levels: asArray<any>(raw.levels).map(lvl => ({
          ...lvl,
          zones: asArray(lvl?.zones),
          elements: asArray(lvl?.elements)
        }))
      };
    case 'bookings':
      return { ...raw, servicesRequested: asArray(raw.servicesRequested) };
    case 'visits':
      return { ...raw, services: asArray(raw.services) };
    case 'incidents':
      return {
        ...raw,
        auditTrail: asArray(raw.auditTrail),
        stageTimestamps: raw.stageTimestamps || {}
      };
    case 'users':
      return raw.assignedParkingAreaIds !== undefined
        ? { ...raw, assignedParkingAreaIds: asArray(raw.assignedParkingAreaIds) }
        : raw;
    default:
      return raw;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function toRecordMap(collection: CollectionKey, raw: unknown): RecordMap {
  const out: RecordMap = {};
  if (!raw || typeof raw !== 'object') return out;
  const entries: [string, unknown][] = Array.isArray(raw)
    ? raw.map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(raw as Record<string, unknown>);
  for (const [id, rec] of entries) {
    if (rec && typeof rec === 'object') out[id] = normalizeRecord(collection, rec);
  }
  return out;
}

class DatabaseService {
  private state: DBState = emptyState();

  /**
   * "Shadow" = canonical form of every record as the server last told us (or
   * accepted from us). Anything in `state` that differs from the shadow is an
   * unsynced local change and gets written as a single-record update.
   */
  private shadow: ShadowMap = emptyShadow();

  /** Records currently being written: key `collection/id` -> shadow value before the write. */
  private inFlight: Map<string, string | undefined> = new Map();

  private listeners: Set<Listener> = new Set();
  private version = 0;
  private initPromise: Promise<void> | null = null;
  private isInitialized = false;
  private firebaseConnected = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private flushAgain = false;
  private realtimeAttached = false;

  public isFirebaseConnected(): boolean {
    return this.firebaseConnected;
  }

  /** Monotonic counter bumped on every change (local or remote). Used by useDbRevision(). */
  public getVersion(): number {
    return this.version;
  }

  constructor() {
    // LIVE-ONLY MODE: never hydrate DB state from localStorage.
    // All authoritative data comes from Firebase Realtime Database.
    this.clearLocalDbCaches();

    if (typeof window !== 'undefined') {
      // Push anything pending as soon as the connection or the tab comes back.
      window.addEventListener('online', () => this.requestFlush(0));
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') this.requestFlush(0);
        });
      }
    }
  }

  /** Remove any previous offline/local DB caches so the app cannot run on stale local data. */
  private clearLocalDbCaches(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(LEGACY_CACHE_KEY);
    } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  public initialize(): Promise<void> {
    if (!this.initPromise) this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Firebase initial load timed out')), ms);
      promise.then(
        v => { clearTimeout(timer); resolve(v); },
        e => { clearTimeout(timer); reject(e); }
      );
    });
  }

  private async doInitialize(): Promise<void> {
    // LIVE-ONLY: never restore from device localStorage. Firebase is the sole source of truth.
    this.state = emptyState();
    this.shadow = emptyShadow();
    this.clearLocalDbCaches();

    if (database) {
      let remoteChecked = false;
      try {
        const snapshot = await this.withTimeout(get(ref(database, ROOT_PATH)), INITIAL_LOAD_TIMEOUT_MS);
        remoteChecked = true;
        if (snapshot.exists()) {
          const data = snapshot.val() as Record<string, unknown>;
          COLLECTIONS.forEach(c => this.applyRemoteCollection(c, data?.[c]));
        } else {
          // Firebase is empty: seed demo data once, then push to the cloud.
          await this.seedInitialData();
        }
        this.firebaseConnected = true;
      } catch (err) {
        console.warn('Firebase RTDB connection check failed; will retry via realtime listeners.', err);
      }

      if (!remoteChecked && Object.keys(this.state.parkingAreas).length === 0) {
        // Still seed so the UI is usable; realtime listeners will overwrite when online.
        await this.seedInitialData();
      }

      // Always attach realtime listeners; the SDK delivers data as soon as it (re)connects.
      this.attachRealtimeListeners();
    } else if (Object.keys(this.state.parkingAreas).length === 0) {
      await this.seedInitialData();
    }

    this.isInitialized = true;
    this.notify();
    this.requestFlush(0);
  }

  private attachRealtimeListeners(): void {
    if (!database || this.realtimeAttached) return;
    this.realtimeAttached = true;

    COLLECTIONS.forEach(collection => {
      onValue(
        ref(database!, `${ROOT_PATH}/${collection}`),
        snap => {
          this.firebaseConnected = true;
          // Always merge + always notify so every connected client re-renders
          // when another device writes (slots, bookings, etc.).
          this.applyRemoteCollection(collection, snap.val());
          this.saveToCache();
          this.notify();
        },
        error => {
          this.firebaseConnected = false;
          console.error(`Firebase realtime listener failed for "${collection}":`, error.message);
        }
      );
    });

    onValue(ref(database, '.info/connected'), snap => {
      const connected = snap.val() === true;
      this.firebaseConnected = connected;
      if (connected) this.requestFlush(0);
    });
  }

  // ---------------------------------------------------------------------------
  // Local cache (state + shadow, so unsynced edits survive a reload)
  // ---------------------------------------------------------------------------

  private removeObsoleteDemoUsers<T extends Record<string, unknown>>(users: T): T {
    const cleaned: Record<string, unknown> = {};
    for (const [id, raw] of Object.entries(users || {})) {
      const user = raw as Partial<User> | undefined;
      const name = String(user?.name || '').toLowerCase();
      const mobile = String(user?.mobile || '').replace(/\D/g, '');
      const obsolete = name.includes('aditi') ||
        name.includes('temporary admin') ||
        name.includes('temp admin') ||
        mobile === '919999999999';
      if (!obsolete) cleaned[id] = raw;
    }
    return cleaned as T;
  }

  private saveToCache(): void {
    // LIVE-ONLY MODE: intentionally do not persist DB state to localStorage.
    // Firebase Realtime Database is the only durable store.
    return;
  }

  private async seedInitialData(): Promise<void> {
    const seed = await createDemoSeedData();

    seed.users.forEach(u => { this.state.users[u.id] = u; });
    seed.parkingAreas.forEach(p => { this.state.parkingAreas[p.id] = p; });
    seed.slots.forEach(s => { this.state.slots[s.id] = s; });
    seed.bookings.forEach(b => { this.state.bookings[b.id] = b; });
    seed.visits.forEach(v => { this.state.visits[v.id] = v; });
    seed.incidents.forEach(i => { this.state.incidents[i.id] = i; });
    seed.tasks.forEach(t => { this.state.tasks[t.id] = t; });

    // Initial audit entry
    const auditId = `aud-${Date.now()}`;
    this.state.auditLogs[auditId] = {
      id: auditId,
      timestamp: new Date().toISOString(),
      actorId: 'system',
      actorName: 'System Bootstrap',
      actorRole: 'platform_admin',
      action: 'SYSTEM_SEEDED',
      targetResource: 'System',
      details: 'Demo Mall and initial test users initialized'
    };

    // Push seed to Firebase immediately (live-only, no local persistence).
    this.notify();
    this.requestFlush(0);
  }

  // ---------------------------------------------------------------------------
  // Remote -> local (record-level merge, never a wholesale overwrite)
  // ---------------------------------------------------------------------------

  /**
   * Merge one collection from Firebase into local state.
   *  - untouched local records take the remote value
   *  - records with unsynced local edits keep the local value (and get re-written)
   *  - records deleted remotely are dropped (a missing collection means "all deleted")
   *  - records being written right now are left alone
   * Returns true when local state visibly changed.
   */
  private applyRemoteCollection(collection: CollectionKey, raw: unknown): boolean {
    let remote = toRecordMap(collection, raw);
    if (collection === 'users') remote = this.removeObsoleteDemoUsers(remote);

    const local = this.state[collection] as unknown as RecordMap;
    const oldShadow = this.shadow[collection];
    const nextLocal: RecordMap = {};
    const nextShadow: Record<string, string> = {};
    let changed = false;

    // Collections that must always mirror Firebase for multi-device live UI.
    const liveCollections = new Set<CollectionKey>([
      'slots', 'bookings', 'visits', 'incidents', 'tasks', 'auditLogs', 'shifts'
    ]);
    const isLive = liveCollections.has(collection);

    for (const [id, remoteRec] of Object.entries(remote)) {
      if (this.inFlight.has(`${collection}/${id}`)) {
        // Keep optimistic local only while the write is in flight.
        if (id in local) nextLocal[id] = local[id];
        if (id in oldShadow) nextShadow[id] = oldShadow[id];
        continue;
      }

      const remoteS = stable(remoteRec);
      nextShadow[id] = remoteS;

      if (id in local) {
        const localS = stable(local[id]);
        if (localS === remoteS) {
          nextLocal[id] = local[id];
        } else if (isLive) {
          // Always take remote for live collections (slots/bookings/etc.).
          nextLocal[id] = remoteRec;
          changed = true;
        } else {
          const base = oldShadow[id];
          const hasUnsyncedEdit = base !== undefined && localS !== base;
          if (hasUnsyncedEdit) {
            nextLocal[id] = local[id]; // optimistic local (users / parkingAreas) until flush
          } else {
            nextLocal[id] = remoteRec;
            changed = true;
          }
        }
      } else {
        // New remote record
        nextLocal[id] = remoteRec;
        changed = true;
      }
    }

    for (const [id, localRec] of Object.entries(local)) {
      if (id in remote) continue;

      if (this.inFlight.has(`${collection}/${id}`)) {
        nextLocal[id] = localRec;
        if (id in oldShadow) nextShadow[id] = oldShadow[id];
        continue;
      }

      if (isLive) {
        // Record deleted on another device — drop it.
        changed = true;
        continue;
      }

      const base = oldShadow[id];
      if (base === undefined || stable(localRec) !== base) {
        nextLocal[id] = localRec; // new local, will flush
      } else {
        changed = true; // removed remotely
      }
    }

    (this.state as unknown as Record<string, RecordMap>)[collection] = nextLocal;
    this.shadow[collection] = nextShadow;
    return changed;
  }

  // ---------------------------------------------------------------------------
  // Local -> remote (diff against the shadow, write only the records that changed)
  // ---------------------------------------------------------------------------

  private scheduleFirebaseSync(): void {
    this.saveToCache();
    this.notify();
    // Immediate flush so other devices see slot/booking changes without debounce delay.
    this.requestFlush(0);
  }

  private requestFlush(delay: number = FLUSH_DEBOUNCE_MS): void {
    if (!database) return;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush().catch(err => console.warn('Background Firebase sync failed:', err));
    }, delay);
  }

  private async flush(): Promise<void> {
    if (!database || !this.isInitialized) return;
    if (this.flushing) {
      this.flushAgain = true;
      return;
    }
    this.flushing = true;
    try {
      do {
        this.flushAgain = false;
        await this.flushOnce();
      } while (this.flushAgain);
    } finally {
      this.flushing = false;
    }
  }

  private async flushOnce(): Promise<void> {
    if (!database) return;

    const updates: Record<string, unknown> = {};

    for (const collection of COLLECTIONS) {
      const local = this.state[collection] as unknown as RecordMap;
      const shadow = this.shadow[collection];
      const immutable = IMMUTABLE_COLLECTIONS.has(collection);

      for (const [id, rec] of Object.entries(local)) {
        if (immutable && id in shadow) continue;
        const s = stable(rec);
        if (shadow[id] === s) continue;
        const payload = clean(rec);
        if (payload === undefined) continue;
        const key = `${collection}/${id}`;
        updates[key] = payload;
        this.inFlight.set(key, shadow[id]);
        shadow[id] = s;
      }

      if (!immutable) {
        for (const id of Object.keys(shadow)) {
          if (id in local) continue;
          const key = `${collection}/${id}`;
          updates[key] = null;
          this.inFlight.set(key, shadow[id]);
          delete shadow[id];
        }
      }
    }

    const paths = Object.keys(updates);
    if (paths.length === 0) return;

    const root = ref(database, ROOT_PATH);
    const failed: string[] = [];

    for (let i = 0; i < paths.length; i += MAX_PATHS_PER_UPDATE) {
      const chunkKeys = paths.slice(i, i + MAX_PATHS_PER_UPDATE);
      const chunk: Record<string, unknown> = {};
      chunkKeys.forEach(k => { chunk[k] = updates[k]; });
      try {
        await update(root, chunk);
      } catch (err) {
        // One bad record (rules/validation) must not block the rest: retry them one by one.
        console.warn('Batched Firebase write rejected, retrying record by record:', err);
        const results = await Promise.allSettled(
          chunkKeys.map(async k => set(ref(database!, `${ROOT_PATH}/${k}`), updates[k]))
        );
        results.forEach((r, idx) => {
          if (r.status === 'rejected') {
            failed.push(chunkKeys[idx]);
            console.error(`Firebase write failed for ${chunkKeys[idx]}:`, r.reason);
          }
        });
      }
    }

    // Writes that were refused go back to "unsynced" so a later flush retries them.
    failed.forEach(key => {
      const slash = key.indexOf('/');
      const c = key.slice(0, slash) as CollectionKey;
      const id = key.slice(slash + 1);
      const previous = this.inFlight.get(key);
      if (previous === undefined) delete this.shadow[c][id];
      else this.shadow[c][id] = previous;
    });
    paths.forEach(k => this.inFlight.delete(k));

    this.firebaseConnected = failed.length === 0;
    this.saveToCache();
    // Ensure subscribers refresh after writes settle (other tabs / same device pages).
    this.notify();
  }

  // ---------------------------------------------------------------------------
  // Subscriptions
  // ---------------------------------------------------------------------------

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.version++;
    this.listeners.forEach(fn => fn());
  }

  // --- Audit Log ---
  public addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    const id = `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const log: AuditLogEntry = {
      id,
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.state.auditLogs[id] = log;
    this.scheduleFirebaseSync();
  }

  public getAuditLogs(parkingAreaId?: string): AuditLogEntry[] {
    const all = Object.values(this.state.auditLogs);
    if (parkingAreaId) {
      return all.filter(l => !l.parkingAreaId || l.parkingAreaId === parkingAreaId)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
    return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  // --- Users & Auth ---
  public getUsers(): User[] {
    return Object.values(this.state.users);
  }

  public getUserById(id: string): User | undefined {
    return this.state.users[id];
  }

  public getUserByMobile(mobile: string): User | undefined {
    return Object.values(this.state.users).find(u => u.mobile === mobile);
  }

  public saveUser(user: User): void {
    this.state.users[user.id] = user;
    this.scheduleFirebaseSync();
  }

  // --- Parking Areas ---
  public getParkingAreas(includeDrafts = false, adminId?: string): ParkingArea[] {
    const all = Object.values(this.state.parkingAreas);
    if (includeDrafts) {
      if (adminId) {
        return all.filter(a => a.isPublished || a.ownerAdminId === adminId);
      }
      return all;
    }
    return all.filter(a => a.isPublished);
  }

  public getParkingAreaById(id: string): ParkingArea | undefined {
    return this.state.parkingAreas[id];
  }

  public saveParkingArea(area: ParkingArea): void {
    this.state.parkingAreas[area.id] = area;
    this.scheduleFirebaseSync();
  }

  public deleteParkingArea(id: string): boolean {
    if (!this.state.parkingAreas[id]) return false;
    delete this.state.parkingAreas[id];

    // Clean up slots belonging to this facility
    Object.keys(this.state.slots).forEach(slotId => {
      if (this.state.slots[slotId].parkingAreaId === id) {
        delete this.state.slots[slotId];
      }
    });

    this.saveToCache();
    this.scheduleFirebaseSync();
    this.notify();
    return true;
  }

  public deleteLevel(parkingAreaId: string, levelId: string): { success: boolean; error?: string } {
    const area = this.state.parkingAreas[parkingAreaId];
    if (!area) return { success: false, error: 'Parking area not found.' };

    const remainingLevels = area.levels.filter(lvl => lvl.id !== levelId);
    if (remainingLevels.length === 0) {
      // If deleting the only level, provide a fresh clean Level 1
      const defaultLvl: ParkingLevel = {
        id: `lvl-${Date.now()}-1`,
        name: 'Level 1 (Ground Floor)',
        levelNumber: 1,
        width: 800,
        height: 520,
        zones: [
          { id: 'zone-a', name: 'Zone A', color: '#9333ea', slotCount: 0 }
        ],
        elements: []
      };
      area.levels = [defaultLvl];
    } else {
      area.levels = remainingLevels;
    }

    // Clean up slots belonging to this level
    Object.keys(this.state.slots).forEach(slotId => {
      const slot = this.state.slots[slotId];
      if (slot.parkingAreaId === parkingAreaId && slot.levelId === levelId) {
        delete this.state.slots[slotId];
      }
    });

    area.updatedAt = new Date().toISOString();
    this.state.parkingAreas[parkingAreaId] = area;
    this.saveToCache();
    this.scheduleFirebaseSync();
    this.notify();
    return { success: true };
  }

  public clearLevel(parkingAreaId: string, levelId: string): void {
    const area = this.state.parkingAreas[parkingAreaId];
    if (!area) return;

    area.levels = area.levels.map(lvl => {
      if (lvl.id === levelId) {
        return { ...lvl, elements: [] };
      }
      return lvl;
    });

    // Delete all slots on this level
    Object.keys(this.state.slots).forEach(slotId => {
      const slot = this.state.slots[slotId];
      if (slot.parkingAreaId === parkingAreaId && slot.levelId === levelId) {
        delete this.state.slots[slotId];
      }
    });

    area.updatedAt = new Date().toISOString();
    this.state.parkingAreas[parkingAreaId] = area;
    this.saveToCache();
    this.scheduleFirebaseSync();
    this.notify();
  }

  // --- Slots ---
  public getSlots(parkingAreaId?: string, levelId?: string): Slot[] {
    let all = Object.values(this.state.slots);
    if (parkingAreaId) {
      all = all.filter(s => s.parkingAreaId === parkingAreaId);
    }
    if (levelId) {
      all = all.filter(s => s.levelId === levelId);
    }
    return all;
  }

  public getSlotById(id: string): Slot | undefined {
    return this.state.slots[id];
  }

  public saveSlot(slot: Slot): void {
    this.state.slots[slot.id] = slot;
    this.scheduleFirebaseSync();
  }

  public saveSlotsBatch(slots: Slot[]): void {
    slots.forEach(s => {
      this.state.slots[s.id] = s;
    });
    this.scheduleFirebaseSync();
  }

  public deleteSlot(slotId: string): void {
    delete this.state.slots[slotId];
    this.scheduleFirebaseSync();
  }

  // --- Bookings ---
  public getBookings(customerId?: string, parkingAreaId?: string): Booking[] {
    let all = Object.values(this.state.bookings);
    if (customerId) {
      all = all.filter(b => b.customerId === customerId);
    }
    if (parkingAreaId) {
      all = all.filter(b => b.parkingAreaId === parkingAreaId);
    }
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getBookingById(id: string): Booking | undefined {
    return this.state.bookings[id];
  }

  public getBookingByTicketToken(token: string): Booking | undefined {
    return Object.values(this.state.bookings).find(b => b.ticketToken === token);
  }

  public saveBooking(booking: Booking): void {
    this.state.bookings[booking.id] = booking;
    this.scheduleFirebaseSync();
  }

  // --- Atomic Slot Reservation (Double-booking prevention) ---
  public atomicReserveSlot(params: {
    slotId: string;
    bookingData: Omit<Booking, 'id' | 'createdAt' | 'updatedAt' | 'ticketToken' | 'bookingNumber' | 'status'>;
  }): { success: boolean; booking?: Booking; error?: string } {
    const slot = this.state.slots[params.slotId];
    if (!slot) {
      return { success: false, error: 'Selected slot does not exist.' };
    }

    if (slot.status !== 'available' || !slot.isBookable) {
      return { success: false, error: `Slot ${slot.number} is no longer available. Please select another slot.` };
    }

    // Check if slot has any conflicting active booking
    const activeBooking = Object.values(this.state.bookings).find(
      b => b.slotId === slot.id && (b.status === 'reserved' || b.status === 'active_inside')
    );
    if (activeBooking) {
      return { success: false, error: `Slot ${slot.number} is currently reserved or occupied.` };
    }

    // Check if same vehicle already has an active booking at the same time
    const existingVehicleBooking = Object.values(this.state.bookings).find(
      b => b.vehiclePlateNormalized === params.bookingData.vehiclePlateNormalized &&
        b.parkingAreaId === params.bookingData.parkingAreaId &&
        (b.status === 'reserved' || b.status === 'active_inside')
    );
    if (existingVehicleBooking) {
      return { success: false, error: `Vehicle ${params.bookingData.vehiclePlate} already has an active reservation (#${existingVehicleBooking.bookingNumber}) at this facility.` };
    }

    // Atomic update
    const timestamp = new Date().toISOString();
    const bookingId = `bk-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const bookingNumber = `PS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const ticketToken = `TKT-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${slot.number.replace(/[^A-Z0-9]/g, '')}-${Date.now().toString(36).toUpperCase()}`;

    // Mark slot reserved
    slot.status = 'reserved';
    this.state.slots[slot.id] = slot;

    const newBooking: Booking = {
      ...params.bookingData,
      id: bookingId,
      bookingNumber,
      ticketToken,
      status: 'reserved',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.state.bookings[bookingId] = newBooking;

    this.addAuditLog({
      actorId: newBooking.customerId,
      actorName: newBooking.customerName,
      actorRole: 'customer',
      action: 'SLOT_RESERVED',
      parkingAreaId: newBooking.parkingAreaId,
      targetResource: `Slot ${slot.number}`,
      details: `Reserved by ${newBooking.customerName} for vehicle ${newBooking.vehiclePlate} (#${bookingNumber})`
    });

    this.scheduleFirebaseSync();
    return { success: true, booking: newBooking };
  }

  // --- Atomic Staff EV Upgrade ---
  public atomicUpgradeToEV(params: {
    bookingId: string;
    newEVSlotId: string;
    staffId: string;
    staffName: string;
    reason: string;
  }): { success: boolean; updatedBooking?: Booking; error?: string } {
    const booking = this.state.bookings[params.bookingId];
    if (!booking) return { success: false, error: 'Booking not found.' };

    if (booking.status !== 'reserved' && booking.status !== 'active_inside') {
      return { success: false, error: 'Only reserved or active bookings can be upgraded.' };
    }

    const newSlot = this.state.slots[params.newEVSlotId];
    if (!newSlot) return { success: false, error: 'New EV slot not found.' };

    if (newSlot.type !== 'ev') {
      return { success: false, error: 'Target slot is not an EV slot.' };
    }

    if (newSlot.status !== 'available') {
      return { success: false, error: `EV Slot ${newSlot.number} is not currently available.` };
    }

    const oldSlot = this.state.slots[booking.slotId];

    // Atomically release old slot if not occupied by another event
    if (oldSlot) {
      if (booking.status === 'reserved') {
        oldSlot.status = 'available';
      }
      this.state.slots[oldSlot.id] = oldSlot;
    }

    // Assign new EV slot
    newSlot.status = booking.status === 'active_inside' ? 'occupied' : 'reserved';
    this.state.slots[newSlot.id] = newSlot;

    // Update booking
    const oldSlotNumber = booking.slotNumber;
    booking.slotId = newSlot.id;
    booking.slotNumber = newSlot.number;
    booking.slotType = 'ev';
    booking.isEVRequested = true;
    booking.updatedAt = new Date().toISOString();
    this.state.bookings[booking.id] = booking;

    // If visit exists, update visit too
    const visit = Object.values(this.state.visits).find(v => v.bookingId === booking.id && v.status === 'active');
    if (visit) {
      visit.slotId = newSlot.id;
      visit.slotNumber = newSlot.number;
      visit.savedCarLocation.slotNumber = newSlot.number;
      visit.updatedAt = new Date().toISOString();
      this.state.visits[visit.id] = visit;
    }

    this.addAuditLog({
      actorId: params.staffId,
      actorName: params.staffName,
      actorRole: 'staff',
      action: 'EV_SLOT_UPGRADE',
      parkingAreaId: booking.parkingAreaId,
      targetResource: `Booking #${booking.bookingNumber}`,
      details: `Upgraded from ${oldSlotNumber} to ${newSlot.number}. Reason: ${params.reason}`
    });

    this.scheduleFirebaseSync();
    return { success: true, updatedBooking: booking };
  }

  // --- Visits ---
  public getVisits(customerId?: string, parkingAreaId?: string): Visit[] {
    let all = Object.values(this.state.visits);
    if (customerId) {
      all = all.filter(v => v.customerId === customerId);
    }
    if (parkingAreaId) {
      all = all.filter(v => v.parkingAreaId === parkingAreaId);
    }
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getVisitById(id: string): Visit | undefined {
    return this.state.visits[id];
  }

  public saveVisit(visit: Visit): void {
    this.state.visits[visit.id] = visit;
    this.scheduleFirebaseSync();
  }

  // --- Incidents (Blocked Car) ---
  public getIncidents(parkingAreaId?: string): BlockedCarIncident[] {
    let all = Object.values(this.state.incidents);
    if (parkingAreaId) {
      all = all.filter(i => i.parkingAreaId === parkingAreaId);
    }
    return all.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
  }

  public getIncidentById(id: string): BlockedCarIncident | undefined {
    return this.state.incidents[id];
  }

  public saveIncident(incident: BlockedCarIncident): void {
    this.state.incidents[incident.id] = incident;
    this.scheduleFirebaseSync();
  }

  // --- Staff Tasks ---
  public getTasks(parkingAreaId?: string): StaffTask[] {
    let all = Object.values(this.state.tasks);
    if (parkingAreaId) {
      all = all.filter(t => t.parkingAreaId === parkingAreaId);
    }
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getTaskById(id: string): StaffTask | undefined {
    return this.state.tasks[id];
  }

  public saveTask(task: StaffTask): void {
    this.state.tasks[task.id] = task;
    this.scheduleFirebaseSync();
  }

  // --- Shifts ---
  public getShifts(parkingAreaId?: string): StaffShiftConfig[] {
    let all = Object.values(this.state.shifts);
    if (parkingAreaId) {
      all = all.filter(s => s.parkingAreaId === parkingAreaId);
    }
    return all;
  }

  public saveShift(shift: StaffShiftConfig): void {
    this.state.shifts[shift.id] = shift;
    this.scheduleFirebaseSync();
  }

  // --- Admin-only Reset Demo Data Action ---
  public async resetDemoData(actorId: string, actorName: string): Promise<void> {
    const freshSeed = await createDemoSeedData();

    // Restore Demo Mall parking area layout
    const mallArea = freshSeed.parkingAreas.find(p => p.id === DEMO_MALL_ID);
    if (mallArea) {
      this.state.parkingAreas[mallArea.id] = mallArea;
    }

    // Reset ONLY Demo Mall's slots, bookings, visits, incidents, and tasks
    freshSeed.slots.forEach(s => {
      if (s.parkingAreaId === DEMO_MALL_ID) {
        this.state.slots[s.id] = s;
      }
    });

    // Remove old bookings, visits, incidents, tasks for Demo Mall
    Object.keys(this.state.bookings).forEach(bid => {
      if (this.state.bookings[bid].parkingAreaId === DEMO_MALL_ID) {
        delete this.state.bookings[bid];
      }
    });
    freshSeed.bookings.forEach(b => {
      this.state.bookings[b.id] = b;
    });

    Object.keys(this.state.visits).forEach(vid => {
      if (this.state.visits[vid].parkingAreaId === DEMO_MALL_ID) {
        delete this.state.visits[vid];
      }
    });
    freshSeed.visits.forEach(v => {
      this.state.visits[v.id] = v;
    });

    Object.keys(this.state.incidents).forEach(iid => {
      if (this.state.incidents[iid].parkingAreaId === DEMO_MALL_ID) {
        delete this.state.incidents[iid];
      }
    });
    freshSeed.incidents.forEach(i => {
      this.state.incidents[i.id] = i;
    });

    Object.keys(this.state.tasks).forEach(tid => {
      if (this.state.tasks[tid].parkingAreaId === DEMO_MALL_ID) {
        delete this.state.tasks[tid];
      }
    });
    freshSeed.tasks.forEach(t => {
      this.state.tasks[t.id] = t;
    });

    this.addAuditLog({
      actorId,
      actorName,
      actorRole: 'parking_admin',
      action: 'DEMO_DATA_RESET',
      parkingAreaId: DEMO_MALL_ID,
      targetResource: 'Demo Mall',
      details: 'Demo Mall dataset has been safely reset to initial clean seed state.'
    });

    this.scheduleFirebaseSync();
  }

  // --- Walk-in Cash Booking (staff creates for unaccounted car) ---
  public createWalkInBooking(params: {
    vehiclePlate: string;
    vehiclePlateNormalized: string;
    parkingAreaId: string;
    slotId: string;
    isEV: boolean;
    cashAmountCollected: number;
    staffId: string;
    staffName: string;
    durationHours: number;
  }): { success: boolean; booking?: Booking; error?: string } {
    const area = this.state.parkingAreas[params.parkingAreaId];
    if (!area) return { success: false, error: 'Parking area not found.' };

    const slot = this.state.slots[params.slotId];
    if (!slot) return { success: false, error: 'Slot not found.' };
    if (slot.status !== 'available') {
      return { success: false, error: `Slot ${slot.number} is not available.` };
    }

    // Find the level and zone for this slot
    let levelId = slot.levelId;
    let levelName = 'Level 1';
    let zoneId = slot.zoneId;
    let zoneName = 'Zone A';
    for (const lvl of area.levels) {
      if (lvl.id === slot.levelId) {
        levelName = lvl.name;
        for (const z of lvl.zones) {
          if (z.id === slot.zoneId) {
            zoneName = z.name;
          }
        }
      }
    }

    const now = new Date();
    const timestamp = now.toISOString();
    const bookingId = `bk-walkin-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const bookingNumber = `WI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const ticketToken = `TKT-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${slot.number.replace(/[^A-Z0-9]/g, '')}-${Date.now().toString(36).toUpperCase()}`;
    const endTime = new Date(now.getTime() + params.durationHours * 3600 * 1000).toISOString();

    const walkinBooking: Booking = {
      id: bookingId,
      bookingNumber,
      ticketToken,
      customerId: `walkin-${params.vehiclePlateNormalized}`,
      customerName: `Walk-in: ${params.vehiclePlate}`,
      customerMobile: 'WALKIN-CASH',
      parkingAreaId: area.id,
      parkingAreaName: area.name,
      levelId,
      levelName,
      zoneId,
      zoneName,
      slotId: slot.id,
      slotNumber: slot.number,
      slotType: params.isEV ? 'ev' : 'standard',
      vehiclePlate: params.vehiclePlate,
      vehiclePlateNormalized: params.vehiclePlateNormalized,
      startTime: timestamp,
      endTime,
      expectedDurationHours: params.durationHours,
      status: 'reserved',
      servicesRequested: [],
      estimatedTotal: params.cashAmountCollected,
      isEVRequested: params.isEV,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Mark slot reserved
    slot.status = 'reserved';
    this.state.slots[slot.id] = slot;
    this.state.bookings[bookingId] = walkinBooking;

    this.addAuditLog({
      actorId: params.staffId,
      actorName: params.staffName,
      actorRole: 'staff',
      action: 'WALKIN_CASH_BOOKING_CREATED',
      parkingAreaId: area.id,
      targetResource: `Slot ${slot.number}`,
      details: `Walk-in cash booking for ${params.vehiclePlate}. Cash collected: ₹${params.cashAmountCollected}. Ticket: ${ticketToken}. EV: ${params.isEV}`
    });

    this.scheduleFirebaseSync();
    return { success: true, booking: walkinBooking };
  }

  // --- Admin: assign/add a parking area to a staff member (repetition allowed via array) ---
  public assignStaffToArea(staffUserId: string, parkingAreaId: string): { success: boolean; error?: string } {
    const u = this.state.users[staffUserId];
    if (!u) return { success: false, error: 'Staff user not found.' };
    if (u.role !== 'staff') return { success: false, error: 'User is not a staff member.' };
    // assignedParkingAreaId stores the primary area; assignedParkingAreaIds stores multi-assignments
    u.assignedParkingAreaId = parkingAreaId;
    // Store as multi-list if extended field exists
    const extended = u as any;
    if (!Array.isArray(extended.assignedParkingAreaIds)) {
      extended.assignedParkingAreaIds = u.assignedParkingAreaId ? [u.assignedParkingAreaId] : [];
    }
    if (!extended.assignedParkingAreaIds.includes(parkingAreaId)) {
      extended.assignedParkingAreaIds.push(parkingAreaId);
    }
    u.updatedAt = new Date().toISOString();
    this.state.users[staffUserId] = u;
    this.scheduleFirebaseSync();
    return { success: true };
  }

  // --- Auto-expire stale bookings: cancel reserved bookings whose startTime is >30 min past ---
  public expireStaleBookings(): void {
    const now = Date.now();
    const THIRTY_MIN_MS = 30 * 60 * 1000;
    let changed = false;

    Object.values(this.state.bookings).forEach((b) => {
      if (b.status !== 'reserved') return;
      const start = new Date(b.startTime).getTime();
      if (now - start > THIRTY_MIN_MS) {
        b.status = 'expired';
        b.updatedAt = new Date().toISOString();
        this.state.bookings[b.id] = b;

        // Release slot if it's still in reserved state due to this booking
        const slot = this.state.slots[b.slotId];
        if (slot && slot.status === 'reserved') {
          // Check no other active booking holds this slot
          const otherActive = Object.values(this.state.bookings).find(
            ob => ob.id !== b.id && ob.slotId === b.slotId && (ob.status === 'reserved' || ob.status === 'active_inside')
          );
          if (!otherActive) {
            slot.status = 'available';
            this.state.slots[slot.id] = slot;
          }
        }
        changed = true;
      }
    });

    if (changed) {
      this.saveToCache();
      this.notify();
      this.scheduleFirebaseSync();
    }
  }
}

export const dbService = new DatabaseService();

