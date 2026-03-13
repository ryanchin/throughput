import { describe, it, expect } from 'vitest'
import { generateCertNumber, parseCertNumber } from '@/lib/certifications/cert-number'

describe('generateCertNumber', () => {
  it('generates correct format AAVA-YYYY-NNNNNN', () => {
    const result = generateCertNumber(2026, 42)
    expect(result).toMatch(/^AAVA-\d{4}-\d{6}$/)
    expect(result).toBe('AAVA-2026-000042')
  })

  it('zero-pads the sequence to 6 digits', () => {
    expect(generateCertNumber(2026, 5)).toBe('AAVA-2026-000005')
    expect(generateCertNumber(2026, 123)).toBe('AAVA-2026-000123')
  })

  it('handles sequence number 1', () => {
    expect(generateCertNumber(2026, 1)).toBe('AAVA-2026-000001')
  })

  it('handles large sequence numbers (999999)', () => {
    expect(generateCertNumber(2026, 999999)).toBe('AAVA-2026-999999')
  })

  it('uses the provided year', () => {
    expect(generateCertNumber(2024, 1)).toBe('AAVA-2024-000001')
    expect(generateCertNumber(2030, 1)).toBe('AAVA-2030-000001')
  })
})

describe('parseCertNumber', () => {
  it('parses a valid cert number correctly', () => {
    const result = parseCertNumber('AAVA-2026-000042')
    expect(result).toEqual({ year: 2026, sequence: 42 })
  })

  it('returns null for invalid format', () => {
    expect(parseCertNumber('INVALID')).toBeNull()
    expect(parseCertNumber('AAVA-26-000042')).toBeNull()
    expect(parseCertNumber('AAVA-2026-42')).toBeNull()
    expect(parseCertNumber('aava-2026-000042')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseCertNumber('')).toBeNull()
  })

  it('extracts correct year and sequence', () => {
    expect(parseCertNumber('AAVA-2024-000001')).toEqual({ year: 2024, sequence: 1 })
    expect(parseCertNumber('AAVA-2030-999999')).toEqual({ year: 2030, sequence: 999999 })
    expect(parseCertNumber('AAVA-2026-012345')).toEqual({ year: 2026, sequence: 12345 })
  })
})
