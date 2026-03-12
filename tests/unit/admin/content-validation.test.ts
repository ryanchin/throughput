import { describe, it, expect } from 'vitest'
import {
  validateCoursePublish,
  validateCertTrackPublish,
  getUnpublishedLessons,
} from '@/lib/admin/content-validation'

describe('validateCoursePublish', () => {
  it('returns valid when at least one lesson is published', () => {
    const lessons = [
      { status: 'published' as const },
      { status: 'draft' as const },
    ]
    expect(validateCoursePublish(lessons)).toEqual({ valid: true })
  })

  it('returns invalid when no lessons are published', () => {
    const lessons = [
      { status: 'draft' as const },
      { status: 'draft' as const },
    ]
    const result = validateCoursePublish(lessons)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('no published lessons')
  })

  it('returns invalid when lessons array is empty', () => {
    const result = validateCoursePublish([])
    expect(result.valid).toBe(false)
    expect(result.error).toContain('no published lessons')
  })

  it('returns valid when all lessons are published', () => {
    const lessons = [
      { status: 'published' as const },
      { status: 'published' as const },
    ]
    expect(validateCoursePublish(lessons)).toEqual({ valid: true })
  })

  it('includes count details in error', () => {
    const lessons = [{ status: 'draft' as const }]
    const result = validateCoursePublish(lessons)
    expect(result.details).toBeDefined()
    expect(result.details![0]).toContain('1 lesson(s) found')
  })
})

describe('validateCertTrackPublish', () => {
  it('returns valid when question count meets requirement', () => {
    expect(validateCertTrackPublish(30, 30)).toEqual({ valid: true })
  })

  it('returns valid when question count exceeds requirement', () => {
    expect(validateCertTrackPublish(50, 30)).toEqual({ valid: true })
  })

  it('returns invalid when question count is below requirement', () => {
    const result = validateCertTrackPublish(10, 30)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('need at least 30 questions')
    expect(result.error).toContain('found 10')
  })

  it('returns invalid when question count is zero', () => {
    const result = validateCertTrackPublish(0, 30)
    expect(result.valid).toBe(false)
  })

  it('includes pool details in error', () => {
    const result = validateCertTrackPublish(5, 20)
    expect(result.details).toBeDefined()
    expect(result.details![0]).toContain('5/20')
  })
})

describe('getUnpublishedLessons', () => {
  it('returns only draft lessons', () => {
    const lessons = [
      { id: '1', title: 'Lesson 1', status: 'published' as const },
      { id: '2', title: 'Lesson 2', status: 'draft' as const },
      { id: '3', title: 'Lesson 3', status: 'draft' as const },
    ]
    const result = getUnpublishedLessons(lessons)
    expect(result).toHaveLength(2)
    expect(result.map(l => l.id)).toEqual(['2', '3'])
  })

  it('returns empty array when all are published', () => {
    const lessons = [
      { id: '1', title: 'Lesson 1', status: 'published' as const },
    ]
    expect(getUnpublishedLessons(lessons)).toEqual([])
  })

  it('returns all when none are published', () => {
    const lessons = [
      { id: '1', title: 'Lesson 1', status: 'draft' as const },
    ]
    expect(getUnpublishedLessons(lessons)).toEqual(lessons)
  })

  it('returns empty array for empty input', () => {
    expect(getUnpublishedLessons([])).toEqual([])
  })
})
