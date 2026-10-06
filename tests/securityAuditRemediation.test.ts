import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isProductionEnvironment, maskSensitiveGovId } from '../src/features/auth/AuthContext.js';
import {
  createAndStoreOtp,
  verifyOtpCode,
  verifyOtpCodeAsync,
  setDistributedOtpStore,
  resetOtpStoreForTesting,
  DistributedOtpStore,
  OtpRecord,
} from '../src/lib/otpAuthService.js';

describe('Security Audit Remediation Tests', () => {
  // 1. Identity & Regulatory Compliance: Aadhaar & PAN Masking (Aadhaar Act Sec 29 & DPDP Act 2023)
  describe('Sensitive ID Masking (Aadhaar & PAN)', () => {
    test('masks 12-digit Aadhaar numbers to XXXX-XXXX-1234', () => {
      const masked = maskSensitiveGovId('123456789012', 'Aadhaar');
      assert.equal(masked, 'XXXX-XXXX-9012');
    });

    test('masks formatted 12-digit Aadhaar numbers with spaces or dashes', () => {
      const masked = maskSensitiveGovId('5555 6666 7777', 'Aadhaar');
      assert.equal(masked, 'XXXX-XXXX-7777');
    });

    test('masks 10-character PAN to XXXXXX1234', () => {
      const masked = maskSensitiveGovId('ABCDE1234F', 'PAN');
      assert.equal(masked, 'XXXXXX234F');
    });

    test('handles undefined or short IDs gracefully', () => {
      assert.equal(maskSensitiveGovId(undefined), undefined);
      assert.equal(maskSensitiveGovId(''), '');
      assert.equal(maskSensitiveGovId('DL-123'), 'DL-123');
    });
  });

  // 2. Production Environment & Demo Bypass Hardening
  describe('Production Demo Protection', () => {
    test('isProductionEnvironment returns false in test environment', () => {
      const orig = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      assert.equal(isProductionEnvironment(), false);
      process.env.NODE_ENV = orig;
    });

    test('isProductionEnvironment returns true when NODE_ENV is production', () => {
      const orig = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      assert.equal(isProductionEnvironment(), true);
      process.env.NODE_ENV = orig;
    });
  });

  // 3. Firestore Rules: Users Collection Protection & Listings Tamper Resistance
  describe('Firestore Security Rules Hardening', () => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    test('users collection strictly denies unauthenticated global reads', () => {
      // Must NOT contain allow read: if true; for /users/
      const usersBlockMatch = rulesContent.match(/match \/users\/\{userId\}[\s\S]*?allow read:\s*if\s*([^;]+);/);
      assert.ok(usersBlockMatch, 'users match block must exist');
      const condition = usersBlockMatch[1];
      assert.notEqual(condition.trim(), 'true', 'users read condition must NOT be unconditionally true');
      assert.ok(condition.includes('request.auth != null'), 'users read requires authentication');
      assert.ok(condition.includes('request.auth.uid == userId'), 'users read requires owner uid match');
      assert.ok(condition.includes('request.auth.token.admin == true'), 'users read permits admin token override');
    });

    test('listings collection includes nonOwnerUpdateKeysAllowed helper', () => {
      assert.ok(rulesContent.includes('function nonOwnerUpdateKeysAllowed()'));
      assert.ok(rulesContent.includes('affectedKeys().hasOnly'));
    });

    test('listings update restricts third-party field modification', () => {
      // Non-owners updating status can only touch allowed fulfillment keys
      assert.ok(rulesContent.includes('nonOwnerUpdateKeysAllowed()'));
    });
  });

  // 4. Distributed OTP Storage & Container Scalability
  describe('Distributed OTP Storage Synchronization', () => {
    test('supports syncing OTP records with a distributed store', async () => {
      resetOtpStoreForTesting();
      const mockStorage = new Map<string, OtpRecord>();

      const mockDistributedStore: DistributedOtpStore = {
        async saveOtp(email: string, record: OtpRecord): Promise<void> {
          mockStorage.set(email, { ...record });
        },
        async getOtp(email: string): Promise<OtpRecord | null> {
          return mockStorage.get(email) || null;
        },
        async deleteOtp(email: string): Promise<void> {
          mockStorage.delete(email);
        },
        async updateOtp(email: string, updates: Partial<OtpRecord>): Promise<void> {
          const rec = mockStorage.get(email);
          if (rec) {
            mockStorage.set(email, { ...rec, ...updates });
          }
        },
      };

      setDistributedOtpStore(mockDistributedStore);

      const email = 'cluster@foodlink.org';
      const { code } = createAndStoreOtp(email);

      // Verify it was persisted to distributed storage
      assert.ok(mockStorage.has(email));
      assert.equal(mockStorage.get(email)?.code, code);

      // Verify OTP through distributed-aware async verifier
      const verifyResult = await verifyOtpCodeAsync(email, code);
      assert.equal(verifyResult.success, true);
      assert.equal(mockStorage.get(email)?.verified, true);

      resetOtpStoreForTesting();
    });
  });
});
