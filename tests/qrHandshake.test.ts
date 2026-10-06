import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeQrCode,
  matrixToSvg,
  generateHandshakePin,
  createHandshakePayload,
  verifyHandshakePayload,
} from '../src/lib/qrCode.js';

describe('FoodLink QR Code & Handshake Verification', () => {
  test('encodes QR code into valid boolean matrix', () => {
    const text = 'FOODLINK_TEST_123';
    const matrix = encodeQrCode(text, 'M');

    assert.ok(matrix.size >= 21, 'Matrix size should be at least 21x21 for Version 1+');
    assert.equal(matrix.modules.length, matrix.size);
    assert.equal(matrix.modules[0].length, matrix.size);

    // Verify top-left finder pattern center is black
    assert.equal(matrix.modules[3][3], true);
    // Verify top-right finder pattern center is black
    assert.equal(matrix.modules[3][matrix.size - 4], true);
    // Verify bottom-left finder pattern center is black
    assert.equal(matrix.modules[matrix.size - 4][3], true);
  });

  test('converts QR matrix to scalable vector graphic (SVG)', () => {
    const matrix = encodeQrCode('https://foodlink.org', 'M');
    const svg = matrixToSvg(matrix, { size: 200, color: '#059669' });

    assert.ok(svg.includes('<svg'), 'SVG must contain opening tag');
    assert.ok(svg.includes('viewBox='), 'SVG must include viewBox');
    assert.ok(svg.includes('#059669'), 'SVG must include brand color fill');
    assert.ok(svg.endsWith('</svg>'), 'SVG must terminate with closing tag');
  });

  test('generates valid high-entropy handshake PINs', () => {
    const pickupPin = generateHandshakePin('PU');
    assert.ok(pickupPin.startsWith('FL-PU-'));
    assert.equal(pickupPin.length, 10);

    const deliveryPin = generateHandshakePin('DL');
    assert.ok(deliveryPin.startsWith('FL-DL-'));
    assert.equal(deliveryPin.length, 10);
  });

  test('creates and verifies valid JSON handshake payloads', () => {
    const listingId = 'listing-surplus-8821';
    const pin = 'FL-PU-9X42';
    const payload = createHandshakePayload({
      listingId,
      stage: 'pickup',
      code: pin,
      donorOrg: 'Taj Grand Dining',
    });

    const result = verifyHandshakePayload(payload, listingId, 'pickup', pin);
    assert.equal(result.isValid, true);
    assert.equal(result.payload?.stage, 'pickup');
    assert.equal(result.payload?.listingId, listingId);
  });

  test('rejects mismatched listing ID in QR scan', () => {
    const payload = createHandshakePayload({
      listingId: 'other-listing-9999',
      stage: 'pickup',
      code: 'FL-PU-1234',
    });

    const result = verifyHandshakePayload(payload, 'target-listing-0001', 'pickup', 'FL-PU-1234');
    assert.equal(result.isValid, false);
    assert.ok(result.error?.includes('Mismatched batch'));
  });

  test('rejects mismatched custody stage (e.g. pickup code at delivery)', () => {
    const payload = createHandshakePayload({
      listingId: 'listing-target-123',
      stage: 'pickup',
      code: 'FL-PU-1234',
    });

    const result = verifyHandshakePayload(payload, 'listing-target-123', 'delivery', 'FL-PU-1234');
    assert.equal(result.isValid, false);
    assert.ok(result.error?.includes('Incorrect custody stage'));
  });

  test('accepts manual fallback alphanumeric PIN verification', () => {
    const result = verifyHandshakePayload('FL-DL-4892', 'listing-abc', 'delivery', 'FL-DL-4892');
    assert.equal(result.isValid, true);
  });
});
