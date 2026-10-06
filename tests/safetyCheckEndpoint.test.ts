import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app, setAdminDbForTesting, resetUserRateLimitsForTesting } from '../server.ts';

describe('POST /api/safety-check HTTP Endpoint Integration', () => {
  let server: http.Server;
  let baseUrl: string;

  // In-memory mock Firestore listings collection for testing server-side loading & Admin SDK updates
  const mockListings = new Map<string, any>();

  before(async () => {
    // Inject mock Firestore implementation for testing
    setAdminDbForTesting({
      collection: (colName: string) => {
        if (colName !== 'listings') throw new Error(`Unexpected collection ${colName}`);
        return {
          doc: (docId: string) => ({
            get: async () => {
              const data = mockListings.get(docId);
              return {
                exists: Boolean(data),
                data: () => (data ? { ...data } : undefined),
              };
            },
            update: async (fields: any) => {
              const current = mockListings.get(docId);
              if (current) {
                mockListings.set(docId, { ...current, ...fields });
              }
            },
          }),
        };
      },
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address() as { port: number };
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

  beforeEach(() => {
    resetUserRateLimitsForTesting();
    mockListings.clear();

    // Populate a sample valid fresh listing
    mockListings.set('listing-valid-fresh', {
      foodType: 'Cooked Meals',
      foodName: 'Vegetable Pulao & Dal Tadka',
      quantity: '40 packs',
      prepDate: new Date().toISOString().split('T')[0],
      prepTime: '12:00',
      safeHoldingHours: 4,
      safeUntilMillis: Date.now() + 3 * 60 * 60 * 1000, // 3 hours remaining
      storageCondition: 'Insulated hot containers above 65°C',
      allergenDeclaration: 'Contains mustard, dairy free',
      donorId: 'donor_user_test',
    });
  });

  test('rejects unauthenticated requests with 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/safety-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ listingId: 'listing-valid-fresh' }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok(body.error.includes('Unauthorized'));
  });

  test('rejects invalid or empty Bearer token with 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/safety-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-token-string',
      },
      body: JSON.stringify({ listingId: 'listing-valid-fresh' }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok(body.error.includes('Unauthorized'));
  });

  test('rejects requests missing listingId with 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/safety-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo-token-test-donor',
      },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('listingId is required'));
  });

  test('returns 404 when listingId does not exist in Firestore', async () => {
    const res = await fetch(`${baseUrl}/api/safety-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo-token-test-donor',
      },
      body: JSON.stringify({ listingId: 'non-existent-listing-99999' }),
    });

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.error.includes('not found in Firestore'));
  });

  test('returns 200 with structured safety check verdict and updates listing in Firestore', async () => {
    const res = await fetch(`${baseUrl}/api/safety-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo-token-test-donor',
      },
      body: JSON.stringify({ listingId: 'listing-valid-fresh' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();

    // Verify structured output contract
    assert.ok(['safe', 'caution', 'unsafe'].includes(body.verdict));
    assert.equal(typeof body.score, 'number');
    assert.ok(body.score >= 0 && body.score <= 100);
    assert.ok(Array.isArray(body.reasons));
    assert.ok(Array.isArray(body.missingInfo));
    assert.equal(typeof body.holdingWindowRemainingMinutes, 'number');

    // Verify Firestore was updated via Admin SDK logic
    const updatedListing = mockListings.get('listing-valid-fresh');
    assert.ok(updatedListing);
    assert.equal(updatedListing.safetyVerdict, body.verdict);
    assert.equal(updatedListing.safetyScore, body.score);
    assert.equal(updatedListing.safetyCheckEvaluatedBy, 'admin_server_gemini');
  });

  test('enforces per-user rate limit (10 calls/hour) returning 429 Too Many Requests', async () => {
    const userToken = 'demo-token-rate-limit-user';

    // Perform 10 requests which should succeed
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${baseUrl}/api/safety-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ listingId: 'listing-valid-fresh' }),
      });
      assert.equal(res.status, 200, `Request ${i + 1} should succeed within quota`);
    }

    // 11th request must be rejected with 429
    const limitedRes = await fetch(`${baseUrl}/api/safety-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ listingId: 'listing-valid-fresh' }),
    });

    assert.equal(limitedRes.status, 429);
    const errorBody = await limitedRes.json();
    assert.ok(errorBody.error.includes('Rate limit exceeded'));
  });
});
