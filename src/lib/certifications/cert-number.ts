/**
 * Generate a cert_number given the current year and a sequence number.
 * @param year - 4-digit year (e.g. 2026)
 * @param sequence - integer sequence number (1-based)
 * @returns formatted cert number, e.g. "AAVA-2026-000042"
 */
export function generateCertNumber(year: number, sequence: number): string {
  const paddedSeq = String(sequence).padStart(6, '0')
  return `AAVA-${year}-${paddedSeq}`
}

/**
 * Parse a cert_number back to its components.
 * Returns null if format is invalid.
 */
export function parseCertNumber(certNumber: string): { year: number; sequence: number } | null {
  const match = certNumber.match(/^AAVA-(\d{4})-(\d{6})$/)
  if (!match) return null
  return { year: parseInt(match[1], 10), sequence: parseInt(match[2], 10) }
}
