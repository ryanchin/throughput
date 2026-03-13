import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildQuizBreakdown, type QuizAttemptInfo } from '@/lib/training/completion'

/**
 * GET /api/training/courses/[slug]/results
 *
 * Returns the course completion scorecard data for the authenticated user.
 * Includes final score, pass/fail status, and per-quiz breakdown.
 *
 * Requires authentication and enrollment in the course.
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

  // --- Fetch course ---
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, title, slug, zone, passing_score, cover_image_url')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (courseError || !course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  // --- Enrollment check ---
  const { data: enrollment, error: enrollError } = await supabase
    .from('course_enrollments')
    .select('id, status, final_score, enrolled_at, completed_at')
    .eq('user_id', user.id)
    .eq('course_id', course.id)
    .single()

  if (enrollError || !enrollment) {
    return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 })
  }

  // --- Fetch all published lessons ---
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, title, slug, order_index')
    .eq('course_id', course.id)
    .eq('status', 'published')
    .order('order_index', { ascending: true })

  if (!lessons || lessons.length === 0) {
    return NextResponse.json({ error: 'Course has no lessons' }, { status: 404 })
  }

  const lessonIds = lessons.map((l) => l.id)

  // --- Fetch quizzes for all lessons ---
  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('id, lesson_id, title, passing_score')
    .in('lesson_id', lessonIds)

  if (!quizzes || quizzes.length === 0) {
    // Course has no quizzes — return basic completion info
    return NextResponse.json({
      course: {
        title: course.title,
        slug: course.slug,
        passingScore: course.passing_score,
        coverImageUrl: course.cover_image_url,
      },
      enrollment: {
        status: enrollment.status,
        finalScore: enrollment.final_score,
        completedAt: enrollment.completed_at,
      },
      breakdown: [],
      finalScore: enrollment.final_score ?? 0,
    })
  }

  const quizIds = quizzes.map((q) => q.id)

  // --- Fetch all quiz attempts for this user ---
  const { data: attempts } = await supabase
    .from('quiz_attempts')
    .select('id, quiz_id, score, passed, submitted_at')
    .eq('user_id', user.id)
    .in('quiz_id', quizIds)
    .not('submitted_at', 'is', null)
    .order('score', { ascending: false })

  // --- Fetch question totals per quiz ---
  const { data: questions } = await supabase
    .from('questions')
    .select('quiz_id, max_points')
    .in('quiz_id', quizIds)

  // Build total points per quiz
  const totalPointsByQuiz = new Map<string, number>()
  for (const q of questions ?? []) {
    totalPointsByQuiz.set(q.quiz_id, (totalPointsByQuiz.get(q.quiz_id) ?? 0) + q.max_points)
  }

  // Build quiz -> lesson lookup
  const quizToLesson = new Map<string, { lessonId: string; lessonTitle: string }>()
  for (const quiz of quizzes) {
    const lesson = lessons.find((l) => l.id === quiz.lesson_id)
    if (lesson) {
      quizToLesson.set(quiz.id, { lessonId: lesson.id, lessonTitle: lesson.title })
    }
  }

  // Build attempt info for breakdown
  const attemptInfos: QuizAttemptInfo[] = (attempts ?? []).map((a) => {
    const quiz = quizzes.find((q) => q.id === a.quiz_id)!
    const lessonInfo = quizToLesson.get(a.quiz_id)
    const totalPoints = totalPointsByQuiz.get(a.quiz_id) ?? 0
    const earnedPoints = totalPoints > 0 && a.score !== null
      ? Math.round((a.score / 100) * totalPoints)
      : 0

    return {
      quizId: a.quiz_id,
      quizTitle: quiz.title,
      lessonId: lessonInfo?.lessonId ?? '',
      lessonTitle: lessonInfo?.lessonTitle ?? '',
      score: a.score,
      passed: a.passed,
      totalPoints,
      earnedPoints,
    }
  })

  const { breakdown, finalScore } = buildQuizBreakdown(attemptInfos)

  return NextResponse.json({
    course: {
      title: course.title,
      slug: course.slug,
      passingScore: course.passing_score,
      coverImageUrl: course.cover_image_url,
    },
    enrollment: {
      status: enrollment.status,
      finalScore: enrollment.final_score,
      completedAt: enrollment.completed_at,
    },
    breakdown,
    finalScore: enrollment.final_score ?? finalScore,
  })
}
