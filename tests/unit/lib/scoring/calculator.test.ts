import { describe, it, expect } from 'vitest'
import {
  calculateCourseScore,
  calculateQuizScore,
  type QuizScore,
} from '@/lib/scoring/calculator'

describe('calculateCourseScore', () => {
  it('returns { score: 0, passed: false } for empty array', () => {
    expect(calculateCourseScore([])).toEqual({ score: 0, passed: false })
  })

  it('calculates correct percentage from earned/total across quizzes', () => {
    const quizScores: QuizScore[] = [
      { quizId: 'q1', lessonId: 'l1', earnedPoints: 8, totalPoints: 10, passed: true },
      { quizId: 'q2', lessonId: 'l2', earnedPoints: 6, totalPoints: 10, passed: true },
    ]
    // (8 + 6) / (10 + 10) = 70%
    expect(calculateCourseScore(quizScores)).toEqual({ score: 70, passed: true })
  })

  it('passes when score >= coursePassingScore', () => {
    const quizScores: QuizScore[] = [
      { quizId: 'q1', lessonId: 'l1', earnedPoints: 7, totalPoints: 10, passed: true },
    ]
    expect(calculateCourseScore(quizScores, 70)).toEqual({ score: 70, passed: true })
  })

  it('fails when score < coursePassingScore', () => {
    const quizScores: QuizScore[] = [
      { quizId: 'q1', lessonId: 'l1', earnedPoints: 6, totalPoints: 10, passed: false },
    ]
    expect(calculateCourseScore(quizScores, 70)).toEqual({ score: 60, passed: false })
  })

  it('uses default passing score of 70', () => {
    const quizScores: QuizScore[] = [
      { quizId: 'q1', lessonId: 'l1', earnedPoints: 69, totalPoints: 100, passed: false },
    ]
    const result = calculateCourseScore(quizScores)
    expect(result.passed).toBe(false)

    const passing: QuizScore[] = [
      { quizId: 'q1', lessonId: 'l1', earnedPoints: 70, totalPoints: 100, passed: true },
    ]
    expect(calculateCourseScore(passing).passed).toBe(true)
  })

  it('custom passing score works', () => {
    const quizScores: QuizScore[] = [
      { quizId: 'q1', lessonId: 'l1', earnedPoints: 80, totalPoints: 100, passed: true },
    ]
    expect(calculateCourseScore(quizScores, 90)).toEqual({ score: 80, passed: false })
    expect(calculateCourseScore(quizScores, 80)).toEqual({ score: 80, passed: true })
  })

  it('caps score at 100', () => {
    const quizScores: QuizScore[] = [
      { quizId: 'q1', lessonId: 'l1', earnedPoints: 110, totalPoints: 100, passed: true },
    ]
    expect(calculateCourseScore(quizScores).score).toBe(100)
  })

  it('handles single quiz', () => {
    const quizScores: QuizScore[] = [
      { quizId: 'q1', lessonId: 'l1', earnedPoints: 9, totalPoints: 10, passed: true },
    ]
    expect(calculateCourseScore(quizScores)).toEqual({ score: 90, passed: true })
  })

  it('handles totalPossible = 0', () => {
    const quizScores: QuizScore[] = [
      { quizId: 'q1', lessonId: 'l1', earnedPoints: 0, totalPoints: 0, passed: false },
    ]
    expect(calculateCourseScore(quizScores)).toEqual({ score: 0, passed: false })
  })
})

describe('calculateQuizScore', () => {
  it('returns { score: 0, passed: false, earnedPoints: 0 } for empty responses', () => {
    expect(calculateQuizScore([], 100)).toEqual({
      score: 0,
      passed: false,
      earnedPoints: 0,
    })
  })

  it('calculates percentage correctly', () => {
    const responses = [{ points_earned: 8 }, { points_earned: 7 }]
    // 15 / 20 = 75%
    expect(calculateQuizScore(responses, 20)).toEqual({
      score: 75,
      passed: true,
      earnedPoints: 15,
    })
  })

  it('passes at exactly passing score', () => {
    const responses = [{ points_earned: 70 }]
    const result = calculateQuizScore(responses, 100, 70)
    expect(result.passed).toBe(true)
    expect(result.score).toBe(70)
  })

  it('fails just below passing score', () => {
    const responses = [{ points_earned: 69 }]
    const result = calculateQuizScore(responses, 100, 70)
    expect(result.passed).toBe(false)
    expect(result.score).toBe(69)
  })

  it('uses default passing score of 70', () => {
    const failing = [{ points_earned: 69 }]
    expect(calculateQuizScore(failing, 100).passed).toBe(false)

    const passing = [{ points_earned: 70 }]
    expect(calculateQuizScore(passing, 100).passed).toBe(true)
  })

  it('custom passing score works', () => {
    const responses = [{ points_earned: 85 }]
    expect(calculateQuizScore(responses, 100, 90).passed).toBe(false)
    expect(calculateQuizScore(responses, 100, 85).passed).toBe(true)
  })

  it('handles totalPoints = 0', () => {
    const responses = [{ points_earned: 5 }]
    expect(calculateQuizScore(responses, 0)).toEqual({
      score: 0,
      passed: false,
      earnedPoints: 0,
    })
  })

  it('returns correct earnedPoints sum', () => {
    const responses = [
      { points_earned: 10 },
      { points_earned: 5 },
      { points_earned: 3 },
    ]
    const result = calculateQuizScore(responses, 30)
    expect(result.earnedPoints).toBe(18)
  })
})
