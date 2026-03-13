import { createHash } from 'crypto'

/**
 * Generate a SHA-256 verification hash for a certificate.
 * Deterministic: same inputs always produce same hash.
 *
 * @param certId - UUID of the certificate row
 * @param userId - UUID of the certified user
 * @param issuedAt - ISO 8601 timestamp string of issuance
 * @returns hex-encoded SHA-256 hash
 */
export function generateVerificationHash(certId: string, userId: string, issuedAt: string): string {
  return createHash('sha256')
    .update(certId + userId + issuedAt)
    .digest('hex')
}
