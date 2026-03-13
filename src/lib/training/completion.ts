/**
 * Course completion logic — pure functions with no DB calls.
 *
 * Determines whether a course is complete (all lessons done + all quizzes attempted)
 * and builds the quiz score breakdown for the scorecard.
 */

export interface LessonCompletionInfo {
  lessonId: string
  hasQuiz: boolean
  isCompleted: boolean
}

export interface QuizAttemptInfo {
  quizId: string
  quizTitle: string | null
  lessonId: string
  lessonTitle: string
  score: number | null
  passed: boolean | null
  totalPoints: number
  earnedPoints: number
}

export interface QuizBreakdownItem {
  quizTitle: string
  lessonTitle: string
  score: number
  maxScore: number
  percentage: number
  passed: boolean
}

export interface CompletionResult {
  isComplete: boolean
  allLessonsDone: boolean
  allQuizzesAttempted: boolean
  lessonsCompleted: number
  lessonsTotal: number
  quizzesAttempted: number
  quizzesTotal: number
}

/**
 * Check if a course is fully done: all published lessons completed AND
 * every lesson that has a quiz has at least one attempt.
 *
 * @param lessons     - All published lessons with quiz/completion info
 * @param attemptedQuizLessonIds - Set of lesson IDs where the user has at least one quiz attempt
 */
export function isCourseDone(
  lessons: LessonCompletionInfo[],
  attemptedQuizLessonIds: Set<string>
): CompletionResult {
  if (lessons.length === 0) {
    return {
      isComplete: false,
      allLessonsDone: false,
      allQuizzesAttempted: false,
      lessonsCompleted: 0,
      lessonsTotal: 0,
      quizzesAttempted: 0,
      quizzesTotal: 0,
    }
  }

  const lessonsCompleted = lessons.filter((l) => l.isCompleted).length
  const lessonsTotal = lessons.length
  const allLessonsDone = lessonsCompleted === lessonsTotal

  const lessonsWithQuizzes = lessons.filter((l) => l.hasQuiz)
  const quizzesTotal = lessonsWithQuizzes.length
  const quizzesAttempted = lessonsWithQuizzes.filter((l) =>
    attemptedQuizLessonIds.has(l.lessonId)
  ).length
  const allQuizzesAttempted = quizzesAttempted === quizzesTotal

  return {
    isComplete: allLessonsDone && allQuizzesAttempted,
    allLessonsDone,
    allQuizzesAttempted,
    lessonsCompleted,
    lessonsTotal,
    quizzesAttempted,
    quizzesTotal,
  }
}

/**
 * Build the quiz score breakdown table for the scorecard.
 * Uses the best (highest-scoring) attempt per quiz.
 *
 * @param attempts - All quiz attempts for the user in this course (may include multiple per quiz)
 * @returns Array of breakdown items sorted by lesson order, plus aggregate score
 */
export function buildQuizBreakdown(
  attempts: QuizAttemptInfo[]
): { breakdown: QuizBreakdownItem[]; finalScore: number; totalEarned: number; totalPossible: number } {
  if (attempts.length === 0) {
    return { breakdown: [], finalScore: 0, totalEarned: 0, totalPossible: 0 }
  }

  // Group by quizId, keep best attempt (highest score)
  const bestByQuiz = new Map<string, QuizAttemptInfo>()
  for (const attempt of attempts) {
    const existing = bestByQuiz.get(attempt.quizId)
    if (!existing || (attempt.score ?? 0) > (existing.score ?? 0)) {
      bestByQuiz.set(attempt.quizId, attempt)
    }
  }

  const breakdown: QuizBreakdownItem[] = []
  let totalEarned = 0
  let totalPossible = 0

  for (const attempt of bestByQuiz.values()) {
    const percentage = attempt.totalPoints > 0
      ? Math.round((attempt.earnedPoints / attempt.totalPoints) * 100)
      : 0

    breakdown.push({
      quizTitle: attempt.quizTitle ?? `Quiz`,
      lessonTitle: attempt.lessonTitle,
      score: attempt.earnedPoints,
      maxScore: attempt.totalPoints,
      percentage,
      passed: attempt.passed ?? false,
    })

    totalEarned += attempt.earnedPoints
    totalPossible += attempt.totalPoints
  }

  const finalScore = totalPossible > 0
    ? Math.round((totalEarned / totalPossible) * 100)
    : 0

  return { breakdown, finalScore: Math.min(finalScore, 100), totalEarned, totalPossible }
}
