import type { User } from '../types';
import { dbService } from './dbService';
import { hashPasswordWithSalt, verifyPassword, normalizeIndianMobile } from './cryptoService';

const SESSION_KEY = 'parksmart_current_session_v1';
const FAILED_ATTEMPTS_KEY = 'parksmart_failed_attempts_v1';

interface FailedAttemptTracker {
  count: number;
  lastAttempt: number;
}

export class AuthService {
  private failedAttempts: Record<string, FailedAttemptTracker> = {};

  constructor() {
    this.loadFailedAttempts();
  }

  private loadFailedAttempts(): void {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
    try {
      const data = sessionStorage.getItem(FAILED_ATTEMPTS_KEY);
      if (data) this.failedAttempts = JSON.parse(data);
    } catch (e) {
      this.failedAttempts = {};
    }
  }

  private recordFailedAttempt(mobile: string): void {
    const now = Date.now();
    const entry = this.failedAttempts[mobile] || { count: 0, lastAttempt: now };
    // Reset if last attempt was > 5 minutes ago
    if (now - entry.lastAttempt > 5 * 60 * 1000) {
      entry.count = 1;
    } else {
      entry.count += 1;
    }
    entry.lastAttempt = now;
    this.failedAttempts[mobile] = entry;
    try {
      sessionStorage.setItem(FAILED_ATTEMPTS_KEY, JSON.stringify(this.failedAttempts));
    } catch (e) {}
  }

  private clearFailedAttempts(mobile: string): void {
    delete this.failedAttempts[mobile];
    try {
      sessionStorage.setItem(FAILED_ATTEMPTS_KEY, JSON.stringify(this.failedAttempts));
    } catch (e) {}
  }

  private isRateLimited(mobile: string): { limited: boolean; waitMinutes?: number } {
    const entry = this.failedAttempts[mobile];
    if (!entry) return { limited: false };
    const now = Date.now();
    const elapsedMs = now - entry.lastAttempt;
    if (entry.count >= 5 && elapsedMs < 5 * 60 * 1000) {
      const waitMinutes = Math.ceil((5 * 60 * 1000 - elapsedMs) / 60000);
      return { limited: true, waitMinutes };
    }
    return { limited: false };
  }

