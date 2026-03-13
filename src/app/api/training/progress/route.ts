import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const progressBodySchema = z.object({
  lessonId: z.string().uuid('lessonId must be a valid UUID'),
})

/**
 * PATCH /api/training/progress
 *
 * Marks a lesson as completed for the authenticated user. If all published
 * lessons in the course are now complete, also marks the course enrollment
 * as completed.
 *
 * Validates:
 * - User is authenticated with employee/sales/admin role
 * - Lesson exists and is published
 * - User is enrolled in the lesson's course
 * - If the lesson has a quiz, the user must have a passing attempt
 *
 * Returns the lesson progress row, whether the course is now fully completed,
 * and the slug of the next lesson (or null if this was the last one).
 *
 * @returns {{ progress, courseCompleted: boolean, nextLessonSlug: string | null }}
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  // --- Auth ---
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || !['employee', 'sales', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // --- Input validation ---
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = progressBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { lessonId } = parsed.data

  // --- Lesson existence + status check ---
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('id, course_id, order_index, slug')
    .eq('id', lessonId)
    .eq('status', 'published')
    .single()

  if (lessonError || !lesson) {
    return NextResponse.json({ error: 'Lesson not found or not published' }, { status: 404 })
  }

  // --- Enrollment check ---
  const { data: enrollment, error: enrollError } = await supabase
    .from('course_enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', lesson.course_id)
    .single()

  if (enrollError || !enrollment) {
    return NextResponse.json(
      { error: 'You must be enrolled in this course to track progress' },
      { status: 403 }
    )
  }

  // --- Quiz gate: if lesson has a quiz, user must have passed it ---
  const { data: quizzes, error: quizError } = await supabase
    .from('quizzes')
    .select('id')
    .eq('lesson_id', lessonId)

  if (quizError) {
    return NextResponse.json({ error: 'Failed to check quiz status' }, { status: 500 })
  }

  if (quizzes && quizzes.length > 0) {
    const quizIds = quizzes.map((q) => q.id)

    const { data: passingAttempts, error: attemptError } = await supabase
      .from('quiz_attempts')
      .select('id')
      .eq('user_id', user.id)
      .in('quiz_id', quizIds)
      .eq('passed', true)
      .limit(1)

    if (attemptError) {
      return NextResponse.json({ error: 'Failed to verify quiz completion' }, { status: 500 })
    }

    if (!passingAttempts || passingAttempts.length === 0) {
      return NextResponse.json(
        { error: 'You must pass the lesson quiz before marking this lesson complete' },
        { status: 422 }
      )
    }
  }

  // --- Upsert lesson_progress ---
  // Check if progress already exists
  const { data: existingProgress } = await supabase
    .from('lesson_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('lesson_id', lessonId)
    .single()

  let progress: typeof existingProgress

  if (existingProgress) {
    if (existingProgress.completed_at) {
      // Already completed — no update needed, but continue to return current state
      progress = existingProgress
    } else {
      const { data: updated, error: updateError } = await supabase
        .from('lesson_progress')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', existingProgress.id)
        .select()
        .single()

      if (updateError || !updated) {
        return NextResponse.json({ error: 'Failed to update lesson progress' }, { status: 500 })
      }
      progress = updated
    }
  } else {
    const now = new Date().toISOString()
    const { data: inserted, error: insertError } = await supabase
      .from('lesson_progress')
      .insert({
        user_id: user.id,
        lesson_id: lessonId,
        started_at: now,
        completed_at: now,
      })
      .select()
      .single()

    if (insertError || !inserted) {
      return NextResponse.json({ error: 'Failed to create lesson progress' }, { status: 500 })
    }
    progress = inserted
  }

  // --- Check if all published lessons in the course are complete ---
  const { data: allPublishedLessons, error: allLessonsError } = await supabase
    .from('lessons')
    .select('id')
    .eq('course_id', lesson.course_id)
    .eq('status', 'published')

  if (allLessonsError || !allPublishedLessons) {
    return NextResponse.json({ error: 'Failed to check course completion' }, { status: 500 })
  }

  const allLessonIds = allPublishedLessons.map((l) => l.id)

  const { data: completedLessons, error: completedError } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('user_id', user.id)
    .in('lesson_id', allLessonIds)
    .not('completed_at', 'is', null)

  if (completedError) {
    return NextResponse.json({ error: 'Failed to check course completion' }, { status: 500 })
  }

  const completedIds = new Set((completedLessons ?? []).map((l) => l.lesson_id))
  const courseCompleted = allLessonIds.every((id) => completedIds.has(id))

  if (courseCompleted) {
    // Calculate final score from quiz attempts before marking complete
    let finalScore: number | null = null
    let enrollmentStatus: 'passed' | 'failed' = 'passed'

    // Fetch course passing_score
    const { data: courseData } = await supabase
      .from('courses')
      .select('passing_score')
      .eq('id', lesson.course_id)
      .single()

    const passingScore = courseData?.passing_score ?? 70

    // Fetch all quizzes for this course's lessons
    const { data: courseQuizzes } = await supabase
      .from('quizzes')
      .select('id, lesson_id')
      .in('lesson_id', allLessonIds)

    if (courseQuizzes && courseQuizzes.length > 0) {
      const quizIds = courseQuizzes.map((q) => q.id)

      // Fetch all question max_points per quiz
      const { data: questions } = await supabase
        .from('questions')
        .select('quiz_id, max_points')
        .in('quiz_id', quizIds)

      const totalPointsByQuiz = new Map<string, number>()
      for (const q of questions ?? []) {
        totalPointsByQuiz.set(q.quiz_id, (totalPointsByQuiz.get(q.quiz_id) ?? 0) + q.max_points)
      }

      // Fetch best attempt per quiz (highest score)
      const { data: allAttempts } = await supabase
        .from('quiz_attempts')
        .select('quiz_id, score')
        .eq('user_id', user.id)
        .in('quiz_id', quizIds)
        .not('submitted_at', 'is', null)

      // Keep best score per quiz
      const bestScoreByQuiz = new Map<string, number>()
      for (const a of allAttempts ?? []) {
        const existing = bestScoreByQuiz.get(a.quiz_id) ?? -1
        if ((a.score ?? 0) > existing) {
          bestScoreByQuiz.set(a.quiz_id, a.score ?? 0)
        }
      }

      // Calculate weighted final score
      let totalEarned = 0
      let totalPossible = 0
      for (const quiz of courseQuizzes) {
        const quizTotal = totalPointsByQuiz.get(quiz.id) ?? 0
        const bestPercent = bestScoreByQuiz.get(quiz.id) ?? 0
        totalEarned += quizTotal > 0 ? Math.round((bestPercent / 100) * quizTotal) : 0
        totalPossible += quizTotal
      }

      finalScore = totalPossible > 0
        ? Math.min(Math.round((totalEarned / totalPossible) * 100), 100)
        : 0
      enrollmentStatus = finalScore >= passingScore ? 'passed' : 'failed'
    }

    // Mark course enrollment as completed with score (idempotent — only if not already set)
    await supabase
      .from('course_enrollments')
      .update({
        completed_at: new Date().toISOString(),
        final_score: finalScore,
        status: enrollmentStatus,
      })
      .eq('user_id', user.id)
      .eq('course_id', lesson.course_id)
      .is('completed_at', null)
  }

  // --- Find next lesson ---
  const { data: nextLesson } = await supabase
    .from('lessons')
    .select('slug')
    .eq('course_id', lesson.course_id)
    .eq('status', 'published')
    .gt('order_index', lesson.order_index)
    .order('order_index', { ascending: true })
    .limit(1)
    .single()

  return NextResponse.json({
    progress,
    courseCompleted,
    nextLessonSlug: nextLesson?.slug ?? null,
  })
}
