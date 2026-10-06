import crypto from 'crypto';

export interface OtpRecord {
  email: string;
  code: string;
  expiresAt: number;
  attempts: number;
  purpose: 'signup' | 'login' | 'reset';
  verified: boolean;
  createdAt: number;
}

// In-memory OTP storage with automatic TTL cleanup
const otpStore = new Map<string, OtpRecord>();

// Rate limiting: track timestamps of OTP requests per email (max 5 per 15 minutes)
const emailRateLimit = new Map<string, number[]>();

export interface DistributedOtpStore {
  saveOtp(email: string, record: OtpRecord): Promise<void>;
  getOtp(email: string): Promise<OtpRecord | null>;
  deleteOtp(email: string): Promise<void>;
  updateOtp(email: string, updates: Partial<OtpRecord>): Promise<void>;
}

let activeDistributedStore: DistributedOtpStore | null = null;

export function setDistributedOtpStore(store: DistributedOtpStore | null): void {
  activeDistributedStore = store;
}

export function getDistributedOtpStore(): DistributedOtpStore | null {
  return activeDistributedStore;
}

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_VERIFICATION_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 5;

/**
 * Generate a cryptographically secure 6-digit OTP code
 */
export function generateOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Clean up expired OTPs periodically
 */
export function cleanupExpiredOtps(): void {
  const now = Date.now();
  for (const [key, record] of otpStore.entries()) {
    if (now > record.expiresAt) {
      otpStore.delete(key);
    }
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Check if the email has exceeded rate limits
 */
export function checkEmailRateLimit(email: string): { allowed: boolean; remainingSeconds?: number } {
  const cleanEmail = email.trim().toLowerCase();
  const now = Date.now();
  const timestamps = (emailRateLimit.get(cleanEmail) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldestTimestamp = timestamps[0];
    const retryAfterSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldestTimestamp)) / 1000);
    return { allowed: false, remainingSeconds: retryAfterSeconds };
  }

  timestamps.push(now);
  emailRateLimit.set(cleanEmail, timestamps);
  return { allowed: true };
}

/**
 * Create and register an OTP for an email
 */
export function createAndStoreOtp(
  email: string,
  purpose: 'signup' | 'login' | 'reset' = 'signup'
): { code: string; expiresAt: number; formattedExpiry: string } {
  const cleanEmail = email.trim().toLowerCase();
  const code = generateOtpCode();
  const now = Date.now();
  const expiresAt = now + OTP_TTL_MS;

  const record: OtpRecord = {
    email: cleanEmail,
    code,
    expiresAt,
    attempts: 0,
    purpose,
    verified: false,
    createdAt: now,
  };

  otpStore.set(cleanEmail, record);

  if (activeDistributedStore) {
    activeDistributedStore.saveOtp(cleanEmail, record).catch((err) => {
      console.warn('Distributed OTP write notice:', err?.message || err);
    });
  }

  return {
    code,
    expiresAt,
    formattedExpiry: '5 minutes',
  };
}

/**
 * Verify a submitted OTP (synchronous in-memory check, with distributed store sync)
 */
