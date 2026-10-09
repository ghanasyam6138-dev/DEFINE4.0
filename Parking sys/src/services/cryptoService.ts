/**
 * Cryptographic and Token Services for ParkSmart
 * Provides secure salted hashing using Web Crypto PBKDF2 / SHA-256,
 * unguessable cryptographically strong tokens, and input normalizers.
 */

export async function hashPasswordWithSalt(password: string, existingSalt?: string): Promise<{ hash: string; salt: string }> {
  const encoder = new TextEncoder();
  const salt = existingSalt || generateSecureToken(16);
  const saltBuffer = encoder.encode(salt);
  const passBuffer = encoder.encode(password);

  // Import key
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  // Derive bits with 10,000 iterations PBKDF2-SHA256
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 10000,
      hash: 'SHA-256'
    },
    baseKey,
    256
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return { hash: hashHex, salt };
}

export async function verifyPassword(password: string, storedHash: string, storedSalt: string): Promise<boolean> {
  try {
    const { hash } = await hashPasswordWithSalt(password, storedSalt);
    return hash === storedHash;
  } catch (err) {
    console.error('Password verification failure:', err);
    return false;
  }
}

/**
 * Generates cryptographically secure, unguessable random tokens for tickets & exit passes.
 */
export function generateSecureToken(byteLength = 20): string {
  const buffer = new Uint8Array(byteLength);
  crypto.getRandomValues(buffer);
  return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Normalizes Indian phone numbers into consistent E.164 (+91XXXXXXXXXX) format.
 * Validates 10-digit mobile number rules.
 */
export function normalizeIndianMobile(rawMobile: string): { isValid: boolean; normalized: string; error?: string } {
  if (!rawMobile) {
    return { isValid: false, normalized: '', error: 'Mobile number is required' };
  }

  // Remove spaces, dashes, parentheses
  let cleaned = rawMobile.replace(/[\s\-()]/g, '');

  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // Check 10-digit format starting with 6, 7, 8, or 9 (Standard Indian mobile prefix)
  const mobileRegex = /^[6-9]\d{9}$/;
  if (!mobileRegex.test(cleaned)) {
    return {
      isValid: false,
      normalized: '',
      error: 'Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9).'
    };
  }

  return {
    isValid: true,
    normalized: `+91${cleaned}`
  };
}

/**
 * Normalizes vehicle registration plates:
 * Trims extra whitespace, standardizes to uppercase, removes internal spaces & dashes for matching.
 * e.g. "ka 01 - ab 1234" -> "KA01AB1234"
 */
export function normalizePlateNumber(rawPlate: string): { display: string; normalized: string; isValid: boolean } {
  if (!rawPlate || !rawPlate.trim()) {
    return { display: '', normalized: '', isValid: false };
  }

  const trimmed = rawPlate.trim().toUpperCase();
  const normalized = trimmed.replace(/[^A-Z0-9]/g, '');

  // Reasonable check: Indian plates are typically 6-11 alphanumeric characters
  const isValid = normalized.length >= 4 && normalized.length <= 13;

  return {
    display: trimmed,
    normalized,
    isValid
  };
}

/**
 * Masks a phone number for data minimization, e.g. "+91 98*** **210"
 */
export function maskMobile(mobile: string): string {
  if (!mobile) return '***';
  if (mobile.length >= 10) {
    const start = mobile.slice(0, 5);
    const end = mobile.slice(-3);
    return `${start}****${end}`;
  }
  return '***';
}
