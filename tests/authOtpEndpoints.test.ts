process.env.NODE_ENV = 'test';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../server.js';
import { resetOtpStoreForTesting } from '../src/lib/otpAuthService.js';

let server: http.Server;
let baseUrl: string;

describe('Authentication & Email OTP HTTP Endpoints', () => {
  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address() as any;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  test('POST /api/auth/send-otp rejects invalid email', async () => {
    resetOtpStoreForTesting();
    const res = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /valid email address/i);
  });

  test('POST /api/auth/send-otp generates OTP and returns success with testOtp in dev mode', async () => {
    resetOtpStoreForTesting();
    const res = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'restaurant@mumbai-donor.in', purpose: 'signup' }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.match(data.message, /verification code/i);
    assert.ok(data.testOtp);
    assert.equal(data.testOtp.length, 6);
  });

  test('POST /api/auth/verify-otp validates correct code', async () => {
    resetOtpStoreForTesting();
    // 1. Send OTP
    const sendRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ngo@shelter-care.org' }),
    });
    const sendData = await sendRes.json();
    const validOtp = sendData.testOtp;

    // 2. Verify with wrong code
    const wrongRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ngo@shelter-care.org', otp: '999999' }),
    });
    assert.equal(wrongRes.status, 400);
    const wrongData = await wrongRes.json();
    assert.match(wrongData.error, /Invalid verification code/i);

    // 3. Verify with valid code
    const okRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ngo@shelter-care.org', otp: validOtp }),
    });
    assert.equal(okRes.status, 200);
    const okData = await okRes.json();
    assert.equal(okData.success, true);
    assert.equal(okData.verified, true);
  });

  test('POST /api/auth/send-otp enforces rate limiting on rapid repeated calls', async () => {
    resetOtpStoreForTesting();
    const email = 'speedy@spamtest.org';

    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      assert.equal(res.status, 200);
    }

    const rateRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    assert.equal(rateRes.status, 429);
    const rateData = await rateRes.json();
    assert.match(rateData.error, /Too many verification requests/i);
  });
});
