import { describe, it, expect } from 'vitest'
import { stratifiedSample, SamplableQuestion } from '@/lib/certifications/sampling'

function makeQuestion(id: string, difficulty: 'easy' | 'medium' | 'hard'): SamplableQuestion {
  return { id, difficulty }
}

function makePool(easy: number, medium: number, hard: number): SamplableQuestion[] {
  const pool: SamplableQuestion[] = []
  for (let i = 0; i < easy; i++) pool.push(makeQuestion(`easy-${i}`, 'easy'))
  for (let i = 0; i < medium; i++) pool.push(makeQuestion(`medium-${i}`, 'medium'))
  for (let i = 0; i < hard; i++) pool.push(makeQuestion(`hard-${i}`, 'hard'))
  return pool
}

describe('stratifiedSample', () => {
  it('returns correct count of questions', () => {
    const pool = makePool(10, 20, 10) // 40 total
    const result = stratifiedSample(pool, 20)
    expect(result).toHaveLength(20)
  })

  it('returns all questions when pool is smaller than count', () => {
    const pool = makePool(3, 3, 3) // 9 total
    const result = stratifiedSample(pool, 20)
    expect(result).toHaveLength(9)
    // All question IDs should be present
    const poolIds = pool.map(q => q.id).sort()
    expect([...result].sort()).toEqual(poolIds)
  })

  it('returns all questions when pool equals count', () => {
    const pool = makePool(5, 5, 5) // 15 total
    const result = stratifiedSample(pool, 15)
    expect(result).toHaveLength(15)
    const poolIds = pool.map(q => q.id).sort()
    expect([...result].sort()).toEqual(poolIds)
  })

  it('maintains proportional distribution across difficulty levels', () => {
    // Pool: 20 easy (40%), 20 medium (40%), 10 hard (20%) = 50 total
    const pool = makePool(20, 20, 10)
    const result = stratifiedSample(pool, 30)
    expect(result).toHaveLength(30)

    const easyCount = result.filter(id => id.startsWith('easy-')).length
    const mediumCount = result.filter(id => id.startsWith('medium-')).length
    const hardCount = result.filter(id => id.startsWith('hard-')).length

    // Expected: ~12 easy (40%), ~12 medium (40%), ~6 hard (20%)
    // Allow some variance from rounding
    expect(easyCount).toBeGreaterThanOrEqual(11)
    expect(easyCount).toBeLessThanOrEqual(13)
    expect(mediumCount).toBeGreaterThanOrEqual(11)
    expect(mediumCount).toBeLessThanOrEqual(13)
    expect(hardCount).toBeGreaterThanOrEqual(5)
    expect(hardCount).toBeLessThanOrEqual(7)
  })

  it('handles pool with only one difficulty level', () => {
    const pool = makePool(0, 20, 0) // all medium
    const result = stratifiedSample(pool, 10)
    expect(result).toHaveLength(10)
    expect(result.every(id => id.startsWith('medium-'))).toBe(true)
  })

  it('handles empty pool', () => {
    const result = stratifiedSample([], 10)
    expect(result).toHaveLength(0)
  })

  it('returns different results on multiple calls (randomized)', () => {
    const pool = makePool(20, 20, 20) // 60 total
    const results: string[][] = []
    for (let i = 0; i < 10; i++) {
      results.push(stratifiedSample(pool, 30))
    }
    // Check that not all 10 runs returned the same order
    const serialized = results.map(r => r.join(','))
    const unique = new Set(serialized)
    expect(unique.size).toBeGreaterThan(1)
  })

  it('includes questions from all difficulty levels present in pool', () => {
    const pool = makePool(10, 10, 10) // 30 total, evenly split
    const result = stratifiedSample(pool, 15)
    expect(result).toHaveLength(15)

    const hasEasy = result.some(id => id.startsWith('easy-'))
    const hasMedium = result.some(id => id.startsWith('medium-'))
    const hasHard = result.some(id => id.startsWith('hard-'))

    expect(hasEasy).toBe(true)
    expect(hasMedium).toBe(true)
    expect(hasHard).toBe(true)
  })
})
