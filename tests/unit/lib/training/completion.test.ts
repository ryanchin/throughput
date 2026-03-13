import { describe, it, expect } from 'vitest'
import {
  isCourseDone,
  buildQuizBreakdown,
  type LessonCompletionInfo,
  type QuizAttemptInfo,
} from '@/lib/training/completion'

describe('isCourseDone', () => {
  it('returns false for empty lessons array', () => {
    const result = isCourseDone([], new Set())
    expect(result.isComplete).toBe(false)
    expect(result.lessonsTotal).toBe(0)
  })

  it('returns true when all lessons completed and all quizzes attempted', () => {
    const lessons: LessonCompletionInfo[] = [
      { lessonId: 'l1', hasQuiz: true, isCompleted: true },
      { lessonId: 'l2', hasQuiz: true, isCompleted: true },
      { lessonId: 'l3', hasQuiz: false, isCompleted: true },
    ]
    const result = isCourseDone(lessons, new Set(['l1', 'l2']))
    expect(result.isComplete).toBe(true)
    expect(result.allLessonsDone).toBe(true)
    expect(result.allQuizzesAttempted).toBe(true)
    expect(result.lessonsCompleted).toBe(3)
    expect(result.lessonsTotal).toBe(3)
    expect(result.quizzesAttempted).toBe(2)
    expect(result.quizzesTotal).toBe(2)
  })

  it('returns false when lessons incomplete', () => {
    const lessons: LessonCompletionInfo[] = [
      { lessonId: 'l1', hasQuiz: false, isCompleted: true },
      { lessonId: 'l2', hasQuiz: false, isCompleted: false },
    ]
    const result = isCourseDone(lessons, new Set())
    expect(result.isComplete).toBe(false)
    expect(result.allLessonsDone).toBe(false)
    expect(result.lessonsCompleted).toBe(1)
  })

  it('returns false when quizzes not attempted', () => {
    const lessons: LessonCompletionInfo[] = [
      { lessonId: 'l1', hasQuiz: true, isCompleted: true },
      { lessonId: 'l2', hasQuiz: true, isCompleted: true },
    ]
    const result = isCourseDone(lessons, new Set(['l1'])) // l2 quiz not attempted
    expect(result.isComplete).toBe(false)
    expect(result.allLessonsDone).toBe(true)
    expect(result.allQuizzesAttempted).toBe(false)
    expect(result.quizzesAttempted).toBe(1)
    expect(result.quizzesTotal).toBe(2)
  })

  it('returns true when no quizzes exist and all lessons done', () => {
    const lessons: LessonCompletionInfo[] = [
      { lessonId: 'l1', hasQuiz: false, isCompleted: true },
      { lessonId: 'l2', hasQuiz: false, isCompleted: true },
    ]
    const result = isCourseDone(lessons, new Set())
    expect(result.isComplete).toBe(true)
    expect(result.quizzesTotal).toBe(0)
    expect(result.quizzesAttempted).toBe(0)
  })

  it('returns false when all quizzes attempted but lessons incomplete', () => {
    const lessons: LessonCompletionInfo[] = [
      { lessonId: 'l1', hasQuiz: true, isCompleted: true },
      { lessonId: 'l2', hasQuiz: false, isCompleted: false },
    ]
    const result = isCourseDone(lessons, new Set(['l1']))
    expect(result.isComplete).toBe(false)
    expect(result.allLessonsDone).toBe(false)
    expect(result.allQuizzesAttempted).toBe(true)
  })

  it('handles single lesson course', () => {
    const lessons: LessonCompletionInfo[] = [
      { lessonId: 'l1', hasQuiz: true, isCompleted: true },
    ]
    const result = isCourseDone(lessons, new Set(['l1']))
    expect(result.isComplete).toBe(true)
    expect(result.lessonsTotal).toBe(1)
    expect(result.quizzesTotal).toBe(1)
  })
})

