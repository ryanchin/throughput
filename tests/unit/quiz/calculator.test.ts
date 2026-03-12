import { describe, it, expect } from 'vitest'
import { calculateTotalPoints, calculatePercentage } from '@/lib/quiz/calculator'

describe('calculateTotalPoints', () => {
  it('sums max_points across all questions', () => {
    const questions = [
      { max_points: 10 },
      { max_points: 20 },
      { max_points: 5 },
    ]
    expect(calculateTotalPoints(questions)).toBe(35)
  })

  it('returns 0 for an empty array', () => {
    expect(calculateTotalPoints([])).toBe(0)
  })

  it('handles a single question', () => {
    expect(calculateTotalPoints([{ max_points: 42 }])).toBe(42)
  })

  it('handles questions with 0 points', () => {
    const questions = [
      { max_points: 0 },
      { max_points: 10 },
      { max_points: 0 },
    ]
    expect(calculateTotalPoints(questions)).toBe(10)
  })
})

describe('calculatePercentage', () => {
  it('returns 100 when earned equals total', () => {
    expect(calculatePercentage(50, 50)).toBe(100)
  })

  it('returns 0 when earned is 0', () => {
    expect(calculatePercentage(0, 100)).toBe(0)
  })

  it('returns 0 when total is 0 (avoids division by zero)', () => {
    expect(calculatePercentage(10, 0)).toBe(0)
  })

  it('returns 0 when total is negative', () => {
    expect(calculatePercentage(10, -5)).toBe(0)
  })

  it('calculates correct percentage for partial score', () => {
    expect(calculatePercentage(7, 10)).toBe(70)
  })

  it('rounds to two decimal places', () => {
    // 1/3 = 33.333...% → should round to 33.33
    expect(calculatePercentage(1, 3)).toBe(33.33)
  })

  it('handles fractional earned values', () => {
    expect(calculatePercentage(7.5, 10)).toBe(75)
  })

  it('calculates 50% correctly', () => {
    expect(calculatePercentage(25, 50)).toBe(50)
  })
})
