import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/training/courses/[slug]
 *
 * Fetches a single published course by slug with full detail for the
 * learner view. Includes lessons (ordered), enrollment status, per-lesson
 * progress, and quiz pass status for each lesson.
 *
 * Zone filtering:
 * - employee: can only access 'training' zone courses
 * - sales + admin: can access all zones
 *
 * @returns {{ course, lessons, enrollment, lessonProgress, quizInfo }}
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
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

  // --- Fetch course by slug (published only) ---
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (courseError || !course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  // --- Zone access check ---
  if (profile.role === 'employee' && course.zone === 'sales') {
    return NextResponse.json({ error: 'You do not have access to this course' }, { status: 403 })
  }

  // --- Parallel data fetches ---
  const [lessonsResult, enrollmentResult] = await Promise.all([
    supabase
      .from('lessons')
      .select('id, title, slug, order_index, duration_minutes, video_ids')
      .eq('course_id', course.id)
      .eq('status', 'published')
      .order('order_index', { ascending: true }),
    supabase
      .from('course_enrollments')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_id', course.id)
      .single(),
  ])

  if (lessonsResult.error) {
    return NextResponse.json({ error: 'Failed to fetch lessons' }, { status: 500 })
  }

  const lessons = lessonsResult.data ?? []
  // enrollmentResult may return PGRST116 (no rows) which is expected — not an error
  const enrollment = enrollmentResult.data ?? null

  if (lessons.length === 0) {
    return NextResponse.json({
      course,
      lessons: [],
      enrollment,
      lessonProgress: [],
      quizInfo: [],
    })
  }

  const lessonIds = lessons.map((l) => l.id)

  // --- Lesson progress + quiz info (parallel) ---
  const [progressResult, quizzesResult] = await Promise.all([
    supabase
      .from('lesson_progress')
      .select('id, lesson_id, started_at, completed_at')
      .eq('user_id', user.id)
      .in('lesson_id', lessonIds),
    supabase
      .from('quizzes')
      .select('id, lesson_id')
      .in('lesson_id', lessonIds),
  ])

  if (progressResult.error) {
    return NextResponse.json({ error: 'Failed to fetch lesson progress' }, { status: 500 })
  }

  if (quizzesResult.error) {
    return NextResponse.json({ error: 'Failed to fetch quiz info' }, { status: 500 })
  }

  const lessonProgress = progressResult.data ?? []
  const quizzes = quizzesResult.data ?? []

  // --- For each quiz, check if user has a passing attempt ---
  let quizInfo: Array<{ quizId: string; lessonId: string; passed: boolean }> = []

  if (quizzes.length > 0) {
    const quizIds = quizzes.map((q) => q.id)

    const { data: passingAttempts, error: attemptsError } = await supabase
      .from('quiz_attempts')
      .select('quiz_id')
      .eq('user_id', user.id)
      .in('quiz_id', quizIds)
      .eq('passed', true)

    if (attemptsError) {
      return NextResponse.json({ error: 'Failed to fetch quiz attempts' }, { status: 500 })
    }

    const passedQuizIds = new Set((passingAttempts ?? []).map((a) => a.quiz_id))

    quizInfo = quizzes.map((q) => ({
      quizId: q.id,
      lessonId: q.lesson_id,
      passed: passedQuizIds.has(q.id),
    }))
  }

  return NextResponse.json({
    course,
    lessons,
    enrollment,
    lessonProgress,
    quizInfo,
  })
}
