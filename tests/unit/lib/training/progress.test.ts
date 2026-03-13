import { describe, it, expect } from 'vitest'
import {
  calculateProgress,
  isLessonAccessible,
  getNextLessonSlug,
  formatDuration,
} from '@/lib/training/progress'

describe('calculateProgress', () => {
  it('returns 0 when totalCount is 0', () => {
    expect(calculateProgress(0, 0)).toBe(0)
  })

  it('returns 0 when completedCount is 0', () => {
    expect(calculateProgress(0, 10)).toBe(0)
  })

  it('returns 50 for 5/10', () => {
    expect(calculateProgress(5, 10)).toBe(50)
  })

  it('returns 100 for 10/10', () => {
    expect(calculateProgress(10, 10)).toBe(100)
  })

  it('rounds to nearest integer (1/3 = 33)', () => {
    expect(calculateProgress(1, 3)).toBe(33)
  })

  it('caps overflow at 100', () => {
    expect(calculateProgress(15, 10)).toBe(100)
  })

  it('returns 0 when totalCount is negative', () => {
    expect(calculateProgress(5, -1)).toBe(0)
  })
})

describe('isLessonAccessible', () => {
  const lessonIds = ['a', 'b', 'c', 'd']

  it('returns true for any lesson in free mode', () => {
    expect(isLessonAccessible(3, [], lessonIds, 'free')).toBe(true)
  })

  it('returns true for first lesson in sequential mode regardless of completion', () => {
    expect(isLessonAccessible(0, [], lessonIds, 'sequential')).toBe(true)
  })

  it('returns true in sequential mode when all prior lessons are completed', () => {
    expect(isLessonAccessible(2, ['a', 'b'], lessonIds, 'sequential')).toBe(true)
  })

  it('returns false in sequential mode when prior lesson is incomplete', () => {
    expect(isLessonAccessible(2, ['a'], lessonIds, 'sequential')).toBe(false)
  })

  it('returns false in sequential mode when no lessons are completed (index > 0)', () => {
    expect(isLessonAccessible(1, [], lessonIds, 'sequential')).toBe(false)
  })

  it('returns true for second lesson when first is completed in sequential mode', () => {
    expect(isLessonAccessible(1, ['a'], lessonIds, 'sequential')).toBe(true)
  })
})

describe('getNextLessonSlug', () => {
  const lessons = [
    { slug: 'intro', id: '1' },
    { slug: 'basics', id: '2' },
    { slug: 'advanced', id: '3' },
  ]

  it('returns the first lesson slug when none are completed', () => {
    expect(getNextLessonSlug(lessons, [])).toBe('intro')
  })

  it('returns the first incomplete lesson slug', () => {
    expect(getNextLessonSlug(lessons, ['1'])).toBe('basics')
  })

  it('returns null when all lessons are completed', () => {
    expect(getNextLessonSlug(lessons, ['1', '2', '3'])).toBeNull()
  })

  it('returns null for empty lessons array', () => {
    expect(getNextLessonSlug([], [])).toBeNull()
  })

  it('skips completed lessons and returns next incomplete', () => {
    expect(getNextLessonSlug(lessons, ['1', '3'])).toBe('basics')
  })
})

describe('formatDuration', () => {
  it('returns "0m" for 0 minutes', () => {
    expect(formatDuration(0)).toBe('0m')
  })

  it('returns minutes only for less than an hour', () => {
    expect(formatDuration(30)).toBe('30m')
  })

  it('returns hours only for exact hours', () => {
    expect(formatDuration(60)).toBe('1h')
  })

  it('returns hours and minutes for mixed values', () => {
    expect(formatDuration(90)).toBe('1h 30m')
  })

  it('handles multiple hours', () => {
    expect(formatDuration(120)).toBe('2h')
  })

  it('returns "0m" for negative values', () => {
    expect(formatDuration(-10)).toBe('0m')
  })
})
