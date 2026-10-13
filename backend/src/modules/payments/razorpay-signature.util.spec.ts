// ==============================================================================
// TEST SUITE: RAZORPAY WEBHOOK SIGNATURE VERIFICATION
// Covers verifyRazorpaySignature (HMAC-SHA256 over the raw body, constant-time compare).
// ==============================================================================

import * as crypto from 'crypto';
import { verifyRazorpaySignature } from './razorpay-signature.util';

describe('verifyRazorpaySignature', () => {
  const secret = 'whsec_test_secret';
  const rawBody = Buffer.from(
    JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', amount: 11900, notes: { order_number: 'ORD-LKO-20261014-00001' } } } },
    })
  );
  const sign = (body: Buffer | string, key: string) => crypto.createHmac('sha256', key).update(body).digest('hex');

  test('accepts a genuine signature', () => {
    expect(verifyRazorpaySignature(rawBody, sign(rawBody, secret), secret)).toBe(true);
  });

  test('rejects a tampered body', () => {
    const tampered = Buffer.from(rawBody.toString().replace('11900', '100'));
    expect(verifyRazorpaySignature(tampered, sign(rawBody, secret), secret)).toBe(false);
  });

  test('rejects a signature made with the wrong secret', () => {
    expect(verifyRazorpaySignature(rawBody, sign(rawBody, 'other'), secret)).toBe(false);
  });

  test('rejects a signature of the wrong length without throwing', () => {
    expect(verifyRazorpaySignature(rawBody, 'abc', secret)).toBe(false);
  });
});
