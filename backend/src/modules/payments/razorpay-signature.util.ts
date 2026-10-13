import * as crypto from 'crypto';

/**
 * Verifies a Razorpay webhook signature: HMAC-SHA256 of the RAW request body,
 * compared in constant time.
 */
export function verifyRazorpaySignature(rawBody: Buffer | string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return received.length === expectedBuffer.length && crypto.timingSafeEqual(received, expectedBuffer);
}
