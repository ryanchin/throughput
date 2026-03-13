/**
 * Course-level and quiz-level scoring calculators.
 *
 * Pure functions with no side effects — suitable for both server and client use.
 * Calculates aggregate scores across quizzes, using the latest attempt per quiz
 * and weighting by max_points.
 */

export interface QuizScore {
  quizId: string
  lessonId: string
  earnedPoints: number
  totalPoints: number
  passed: boolean
}

/**
 * Calculate the aggregate course score from individual quiz scores.
 *
 * Uses the latest (highest-scored) attempt for each quiz.
 * Score is a percentage (0-100) weighted by quiz max_points.
 *
 * @param quizScores        - Array of per-quiz scores (one per quiz, best attempt)
 * @param coursePassingScore - Minimum percentage to pass the course (default 70)
 * @returns Object with percentage score (0-100) and pass/fail status
 */
export function calculateCourseScore(
  quizScores: QuizScore[],
  coursePassingScore: number = 70
): { score: number; passed: boolean } {
  if (quizScores.length === 0) {
    return { score: 0, passed: false }
  }

  const totalEarned = quizScores.reduce((sum, q) => sum + q.earnedPoints, 0)
  const totalPossible = quizScores.reduce((sum, q) => sum + q.totalPoints, 0)

  if (totalPossible === 0) {
    return { score: 0, passed: false }
  }

  const score = Math.round((totalEarned / totalPossible) * 100)
  return {
    score: Math.min(score, 100),
    passed: score >= coursePassingScore,
  }
}

/**
 * Calculate score for a single quiz attempt from question responses.
 *
 * @param responses    - Array of question responses with points_earned
 * @param totalPoints  - Total possible points for the quiz
 * @param passingScore - Minimum percentage to pass (default 70)
 * @returns Object with percentage score, pass/fail, and raw earned points
 */
export function calculateQuizScore(
  responses: Array<{ points_earned: number }>,
  totalPoints: number,
  passingScore: number = 70
): { score: number; passed: boolean; earnedPoints: number } {
  const earnedPoints = responses.reduce((sum, r) => sum + r.points_earned, 0)

  if (totalPoints <= 0) {
    return { score: 0, passed: false, earnedPoints: 0 }
  }

  const score = Math.round((earnedPoints / totalPoints) * 100)
  return {
    score: Math.min(score, 100),
    passed: score >= passingScore,
    earnedPoints,
  }
}
