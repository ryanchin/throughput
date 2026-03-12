import type { Database } from '@/lib/supabase/database.types'

type Lesson = Database['public']['Tables']['lessons']['Row']
type CertTrack = Database['public']['Tables']['certification_tracks']['Row']

export type ContentType = 'course' | 'lesson' | 'certification_track' | 'docs_page'
export type ContentStatus = 'draft' | 'published'

export interface ValidationResult {
  valid: boolean
  error?: string
  details?: string[]
}

/**
 * Validate that a course can be published.
 * Requires at least one published lesson.
 */
export function validateCoursePublish(lessons: Pick<Lesson, 'status'>[]): ValidationResult {
  const publishedLessons = lessons.filter(l => l.status === 'published')

  if (publishedLessons.length === 0) {
    return {
      valid: false,
      error: 'Cannot publish a course with no published lessons',
      details: [`${lessons.length} lesson(s) found, 0 are published`],
    }
  }

  return { valid: true }
}

/**
 * Validate that a certification track can be published.
 * Requires at least `questionsPerExam` questions in the pool.
 */
export function validateCertTrackPublish(
  questionCount: number,
  questionsPerExam: number
): ValidationResult {
  if (questionCount < questionsPerExam) {
    return {
      valid: false,
      error: `Cannot publish certification track: need at least ${questionsPerExam} questions, found ${questionCount}`,
      details: [`Question pool: ${questionCount}/${questionsPerExam} required`],
    }
  }

  return { valid: true }
}

/**
 * Get the list of unpublished lessons for a course (for preflight check).
 */
export function getUnpublishedLessons(
  lessons: Pick<Lesson, 'id' | 'title' | 'status'>[]
): Pick<Lesson, 'id' | 'title' | 'status'>[] {
  return lessons.filter(l => l.status === 'draft')
}
