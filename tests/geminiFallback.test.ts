import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateAndSanitizeGeminiOutput, HoldingWindowResult } from '../src/lib/safetyCheckLogic.ts';

describe('Gemini Output Validation & Fallback Logic', () => {
  const validHoldingWindow: HoldingWindowResult = {
    isExpired: false,
    remainingMinutes: 180,
  };

  test('successfully parses and validates valid Gemini structured output', () => {
    const rawOutput = JSON.stringify({
      verdict: 'safe',
      score: 92,
      reasons: ['Sealed food-grade containers', 'Prepared within last 45 minutes'],
      missingInfo: [],
      holdingWindowRemainingMinutes: 180,
    });

    const result = validateAndSanitizeGeminiOutput(rawOutput, validHoldingWindow);

    assert.equal(result.verdict, 'safe');
    assert.equal(result.score, 92);
    assert.equal(result.reasons.length, 2);
    assert.equal(result.missingInfo.length, 0);
    assert.equal(result.holdingWindowRemainingMinutes, 180);
  });

  test('falls back to caution and "AI check unavailable" on non-JSON raw output', () => {
    const malformedOutput = 'I cannot inspect this image because the service failed to parse.';

    const result = validateAndSanitizeGeminiOutput(malformedOutput, validHoldingWindow);

    assert.equal(result.verdict, 'caution');
    assert.equal(result.score, 50);
    assert.deepEqual(result.reasons, ['AI check unavailable']);
    assert.deepEqual(result.missingInfo, []);
    assert.equal(result.holdingWindowRemainingMinutes, 180);
  });

  test('falls back to caution on invalid verdict string', () => {
    const invalidVerdictOutput = JSON.stringify({
      verdict: 'unknown_status',
      score: 80,
      reasons: ['Looks okay'],
    });

    const result = validateAndSanitizeGeminiOutput(invalidVerdictOutput, validHoldingWindow);

    assert.equal(result.verdict, 'caution');
    assert.equal(result.score, 50);
    assert.deepEqual(result.reasons, ['AI check unavailable']);
  });

  test('handles score boundaries and clamps to 0-100 integer range', () => {
    const highOutput = JSON.stringify({
      verdict: 'safe',
      score: 150,
      reasons: ['Excellent condition'],
    });
    const lowOutput = JSON.stringify({
      verdict: 'unsafe',
      score: -25,
      reasons: ['Severe spoilage'],
    });

    const highResult = validateAndSanitizeGeminiOutput(highOutput, validHoldingWindow);
    const lowResult = validateAndSanitizeGeminiOutput(lowOutput, validHoldingWindow);

    assert.equal(highResult.score, 100);
    assert.equal(lowResult.score, 0);
  });

  test('filters out invalid types in reasons and missingInfo arrays', () => {
    const dirtyOutput = JSON.stringify({
      verdict: 'caution',
      score: 65,
      reasons: ['Valid reason', '', null, 123, 'Another valid reason'],
      missingInfo: ['Need allergen check', '', undefined],
    });

    const result = validateAndSanitizeGeminiOutput(dirtyOutput, validHoldingWindow);

    assert.deepEqual(result.reasons, ['Valid reason', 'Another valid reason']);
    assert.deepEqual(result.missingInfo, ['Need allergen check']);
  });

  test('enforces deterministic holding window expiration even on malformed AI output', () => {
    const expiredWindow: HoldingWindowResult = {
      isExpired: true,
      remainingMinutes: 0,
      reason: 'Safe holding window has expired (exceeded by 45 minutes).',
    };

    // Even completely broken output must produce verdict "unsafe" when expired
    const result = validateAndSanitizeGeminiOutput('gibberish', expiredWindow);

    assert.equal(result.verdict, 'unsafe');
    assert.equal(result.holdingWindowRemainingMinutes, 0);
    assert.match(result.reasons[0], /Safe holding window has expired/);
  });
});
