import { describe, it, expect } from 'vitest'
import { generateVerificationHash } from '@/lib/certifications/verification'

describe('generateVerificationHash', () => {
  const certId = '550e8400-e29b-41d4-a716-446655440000'
  const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
  const issuedAt = '2026-03-13T12:00:00.000Z'

  it('returns a 64-character hex string (SHA-256)', () => {
    const hash = generateVerificationHash(certId, userId, issuedAt)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toHaveLength(64)
  })

  it('is deterministic — same inputs produce same hash', () => {
    const hash1 = generateVerificationHash(certId, userId, issuedAt)
    const hash2 = generateVerificationHash(certId, userId, issuedAt)
    expect(hash1).toBe(hash2)
  })

  it('different inputs produce different hashes', () => {
    const hash1 = generateVerificationHash(certId, userId, issuedAt)
    const hash2 = generateVerificationHash('different-cert-id', userId, issuedAt)
    const hash3 = generateVerificationHash(certId, 'different-user-id', issuedAt)
    const hash4 = generateVerificationHash(certId, userId, '2025-01-01T00:00:00.000Z')

    expect(hash1).not.toBe(hash2)
    expect(hash1).not.toBe(hash3)
    expect(hash1).not.toBe(hash4)
  })

  it('handles different timestamp formats consistently', () => {
    // Same exact string input always yields same output
    const ts1 = '2026-03-13T12:00:00Z'
    const ts2 = '2026-03-13T12:00:00Z'
    const hash1 = generateVerificationHash(certId, userId, ts1)
    const hash2 = generateVerificationHash(certId, userId, ts2)
    expect(hash1).toBe(hash2)

    // Different string representations produce different hashes (no normalization)
    const ts3 = '2026-03-13T12:00:00.000Z'
    const hash3 = generateVerificationHash(certId, userId, ts3)
    expect(hash1).not.toBe(hash3)
  })
})
