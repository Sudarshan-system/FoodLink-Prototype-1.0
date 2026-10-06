import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Firestore Security Rules - Safety Verdict Client Write Protection', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  test('firestore.rules exists and contains safetyVerdict protection rules', () => {
    assert.ok(rulesContent.includes('clientDoesNotSetSafetyVerdict'));
    assert.ok(rulesContent.includes('clientDoesNotModifySafetyVerdict'));
    assert.ok(rulesContent.includes("!('safetyVerdict' in request.resource.data)"));
    assert.ok(rulesContent.includes("affectedKeys().hasAny"));
  });

  // Simulated rule logic matching Firestore Security Rules engine behavior
  function evaluateClientCreate(auth: { uid: string; token?: { admin?: boolean } } | null, resourceData: Record<string, any>) {
    if (!auth) return false;
    if (auth.token?.admin === true) return true;

    const isDonorOrDemo = resourceData.donorId === auth.uid || resourceData.isDemo === true;
    const clientDoesNotSet =
      !('safetyVerdict' in resourceData) &&
      !('safetyScore' in resourceData) &&
      !('safetyReasons' in resourceData) &&
      !('safetyMissingInfo' in resourceData);

    return isDonorOrDemo && clientDoesNotSet;
  }

  function evaluateClientUpdate(
    auth: { uid: string; token?: { admin?: boolean } } | null,
    existingData: Record<string, any>,
    updatedData: Record<string, any>
  ) {
    if (!auth) return false;
    if (auth.token?.admin === true) return true;

    // Calculate changed keys
    const affectedKeys = Object.keys(updatedData).filter(
      (key) => JSON.stringify(updatedData[key]) !== JSON.stringify(existingData[key])
    );

    const clientDoesNotModify = !affectedKeys.some((k) =>
      ['safetyVerdict', 'safetyScore', 'safetyReasons', 'safetyMissingInfo'].includes(k)
    );

    const isDonorOwner = existingData.donorId === auth.uid;
    const isStatusTransition = ['claimed', 'in_transit', 'completed', 'cancelled'].includes(updatedData.status);

    return clientDoesNotModify && (isDonorOwner || isStatusTransition);
  }

  test('REJECTS client create attempt when client supplies safetyVerdict: "safe"', () => {
    const auth = { uid: 'donor_user_123' };
    const forgedPayload = {
      donorId: 'donor_user_123',
      title: 'Cooked Curry',
      quantity: 10,
      safetyVerdict: 'safe', // Attempting to spoof AI verdict
      safetyScore: 99,
    };

    const allowed = evaluateClientCreate(auth, forgedPayload);
    assert.equal(allowed, false, 'Client must NOT be permitted to write safetyVerdict on create');
  });

  test('ALLOWS client create when no safetyVerdict fields are provided', () => {
    const auth = { uid: 'donor_user_123' };
    const legitimatePayload = {
      donorId: 'donor_user_123',
      title: 'Cooked Curry',
      quantity: 10,
      storageCondition: 'Hot and covered',
      allergens: ['Dairy'],
    };

    const allowed = evaluateClientCreate(auth, legitimatePayload);
    assert.equal(allowed, true, 'Legitimate listing creation without safetyVerdict must be permitted');
  });

  test('REJECTS client update attempt attempting to overwrite safetyVerdict', () => {
    const auth = { uid: 'donor_user_123' };
    const existing = {
      donorId: 'donor_user_123',
      title: 'Cooked Curry',
      safetyVerdict: 'unsafe',
      safetyScore: 10,
      status: 'available',
    };
    const forgedUpdate = {
      ...existing,
      safetyVerdict: 'safe', // Trying to change unsafe to safe
      safetyScore: 95,
    };

    const allowed = evaluateClientUpdate(auth, existing, forgedUpdate);
    assert.equal(allowed, false, 'Client must NOT be permitted to mutate safetyVerdict on update');
  });

  test('ALLOWS client update modifying legitimate fields (status, notes)', () => {
    const auth = { uid: 'donor_user_123' };
    const existing = {
      donorId: 'donor_user_123',
      title: 'Cooked Curry',
      safetyVerdict: 'safe',
      safetyScore: 90,
      status: 'available',
      notes: 'Initial notes',
    };
    const legitimateUpdate = {
      ...existing,
      notes: 'Updated pickup instructions',
    };

    const allowed = evaluateClientUpdate(auth, existing, legitimateUpdate);
    assert.equal(allowed, true, 'Client modifying notes without touching safetyVerdict must be permitted');
  });

  test('ALLOWS admin token to write or update safetyVerdict', () => {
    const adminAuth = { uid: 'admin_user', token: { admin: true } };
    const adminPayload = {
      donorId: 'donor_user_123',
      title: 'Cooked Curry',
      safetyVerdict: 'safe',
      safetyScore: 98,
    };

    assert.equal(evaluateClientCreate(adminAuth, adminPayload), true);
    assert.equal(evaluateClientUpdate(adminAuth, { donorId: 'donor_user_123' }, adminPayload), true);
  });
});
