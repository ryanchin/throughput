import crypto from 'crypto'

/**
 * Generate a 12-character URL-safe share token with 72 bits of entropy.
 * Uses crypto.randomBytes for cryptographic randomness.
 */
export function generateShareToken(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12)
}
