import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeHoldingWindow, validateAndSanitizeGeminiOutput } from '../src/lib/safetyCheckLogic.ts';

describe('Deterministic Holding Window Computation', () => {
  const baseTime = 1770000000000; // Fixed epoch time for deterministic testing

  test('calculates correct remaining minutes for fresh food with ample holding window', () => {
    const twoHoursLater = baseTime + 2 * 60 * 60 * 1000;
    const result = computeHoldingWindow({
      safeUntilMillis: twoHoursLater,
      now: baseTime,
    });

    assert.equal(result.isExpired, false);
    assert.equal(result.remainingMinutes, 120);
    assert.equal(result.reason, undefined);
  });

  test('detects expired food when safeUntil has elapsed', () => {
    const thirtyMinsAgo = baseTime - 30 * 60 * 1000;
    const result = computeHoldingWindow({
      safeUntilMillis: thirtyMinsAgo,
      now: baseTime,
    });

    assert.equal(result.isExpired, true);
    assert.equal(result.remainingMinutes, 0);
    assert.match(result.reason || '', /Safe holding window has expired/);
    assert.match(result.reason || '', /30 minutes/);
  });

  test('calculates holding window from prepDate + prepTime + safeHoldingHours', () => {
    // Prep at 12:00, 4 hour holding window -> expiry at 16:00
    // Test at 14:30 (150 minutes after prep, 90 minutes remaining)
    const prepDate = '2026-10-05';
    const prepTime = '12:00';
    const testNow = new Date('2026-10-05T14:30:00').getTime();

    const result = computeHoldingWindow({
      prepDate,
      prepTime,
      safeHoldingHours: 4,
      now: testNow,
    });

    assert.equal(result.isExpired, false);
    assert.equal(result.remainingMinutes, 90);
  });

  test('marks as expired if prepDate + prepTime + safeHoldingHours has passed', () => {
    const prepDate = '2026-10-05';
    const prepTime = '08:00';
    const testNow = new Date('2026-10-05T14:00:00').getTime(); // 6 hours later with 4h window

    const result = computeHoldingWindow({
      prepDate,
      prepTime,
      safeHoldingHours: 4,
      now: testNow,
    });

    assert.equal(result.isExpired, true);
    assert.equal(result.remainingMinutes, 0);
    assert.match(result.reason || '', /expired/i);
  });

  test('marks as expired when preparation parameters are completely missing', () => {
    const result = computeHoldingWindow({});
    assert.equal(result.isExpired, true);
    assert.equal(result.remainingMinutes, 0);
    assert.match(result.reason || '', /missing or unparseable/i);
  });

  test('deterministic expired result CANNOT be overridden by Gemini output', () => {
    const expiredWindow = computeHoldingWindow({
      safeUntilMillis: baseTime - 15 * 60 * 1000,
      now: baseTime,
    });
    assert.equal(expiredWindow.isExpired, true);

    // Gemini mistakenly claimed the food is safe
    const mockGeminiOutput = JSON.stringify({
      verdict: 'safe',
      score: 95,
      reasons: ['Food looks visibly fresh and steaming hot.'],
      missingInfo: [],
      holdingWindowRemainingMinutes: 120,
    });

    const finalResult = validateAndSanitizeGeminiOutput(mockGeminiOutput, expiredWindow);

    // Deterministic override must force unsafe verdict and 0 remaining minutes
    assert.equal(finalResult.verdict, 'unsafe');
    assert.equal(finalResult.holdingWindowRemainingMinutes, 0);
    assert.ok(finalResult.score <= 20);
    assert.match(finalResult.reasons[0], /Safe holding window has expired/);
  });
});
