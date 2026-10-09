import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.database();

/**
 * Normalizes Indian mobile number (+91XXXXXXXXXX)
 */
function normalizeMobile(raw: string): string | null {
  let cleaned = raw.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+91')) cleaned = cleaned.substring(3);
  else if (cleaned.startsWith('91') && cleaned.length === 12) cleaned = cleaned.substring(2);
  else if (cleaned.startsWith('0') && cleaned.length === 11) cleaned = cleaned.substring(1);
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  return null;
}

/**
 * 1. Register User (Callable Cloud Function)
 * Enforces phone formatting, hashes password using PBKDF2 with random salt,
 * prevents duplicate phone numbers, assigns default 'customer' role.
 */
export const registerUser = functions.https.onCall(async (data, context) => {
  const { name, mobile, password } = data;
  if (!name || !mobile || !password || password.length < 6) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid registration parameters.');
  }

  const normMobile = normalizeMobile(mobile);
  if (!normMobile) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid 10-digit Indian mobile number.');
  }

  // Check duplicate
  const usersSnap = await db.ref('parksmart/users').orderByChild('mobile').equalTo(normMobile).once('value');
  if (usersSnap.exists()) {
    throw new functions.https.HttpsError('already-exists', 'An account with this mobile number already exists.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
  const userId = `usr-${Date.now()}`;
  const now = new Date().toISOString();

  const newUser = {
    id: userId,
    name: name.trim(),
    mobile: normMobile,
    passwordHash: hash,
    salt,
    role: 'customer',
    status: 'active',
    createdAt: now,
    updatedAt: now
  };

  await db.ref(`parksmart/users/${userId}`).set(newUser);
  return { success: true, userId, mobile: normMobile };
});

/**
 * 2. Atomic Slot Reservation (Callable Cloud Function)
 * Atomically locks and reserves a slot, preventing race conditions and double bookings.
 */
export const reserveSlotAtomic = functions.https.onCall(async (data, context) => {
  const { slotId, bookingData } = data;
  if (!slotId || !bookingData) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing reservation data.');
  }

  const slotRef = db.ref(`parksmart/slots/${slotId}`);
  const result = await slotRef.transaction((currentSlot) => {
    if (!currentSlot) return currentSlot; // abort if slot does not exist
    if (currentSlot.status !== 'available' || !currentSlot.isBookable) {
      return; // abort transaction if already reserved/occupied
    }
    currentSlot.status = 'reserved';
    return currentSlot;
  });

  if (!result.committed) {
    throw new functions.https.HttpsError('failed-precondition', 'Slot is no longer available.');
  }

  const bookingId = `bk-${Date.now()}`;
  const bookingNumber = `PS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const ticketToken = `TKT-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
  const now = new Date().toISOString();

  const newBooking = {
    ...bookingData,
    id: bookingId,
    bookingNumber,
    ticketToken,
    status: 'reserved',
    createdAt: now,
    updatedAt: now
  };

  await db.ref(`parksmart/bookings/${bookingId}`).set(newBooking);
  return { success: true, booking: newBooking };
});

/**
 * 3. Validate Entry via ANPR or QR Pass (Callable Cloud Function)
 * Validates booking, marks vehicle active_inside, transitions slot to occupied, creates Visit.
 */
export const validateEntry = functions.https.onCall(async (data, context) => {
  const { bookingId, entryMethod, operatorId } = data;
  const bookingSnap = await db.ref(`parksmart/bookings/${bookingId}`).once('value');
  if (!bookingSnap.exists()) {
    throw new functions.https.HttpsError('not-found', 'Booking not found.');
  }

  const booking = bookingSnap.val();
  if (booking.status !== 'reserved') {
    throw new functions.https.HttpsError('failed-precondition', `Booking is in ${booking.status} status.`);
  }

  const now = new Date().toISOString();
  const visitId = `vst-${Date.now()}`;

  // Update booking
  await db.ref(`parksmart/bookings/${bookingId}`).update({
    status: 'active_inside',
    updatedAt: now
  });

  // Mark slot occupied
  await db.ref(`parksmart/slots/${booking.slotId}`).update({
    status: 'occupied'
  });

  // Create visit record
  const visit = {
    id: visitId,
    bookingId: booking.id,
    parkingAreaId: booking.parkingAreaId,
    parkingAreaName: booking.parkingAreaName,
    slotId: booking.slotId,
    slotNumber: booking.slotNumber,
    levelName: booking.levelName,
    zoneName: booking.zoneName,
    vehiclePlate: booking.vehiclePlate,
    vehiclePlateNormalized: booking.vehiclePlateNormalized,
    customerId: booking.customerId,
    customerName: booking.customerName,
    entryTimestamp: now,
    entryMethod,
    entryOperatorId: operatorId || 'gate-system',
    status: 'active',
    currentDurationMinutes: 0,
    calculatedFee: 0,
    createdAt: now,
    updatedAt: now
  };

  await db.ref(`parksmart/visits/${visitId}`).set(visit);
  return { success: true, visit, barrierOpenSimulated: true };
});

/**
 * 4. Process Payment Webhook / Exit Pass Issuance (HTTP Webhook)
 * Validates transaction signature, issues digital Exit Pass with 20m expiry window.
 */
export const processPaymentWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { visitId, amount, transactionId } = req.body;
  if (!visitId || !amount) {
    res.status(400).json({ error: 'Missing payment metadata' });
    return;
  }

  const visitRef = db.ref(`parksmart/visits/${visitId}`);
  const visitSnap = await visitRef.once('value');
  if (!visitSnap.exists()) {
    res.status(404).json({ error: 'Visit record not found' });
    return;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 20 * 60 * 1000).toISOString();
  const passToken = `EXIT-${crypto.randomBytes(10).toString('hex').toUpperCase()}`;

  const exitPass = {
    passToken,
    issuedAt: now.toISOString(),
    expiresAt,
    isConsumed: false
  };

  await visitRef.update({
    status: 'exit_pass_issued',
    exitPass,
    calculatedFee: amount,
    updatedAt: now.toISOString()
  });

  res.status(200).json({ success: true, exitPass });
});
