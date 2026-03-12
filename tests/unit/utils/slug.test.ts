import { describe, it, expect } from 'vitest'
import { generateSlug } from '@/lib/utils/slug'

describe('generateSlug', () => {
  it('converts a basic title to lowercase kebab-case', () => {
    expect(generateSlug('Hello World')).toBe('hello-world')
  })

  it('strips special characters', () => {
    expect(generateSlug('Hello! @World# $2024')).toBe('hello-world-2024')
  })

  it('strips parentheses, brackets, and punctuation', () => {
    expect(generateSlug('Course (Advanced) [v2]')).toBe('course-advanced-v2')
  })

  it('collapses multiple spaces into a single hyphen', () => {
    expect(generateSlug('hello    world')).toBe('hello-world')
  })

  it('collapses multiple hyphens into a single hyphen', () => {
    expect(generateSlug('hello---world')).toBe('hello-world')
  })

  it('collapses mixed spaces and hyphens', () => {
    expect(generateSlug('hello - - world')).toBe('hello-world')
  })

  it('trims leading hyphens', () => {
    expect(generateSlug('---hello')).toBe('hello')
  })

  it('trims trailing hyphens', () => {
    expect(generateSlug('hello---')).toBe('hello')
  })

  it('trims leading and trailing whitespace', () => {
    expect(generateSlug('  Hello World  ')).toBe('hello-world')
  })

  it('strips unicode/accented characters (non-word chars)', () => {
    // The regex [^\w\s-] strips non-ASCII word characters
    expect(generateSlug('Café Résumé')).toBe('caf-rsum')
  })

  it('handles emoji by stripping them', () => {
    expect(generateSlug('Hello 🌍 World')).toBe('hello-world')
  })

  it('returns empty string for empty input', () => {
    expect(generateSlug('')).toBe('')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(generateSlug('   ')).toBe('')
  })

  it('returns empty string for special-characters-only input', () => {
    expect(generateSlug('!@#$%^&*()')).toBe('')
  })

  it('leaves already kebab-case input unchanged', () => {
    expect(generateSlug('hello-world')).toBe('hello-world')
  })

  it('preserves numbers', () => {
    expect(generateSlug('Lesson 1 Introduction')).toBe('lesson-1-introduction')
  })

  it('handles numbers at the start', () => {
    expect(generateSlug('42 Things to Know')).toBe('42-things-to-know')
  })

  it('handles a title that is only numbers', () => {
    expect(generateSlug('12345')).toBe('12345')
  })

  it('converts underscores to hyphens', () => {
    expect(generateSlug('hello_world')).toBe('hello-world')
  })

  it('converts multiple underscores to a single hyphen', () => {
    expect(generateSlug('hello___world')).toBe('hello-world')
  })

  it('converts mixed underscores and spaces', () => {
    expect(generateSlug('hello_ _world')).toBe('hello-world')
  })

  it('handles a realistic course title', () => {
    expect(generateSlug('AAVA Sprint Planning: Advanced Techniques (2024)'))
      .toBe('aava-sprint-planning-advanced-techniques-2024')
  })

  it('handles single character input', () => {
    expect(generateSlug('A')).toBe('a')
  })

  it('handles single hyphen input', () => {
    expect(generateSlug('-')).toBe('')
  })
})