describe('buildQuizBreakdown', () => {
  it('returns empty breakdown for no attempts', () => {
    const result = buildQuizBreakdown([])
    expect(result.breakdown).toEqual([])
    expect(result.finalScore).toBe(0)
    expect(result.totalEarned).toBe(0)
    expect(result.totalPossible).toBe(0)
  })

  it('builds breakdown from single quiz attempt', () => {
    const attempts: QuizAttemptInfo[] = [
      {
        quizId: 'q1',
        quizTitle: 'Quiz 1',
        lessonId: 'l1',
        lessonTitle: 'Lesson 1',
        score: 80,
        passed: true,
        totalPoints: 100,
        earnedPoints: 80,
      },
    ]
    const result = buildQuizBreakdown(attempts)
    expect(result.breakdown).toHaveLength(1)
    expect(result.breakdown[0].quizTitle).toBe('Quiz 1')
    expect(result.breakdown[0].percentage).toBe(80)
    expect(result.breakdown[0].passed).toBe(true)
    expect(result.finalScore).toBe(80)
    expect(result.totalEarned).toBe(80)
    expect(result.totalPossible).toBe(100)
  })

  it('uses best attempt when multiple exist per quiz', () => {
    const attempts: QuizAttemptInfo[] = [
      {
        quizId: 'q1', quizTitle: 'Quiz 1', lessonId: 'l1', lessonTitle: 'Lesson 1',
        score: 50, passed: false, totalPoints: 100, earnedPoints: 50,
      },
      {
        quizId: 'q1', quizTitle: 'Quiz 1', lessonId: 'l1', lessonTitle: 'Lesson 1',
        score: 90, passed: true, totalPoints: 100, earnedPoints: 90,
      },
    ]
    const result = buildQuizBreakdown(attempts)
    expect(result.breakdown).toHaveLength(1)
    expect(result.breakdown[0].percentage).toBe(90)
    expect(result.finalScore).toBe(90)
  })

  it('calculates weighted average across multiple quizzes', () => {
    const attempts: QuizAttemptInfo[] = [
      {
        quizId: 'q1', quizTitle: 'Quiz 1', lessonId: 'l1', lessonTitle: 'Lesson 1',
        score: 80, passed: true, totalPoints: 50, earnedPoints: 40,
      },
      {
        quizId: 'q2', quizTitle: 'Quiz 2', lessonId: 'l2', lessonTitle: 'Lesson 2',
        score: 60, passed: false, totalPoints: 50, earnedPoints: 30,
      },
    ]
    const result = buildQuizBreakdown(attempts)
    expect(result.breakdown).toHaveLength(2)
    expect(result.totalEarned).toBe(70)
    expect(result.totalPossible).toBe(100)
    expect(result.finalScore).toBe(70)
  })

  it('handles quiz with null title gracefully', () => {
    const attempts: QuizAttemptInfo[] = [
      {
        quizId: 'q1', quizTitle: null, lessonId: 'l1', lessonTitle: 'Lesson 1',
        score: 100, passed: true, totalPoints: 10, earnedPoints: 10,
      },
    ]
    const result = buildQuizBreakdown(attempts)
    expect(result.breakdown[0].quizTitle).toBe('Quiz')
  })

  it('handles zero total points quiz', () => {
    const attempts: QuizAttemptInfo[] = [
      {
        quizId: 'q1', quizTitle: 'Quiz 1', lessonId: 'l1', lessonTitle: 'Lesson 1',
        score: 0, passed: false, totalPoints: 0, earnedPoints: 0,
      },
    ]
    const result = buildQuizBreakdown(attempts)
    expect(result.breakdown[0].percentage).toBe(0)
    expect(result.finalScore).toBe(0)
  })

  it('caps final score at 100', () => {
    const attempts: QuizAttemptInfo[] = [
      {
        quizId: 'q1', quizTitle: 'Quiz 1', lessonId: 'l1', lessonTitle: 'Lesson 1',
        score: 100, passed: true, totalPoints: 10, earnedPoints: 11, // Overflow case
      },
    ]
    const result = buildQuizBreakdown(attempts)
    expect(result.finalScore).toBeLessThanOrEqual(100)
  })
})
