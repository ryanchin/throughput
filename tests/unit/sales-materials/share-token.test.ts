import { describe, it, expect } from 'vitest'
import { generateShareToken } from '@/lib/sales/share-token'

describe('generateShareToken', () => {
  it('returns a string of exactly 12 characters', () => {
    const token = generateShareToken()
    expect(token).toHaveLength(12)
  })

  it('contains only URL-safe base64 characters (alphanumeric, hyphen, underscore)', () => {
    // Run multiple times to increase confidence
    for (let i = 0; i < 100; i++) {
      const token = generateShareToken()
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it('generates unique tokens across multiple calls', () => {
    const tokens = new Set<string>()
    const count = 1000

    for (let i = 0; i < count; i++) {
      tokens.add(generateShareToken())
    }

    // With 72 bits of entropy, collisions in 1000 tokens are astronomically unlikely
    expect(tokens.size).toBe(count)
  })

  it('returns a different token on each call', () => {
    const first = generateShareToken()
    const second = generateShareToken()
    expect(first).not.toBe(second)
  })

  it('returns a string type', () => {
    const token = generateShareToken()
    expect(typeof token).toBe('string')
  })
})
