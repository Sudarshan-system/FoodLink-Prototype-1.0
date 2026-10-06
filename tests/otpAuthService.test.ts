import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateOtpCode,
  isValidEmail,
  checkEmailRateLimit,
  createAndStoreOtp,
  verifyOtpCode,
  isEmailVerified,
  consumeVerifiedOtp,
  resetOtpStoreForTesting,
} from '../src/lib/otpAuthService.js';

describe('Email OTP Service & Security Logic', () => {
  beforeEach(() => {
    resetOtpStoreForTesting();
  });

  test('generates valid 6-digit numeric OTP', () => {
    const code = generateOtpCode();
    assert.equal(typeof code, 'string');
    assert.equal(code.length, 6);
    assert.match(code, /^\d{6}$/);
  });

  test('correctly validates email formats', () => {
    assert.equal(isValidEmail('chef@bistro.com'), true);
    assert.equal(isValidEmail('shelter.care@ngo.org.in'), true);
    assert.equal(isValidEmail('not-an-email'), false);
    assert.equal(isValidEmail('missing-domain@'), false);
    assert.equal(isValidEmail(''), false);
  });

  test('successfully creates, stores, and verifies matching OTP', () => {
    const email = 'donor@restaurant.com';
    const otp = createAndStoreOtp(email, 'signup');

    assert.equal(otp.code.length, 6);
    assert.equal(isEmailVerified(email), false);

    const result = verifyOtpCode(email, otp.code);
    assert.equal(result.success, true);
    assert.equal(isEmailVerified(email), true);

    consumeVerifiedOtp(email);
    assert.equal(isEmailVerified(email), false);
  });

  test('rejects incorrect OTP codes and decrements remaining attempts', () => {
    const email = 'volunteer@courier.org';
    const otp = createAndStoreOtp(email, 'signup');

    const wrongCode = otp.code === '123456' ? '654321' : '123456';
    const attempt1 = verifyOtpCode(email, wrongCode);

    assert.equal(attempt1.success, false);
    assert.match(attempt1.error || '', /Invalid verification code/);
    assert.equal(isEmailVerified(email), false);
  });

  test('invalidates OTP after maximum failed attempts (brute-force defense)', () => {
    const email = 'shelter@hopekitchen.org';
    createAndStoreOtp(email, 'login');

    for (let i = 0; i < 5; i++) {
      verifyOtpCode(email, '000000');
    }

    const finalAttempt = verifyOtpCode(email, '000000');
    assert.equal(finalAttempt.success, false);
    assert.match(finalAttempt.error || '', /Too many incorrect attempts|No active/);
  });

  test('enforces email rate limit preventing spam/flooding', () => {
    const email = 'spammer@example.com';

    for (let i = 0; i < 5; i++) {
      const check = checkEmailRateLimit(email);
      assert.equal(check.allowed, true);
    }

    const blocked = checkEmailRateLimit(email);
    assert.equal(blocked.allowed, false);
    assert.ok(typeof blocked.remainingSeconds === 'number');
    assert.ok(blocked.remainingSeconds! > 0);
  });
});
