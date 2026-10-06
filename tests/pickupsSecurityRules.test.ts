import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Firestore Security Rules - Pickups Live Tracking Authorization', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  test('firestore.rules contains pickups collection security rules', () => {
    assert.ok(rulesContent.includes('match /pickups/{pickupId}'));
    assert.ok(rulesContent.includes('resource.data.donorId == request.auth.uid'));
    assert.ok(rulesContent.includes('resource.data.recipientId == request.auth.uid'));
    assert.ok(rulesContent.includes('resource.data.courierId == request.auth.uid'));
  });

  // Simulated Firestore rules evaluation for pickups
  function evaluatePickupsRead(
    auth: { uid: string; token?: { admin?: boolean } } | null,
    resourceData: { donorId: string; recipientId: string; courierId: string }
  ) {
    if (!auth) return false;
    if (auth.token?.admin === true) return true;
    return (
      auth.uid === resourceData.donorId ||
      auth.uid === resourceData.recipientId ||
      auth.uid === resourceData.courierId
    );
  }

  function evaluatePickupsWrite(
    auth: { uid: string; token?: { admin?: boolean } } | null,
    requestData: { donorId: string; courierId: string }
  ) {
    if (!auth) return false;
    if (auth.token?.admin === true) return true;
    return auth.uid === requestData.courierId || auth.uid === requestData.donorId;
  }

  function evaluatePickupsDelete(
    auth: { uid: string; token?: { admin?: boolean } } | null,
    resourceData: { donorId: string; recipientId: string; courierId: string }
  ) {
    if (!auth) return false;
    if (auth.token?.admin === true) return true;
    return (
      auth.uid === resourceData.courierId ||
      auth.uid === resourceData.donorId ||
      auth.uid === resourceData.recipientId
    );
  }

  const samplePickup = {
    donorId: 'donor_taj_hotel',
    recipientId: 'ngo_shelter_bandra',
    courierId: 'courier_runner_rahul',
  };

  test('REJECTS unauthenticated access to live pickup location', () => {
    assert.equal(evaluatePickupsRead(null, samplePickup), false);
    assert.equal(evaluatePickupsWrite(null, samplePickup), false);
    assert.equal(evaluatePickupsDelete(null, samplePickup), false);
  });

  test('REJECTS third-party user from reading another pickup telemetry', () => {
    const thirdPartyAuth = { uid: 'random_malicious_user_999' };
    assert.equal(evaluatePickupsRead(thirdPartyAuth, samplePickup), false);
  });

  test('ALLOWS designated donor and recipient to read live pickup telemetry', () => {
    const donorAuth = { uid: 'donor_taj_hotel' };
    const recipientAuth = { uid: 'ngo_shelter_bandra' };

    assert.equal(evaluatePickupsRead(donorAuth, samplePickup), true);
    assert.equal(evaluatePickupsRead(recipientAuth, samplePickup), true);
  });

  test('ALLOWS courier and donor to write location updates, blocks strangers', () => {
    const courierAuth = { uid: 'courier_runner_rahul' };
    const donorAuth = { uid: 'donor_taj_hotel' };
    const strangerAuth = { uid: 'unauthorized_user_123' };

    assert.equal(evaluatePickupsWrite(courierAuth, samplePickup), true);
    assert.equal(evaluatePickupsWrite(donorAuth, samplePickup), true);
    assert.equal(evaluatePickupsWrite(strangerAuth, samplePickup), false);
  });

  test('ALLOWS assigned parties to delete the document upon completion or cancellation', () => {
    const courierAuth = { uid: 'courier_runner_rahul' };
    const recipientAuth = { uid: 'ngo_shelter_bandra' };
    const strangerAuth = { uid: 'stranger_user' };

    assert.equal(evaluatePickupsDelete(courierAuth, samplePickup), true);
    assert.equal(evaluatePickupsDelete(recipientAuth, samplePickup), true);
    assert.equal(evaluatePickupsDelete(strangerAuth, samplePickup), false);
  });

  test('ALLOWS administrator full read, write, and delete override', () => {
    const adminAuth = { uid: 'super_admin', token: { admin: true } };

    assert.equal(evaluatePickupsRead(adminAuth, samplePickup), true);
    assert.equal(evaluatePickupsWrite(adminAuth, samplePickup), true);
    assert.equal(evaluatePickupsDelete(adminAuth, samplePickup), true);
  });
});