export function verifyOtpCode(
  email: string,
  submittedCode: string
): { success: boolean; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const record = otpStore.get(cleanEmail);

  if (!record) {
    return {
      success: false,
      error: 'No active verification code found for this email. Please request a new code.',
    };
  }

  const now = Date.now();
  if (now > record.expiresAt) {
    otpStore.delete(cleanEmail);
    if (activeDistributedStore) {
      activeDistributedStore.deleteOtp(cleanEmail).catch(() => {});
    }
    return {
      success: false,
      error: 'Verification code has expired. Please request a fresh 6-digit code.',
    };
  }

  record.attempts += 1;

  if (record.attempts > MAX_VERIFICATION_ATTEMPTS) {
    otpStore.delete(cleanEmail);
    if (activeDistributedStore) {
      activeDistributedStore.deleteOtp(cleanEmail).catch(() => {});
    }
    return {
      success: false,
      error: 'Too many incorrect attempts. For security, this code has been invalidated. Please request a new code.',
    };
  }

  if (activeDistributedStore) {
    activeDistributedStore.updateOtp(cleanEmail, { attempts: record.attempts }).catch(() => {});
  }

  // Compare using timing-safe comparison to prevent timing attacks
  const codeMatch =
    record.code.length === submittedCode.trim().length &&
    crypto.timingSafeEqual(Buffer.from(record.code), Buffer.from(submittedCode.trim()));

  if (!codeMatch) {
    const attemptsLeft = MAX_VERIFICATION_ATTEMPTS - record.attempts;
    return {
      success: false,
      error: `Invalid verification code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`,
    };
  }

  // Mark as verified and keep for 10 minutes to allow final form submission
  record.verified = true;
  record.expiresAt = now + 10 * 60 * 1000;
  if (activeDistributedStore) {
    activeDistributedStore.updateOtp(cleanEmail, {
      verified: true,
      expiresAt: record.expiresAt,
    }).catch(() => {});
  }

  return { success: true };
}

/**
 * Distributed-aware asynchronous OTP verification for multi-instance environments
 */
export async function verifyOtpCodeAsync(
  email: string,
  submittedCode: string
): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  let record = otpStore.get(cleanEmail);

  if (!record && activeDistributedStore) {
    record = (await activeDistributedStore.getOtp(cleanEmail)) || undefined;
    if (record) {
      otpStore.set(cleanEmail, record);
    }
  }

  if (!record) {
    return {
      success: false,
      error: 'No active verification code found for this email. Please request a new code.',
    };
  }

  const now = Date.now();
  if (now > record.expiresAt) {
    otpStore.delete(cleanEmail);
    if (activeDistributedStore) {
      await activeDistributedStore.deleteOtp(cleanEmail).catch(() => {});
    }
    return {
      success: false,
      error: 'Verification code has expired. Please request a fresh 6-digit code.',
    };
  }

  record.attempts += 1;

  if (record.attempts > MAX_VERIFICATION_ATTEMPTS) {
    otpStore.delete(cleanEmail);
    if (activeDistributedStore) {
      await activeDistributedStore.deleteOtp(cleanEmail).catch(() => {});
    }
    return {
      success: false,
      error: 'Too many incorrect attempts. For security, this code has been invalidated. Please request a new code.',
    };
  }

  if (activeDistributedStore) {
    await activeDistributedStore.updateOtp(cleanEmail, { attempts: record.attempts }).catch(() => {});
  }

  const codeMatch =
    record.code.length === submittedCode.trim().length &&
    crypto.timingSafeEqual(Buffer.from(record.code), Buffer.from(submittedCode.trim()));

  if (!codeMatch) {
    const attemptsLeft = MAX_VERIFICATION_ATTEMPTS - record.attempts;
    return {
      success: false,
      error: `Invalid verification code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`,
    };
  }

  record.verified = true;
  record.expiresAt = now + 10 * 60 * 1000;
  if (activeDistributedStore) {
    await activeDistributedStore.updateOtp(cleanEmail, {
      verified: true,
      expiresAt: record.expiresAt,
    }).catch(() => {});
  }

  return { success: true };
}

/**
 * Check if an email has already completed OTP verification
 */
export function isEmailVerified(email: string): boolean {
  const cleanEmail = email.trim().toLowerCase();
  const record = otpStore.get(cleanEmail);
  return Boolean(record && record.verified && Date.now() <= record.expiresAt);
}

/**
 * Consume verified OTP after successful account creation / login
 */
export function consumeVerifiedOtp(email: string): void {
  const cleanEmail = email.trim().toLowerCase();
  otpStore.delete(cleanEmail);
  if (activeDistributedStore) {
    activeDistributedStore.deleteOtp(cleanEmail).catch(() => {});
  }
}

/**
 * Reset store for unit tests
 */
export function resetOtpStoreForTesting(): void {
  otpStore.clear();
  emailRateLimit.clear();
  activeDistributedStore = null;
}
