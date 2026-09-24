import crypto from "node:crypto";

/**
 * Constant-time comparison of two strings. Returns false (never throws)
 * on any length mismatch, so callers don't leak byte lengths.
 */
export function safeEqualStrings(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
