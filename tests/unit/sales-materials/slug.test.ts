import { describe, it, expect } from 'vitest'
import { generateSlug } from '@/lib/sales/validation'

describe('generateSlug', () => {
  it('converts a simple title to lowercase hyphenated slug', () => {
    expect(generateSlug('Enterprise Battle Card')).toBe('enterprise-battle-card')
  })

  it('converts uppercase letters to lowercase', () => {
    expect(generateSlug('ALL CAPS TITLE')).toBe('all-caps-title')
  })

  it('replaces special characters with hyphens', () => {
    expect(generateSlug('ROI Calculator (2024)')).toBe('roi-calculator-2024')
  })

  it('collapses multiple consecutive special characters into a single hyphen', () => {
    expect(generateSlug('hello---world')).toBe('hello-world')
    expect(generateSlug('hello   world')).toBe('hello-world')
    expect(generateSlug('hello...world')).toBe('hello-world')
  })

  it('trims leading hyphens', () => {
    expect(generateSlug('---leading')).toBe('leading')
  })

  it('trims trailing hyphens', () => {
    expect(generateSlug('trailing---')).toBe('trailing')
  })

  it('trims both leading and trailing hyphens', () => {
    expect(generateSlug('---both---')).toBe('both')
  })

  it('handles a title with only special characters', () => {
    expect(generateSlug('!@#$%^&*()')).toBe('')
  })

  it('handles an empty string', () => {
    expect(generateSlug('')).toBe('')
  })

  it('handles a title with numbers', () => {
    expect(generateSlug('Version 2.0 Release')).toBe('version-2-0-release')
  })

  it('preserves hyphens already in the title', () => {
    expect(generateSlug('well-formed-slug')).toBe('well-formed-slug')
  })

  it('handles mixed case and special characters', () => {
    expect(generateSlug("Ryan's Q4 Deck!")).toBe('ryan-s-q4-deck')
  })

  it('truncates output to 200 characters maximum', () => {
    const longTitle = 'a'.repeat(300)
    const slug = generateSlug(longTitle)
    expect(slug.length).toBeLessThanOrEqual(200)
  })

  it('handles a single word', () => {
    expect(generateSlug('Overview')).toBe('overview')
  })

  it('handles tabs and newlines', () => {
    expect(generateSlug("hello\tworld\nnow")).toBe('hello-world-now')
  })
})
