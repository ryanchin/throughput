/**
 * Quiz scoring utility functions.
 *
 * Pure functions with no side effects — suitable for both server and client use.
 */

/**
 * Calculate total possible points for a quiz from its questions.
 * Returns 0 for an empty question set.
 */
export function calculateTotalPoints(questions: { max_points: number }[]): number {
  return questions.reduce((sum, q) => sum + q.max_points, 0)
}

/**
 * Calculate percentage score from earned points and total possible points.
 * Returns 0 if total is 0 (avoids division by zero).
 * Result is rounded to two decimal places.
 */
export function calculatePercentage(earned: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((earned / total) * 10000) / 100
}