  /**
   * Registers a new customer account.
   * Required fields: Full Name, Mobile Number, Password, Confirm Password.
   * Public sign-up always defaults to 'customer' role.
   */
  public async register(params: {
    name: string;
    mobile: string;
    password: string;
    confirmPassword: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    const { name, mobile, password, confirmPassword } = params;

    if (!name || name.trim().length < 2) {
      return { success: false, error: 'Please enter your full name (minimum 2 characters).' };
    }

    const mobileCheck = normalizeIndianMobile(mobile);
    if (!mobileCheck.isValid) {
      return { success: false, error: mobileCheck.error || 'Invalid mobile number.' };
    }

    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    if (password !== confirmPassword) {
      return { success: false, error: 'Passwords do not match.' };
    }

    // Check existing user
    const existing = dbService.getUserByMobile(mobileCheck.normalized);
    if (existing) {
      return { success: false, error: 'An account with this mobile number already exists. Please log in.' };
    }

    const { hash, salt } = await hashPasswordWithSalt(password);
    const userId = `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const timestamp = new Date().toISOString();

    const newUser: User = {
      id: userId,
      name: name.trim(),
      mobile: mobileCheck.normalized,
      passwordHash: hash,
      salt,
      role: 'customer',
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    dbService.saveUser(newUser);

    dbService.addAuditLog({
      actorId: newUser.id,
      actorName: newUser.name,
      actorRole: 'customer',
      action: 'USER_REGISTERED',
      targetResource: `User ${newUser.mobile}`,
      details: 'Customer registered with mobile verification.'
    });

    this.setCurrentSession(newUser);
    return { success: true, user: newUser };
  }

  /**
   * Mobile-number and password login.
   * Rate limited, safe errors, checks salted hash.
   */
  public async login(params: {
    mobile: string;
    password: string;
  }): Promise<{ success: boolean; user?: User; error?: string; isPendingApproval?: boolean }> {
    const mobileCheck = normalizeIndianMobile(params.mobile);
    if (!mobileCheck.isValid) {
      return { success: false, error: 'Please enter a valid mobile number.' };
    }

    const normMobile = mobileCheck.normalized;

    const rateLimit = this.isRateLimited(normMobile);
    if (rateLimit.limited) {
      return {
        success: false,
        error: `Too many failed attempts. Please try again in ${rateLimit.waitMinutes} minute(s).`
      };
    }

    const user = dbService.getUserByMobile(normMobile);
    if (!user) {
      this.recordFailedAttempt(normMobile);
      return { success: false, error: 'Invalid mobile number or password.' };
    }

    const isValid = await verifyPassword(params.password, user.passwordHash, user.salt);
    if (!isValid) {
      this.recordFailedAttempt(normMobile);
      return { success: false, error: 'Invalid mobile number or password.' };
    }

    this.clearFailedAttempts(normMobile);

    if (user.status === 'suspended') {
      return { success: false, error: 'Your account has been suspended. Please contact operations administration.' };
    }

    if (user.role === 'staff' && user.status === 'pending_approval') {
      this.setCurrentSession(user);
      return {
        success: true,
        user,
        isPendingApproval: true,
        error: 'Your staff account is currently PENDING ADMIN APPROVAL.'
      };
    }

    this.setCurrentSession(user);

    dbService.addAuditLog({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'USER_LOGGED_IN',
      targetResource: `User ${user.mobile}`,
      details: `Successful login as ${user.role}`
    });

    return { success: true, user };
  }

  /**
   * Submits a Staff access request with registered mobile & password.
   */
  public async requestStaffAccess(params: {
    name: string;
    mobile: string;
    password: string;
    parkingAreaId: string;
    requestedNotes?: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    const mobileCheck = normalizeIndianMobile(params.mobile);
    if (!mobileCheck.isValid) {
      return { success: false, error: mobileCheck.error || 'Invalid mobile number.' };
    }

    if (!params.password || params.password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    const existing = dbService.getUserByMobile(mobileCheck.normalized);
    if (existing) {
      if (existing.role === 'staff' && existing.status === 'active') {
        return { success: false, error: 'You already have an active staff account. Please proceed to login.' };
      }
      if (existing.role === 'staff' && existing.status === 'pending_approval') {
        return { success: false, error: 'Your staff access request is already pending admin review.' };
      }
      // Upgrade customer account to staff pending approval
      const isValid = await verifyPassword(params.password, existing.passwordHash, existing.salt);
      if (!isValid) {
        return { success: false, error: 'Incorrect password for existing account.' };
      }
      existing.role = 'staff';
      existing.status = 'pending_approval';
      existing.assignedParkingAreaId = params.parkingAreaId;
      existing.updatedAt = new Date().toISOString();
      dbService.saveUser(existing);

      dbService.addAuditLog({
        actorId: existing.id,
        actorName: existing.name,
        actorRole: 'staff',
        action: 'STAFF_ACCESS_REQUESTED',
        parkingAreaId: params.parkingAreaId,
        targetResource: existing.name,
        details: `Submitted staff access request for parking facility.`
      });

      this.setCurrentSession(existing);
      return { success: true, user: existing };
    }

    // Create new staff applicant with pending approval
    const { hash, salt } = await hashPasswordWithSalt(params.password);
    const userId = `usr-staff-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const newStaffUser: User = {
      id: userId,
      name: params.name.trim(),
      mobile: mobileCheck.normalized,
      passwordHash: hash,
      salt,
      role: 'staff',
      status: 'pending_approval',
      assignedParkingAreaId: params.parkingAreaId,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    dbService.saveUser(newStaffUser);

    dbService.addAuditLog({
      actorId: newStaffUser.id,
      actorName: newStaffUser.name,
      actorRole: 'staff',
      action: 'STAFF_ACCESS_REQUESTED',
      parkingAreaId: params.parkingAreaId,
      targetResource: newStaffUser.name,
      details: 'New staff access request created.'
    });

    this.setCurrentSession(newStaffUser);
    return { success: true, user: newStaffUser };
  }

  /**
   * Admin reviews & approves staff access request.
   */
  public approveStaffRequest(params: {
    adminId: string;
    adminName: string;
    targetUserId: string;
    assignedStaffId: string;
    assignedParkingAreaId?: string;
    notes?: string;
  }): { success: boolean; error?: string; user?: User } {
    const admin = dbService.getUserById(params.adminId);
    if (!admin || (admin.role !== 'parking_admin' && admin.role !== 'platform_admin')) {
      return { success: false, error: 'Unauthorized: Only an administrator can approve staff requests.' };
    }

    const user = dbService.getUserById(params.targetUserId);
    if (!user) return { success: false, error: 'Staff member not found.' };

    user.status = 'active';
    user.role = 'staff';
    user.staffId = params.assignedStaffId || `STF-${Math.floor(100 + Math.random() * 900)}`;
    if (params.assignedParkingAreaId) {
      user.assignedParkingAreaId = params.assignedParkingAreaId;
    }
    user.approvalDetails = {
      approvedBy: admin.id,
      approvedByName: admin.name,
      approvedAt: new Date().toISOString(),
      notes: params.notes || 'Approved by facility administration'
    };
    user.updatedAt = new Date().toISOString();

    dbService.saveUser(user);

    dbService.addAuditLog({
      actorId: admin.id,
      actorName: admin.name,
      actorRole: admin.role,
      action: 'STAFF_REQUEST_APPROVED',
      parkingAreaId: user.assignedParkingAreaId,
      targetResource: `Staff ${user.name} (${user.staffId})`,
      details: `Approved by ${admin.name}. Assigned Staff ID: ${user.staffId}`
    });

    return { success: true, user };
  }

  /**
   * Admin rejects staff access request.
   */
  public rejectStaffRequest(params: {
    adminId: string;
    adminName: string;
    targetUserId: string;
    reason?: string;
  }): { success: boolean; error?: string } {
    const admin = dbService.getUserById(params.adminId);
    if (!admin || (admin.role !== 'parking_admin' && admin.role !== 'platform_admin')) {
      return { success: false, error: 'Unauthorized: Only an administrator can reject staff requests.' };
    }

    const user = dbService.getUserById(params.targetUserId);
    if (!user) return { success: false, error: 'Staff applicant not found.' };

    user.status = 'rejected';
    user.updatedAt = new Date().toISOString();
    dbService.saveUser(user);

    dbService.addAuditLog({
      actorId: admin.id,
      actorName: admin.name,
      actorRole: admin.role,
      action: 'STAFF_REQUEST_REJECTED',
      parkingAreaId: user.assignedParkingAreaId,
      targetResource: `Applicant ${user.name}`,
      details: `Rejected by ${admin.name}. Reason: ${params.reason || 'Not specified'}`
    });

    return { success: true };
  }

  // --- Session Management ---
  public getCurrentSession(): User | null {
    try {
      const data = localStorage.getItem(SESSION_KEY);
      if (!data) return null;
      const parsed = JSON.parse(data);
      // Fetch fresh record from db
      const fresh = dbService.getUserById(parsed.id);
      return fresh || parsed;
    } catch (e) {
      return null;
    }
  }

  public setCurrentSession(user: User): void {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } catch (e) {}
  }

  public logout(): void {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }
}

export const authService = new AuthService();
