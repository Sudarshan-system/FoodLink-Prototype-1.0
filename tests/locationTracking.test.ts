import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldWriteLocation,
  calculateHaversineDistanceKm,
  calculateEtaMinutes,
  isPickupSessionExpired,
  LOCATION_THROTTLE_MS,
  PICKUP_SESSION_TIMEOUT_MS,
} from '../src/lib/locationTracking.ts';

describe('Location Tracking Utilities & 10s Throttling Logic', () => {
  test('allows first write when no previous timestamp exists (0)', () => {
    assert.equal(shouldWriteLocation(0, Date.now()), true);
  });

  test('blocks write if less than 10 seconds (10,000ms) have elapsed', () => {
    const now = 1700000000000;
    const recentWrite = now - 5000; // 5 seconds ago
    assert.equal(shouldWriteLocation(recentWrite, now), false);

    const veryRecentWrite = now - 9999; // 9.999 seconds ago
    assert.equal(shouldWriteLocation(veryRecentWrite, now), false);
  });

  test('allows write once 10 seconds (10,000ms) or more have elapsed', () => {
    const now = 1700000000000;
    const writeAt10s = now - 10000; // Exactly 10s ago
    assert.equal(shouldWriteLocation(writeAt10s, now), true);

    const writeAt15s = now - 15000; // 15s ago
    assert.equal(shouldWriteLocation(writeAt15s, now), true);
  });

  test('calculates accurate Haversine distance between Mumbai coordinates', () => {
    // Worli (19.0178, 72.8178) to Bandra West (19.0596, 72.8295) ~4.8 km
    const distanceKm = calculateHaversineDistanceKm(19.0178, 72.8178, 19.0596, 72.8295);
    assert.ok(distanceKm >= 4.5 && distanceKm <= 5.2, `Expected ~4.8 km, got ${distanceKm}`);
  });

  test('returns 0 distance for identical coordinates', () => {
    const dist = calculateHaversineDistanceKm(28.6139, 77.209, 28.6139, 77.209);
    assert.equal(dist, 0);
  });

  test('calculates accurate ETA minutes based on distance and speed', () => {
    // 5 km at 20 km/h = 15 minutes
    const eta15 = calculateEtaMinutes(5, 20);
    assert.equal(eta15, 15);

    // 10 km at default speed (22 km/h) = ~27 minutes
    const etaDefault = calculateEtaMinutes(10);
    assert.equal(etaDefault, 27);

    // Arrived at destination (< 50 meters) returns 0 min
    const etaArrived = calculateEtaMinutes(0.02);
    assert.equal(etaArrived, 0);
  });

  test('detects active vs expired pickup sessions using 45-minute timeout', () => {
    const now = 1700000000000;

    // Active session started 20 minutes ago
    const started20MinAgo = now - 20 * 60 * 1000;
    assert.equal(isPickupSessionExpired(started20MinAgo, now), false);

    // Expired session started 46 minutes ago
    const started46MinAgo = now - 46 * 60 * 1000;
    assert.equal(isPickupSessionExpired(started46MinAgo, now), true);

    // Invalid timestamp defaults to expired
    assert.equal(isPickupSessionExpired(0, now), true);
  });
});
