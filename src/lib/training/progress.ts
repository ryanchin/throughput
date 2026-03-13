/**
 * Progress calculation utilities for the training/sales course system.
 * Pure functions — no DB calls.
 */

/** Calculate completion percentage (0-100). Returns 0 if totalCount is 0. */
export function calculateProgress(completedCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0
  const progress = Math.round((completedCount / totalCount) * 100)
  return Math.min(progress, 100)
}

/**
 * Check if a lesson is accessible in sequential mode.
 *
 * In 'free' mode, all lessons are accessible.
 * In 'sequential' mode, a lesson is accessible only if:
 * - It is the first lesson (index 0), OR
 * - All preceding lessons have been completed.
 */
export function isLessonAccessible(
  lessonIndex: number,
  completedLessonIds: string[],
  lessonIds: string[],
  navigationMode: 'sequential' | 'free'
): boolean {
  if (navigationMode === 'free') return true
  if (lessonIndex === 0) return true

  const completedSet = new Set(completedLessonIds)
  for (let i = 0; i < lessonIndex; i++) {
    if (!completedSet.has(lessonIds[i])) return false
  }
  return true
}

/**
 * Get the slug of the next incomplete lesson in the course.
 * Returns null if all lessons are completed.
 */
export function getNextLessonSlug(
  lessons: Array<{ slug: string; id: string }>,
  completedLessonIds: string[]
): string | null {
  const completedSet = new Set(completedLessonIds)
  const nextLesson = lessons.find((lesson) => !completedSet.has(lesson.id))
  return nextLesson?.slug ?? null
}

/**
 * Format duration in minutes to human-readable string.
 * Examples: "1h 30m", "45m", "2h", "0m"
 */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}
