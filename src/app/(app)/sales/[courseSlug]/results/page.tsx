import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth/getProfile'
import { buildQuizBreakdown, type QuizAttemptInfo } from '@/lib/training/completion'
import CourseScorecard from '@/components/training/CourseScorecard'

/**
 * Sales course results page — mirrors training results with zone="sales".
 */
export default async function SalesResultsPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>
}) {
  const { courseSlug } = await params
  const data = await getResultsData(courseSlug, 'sales')
  if (!data) notFound()

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <CourseScorecard
        courseTitle={data.courseTitle}
        courseSlug={courseSlug}
        finalScore={data.finalScore}
        passingScore={data.passingScore}
        passed={data.passed}
        completedAt={data.completedAt}
        breakdown={data.breakdown}
        zone="sales"
      />
    </div>
  )
}

async function getResultsData(courseSlug: string, zone: 'training' | 'sales') {
  const profile = await getProfile()
  if (!profile) return null
  if (!['sales', 'admin'].includes(profile.role)) return null

  const supabase = await createClient()

  const { data: course } = await supabase
    .from('courses')
    .select('id, title, slug, zone, passing_score')
    .eq('slug', courseSlug)
    .eq('zone', zone)
    .eq('status', 'published')
    .single()

  if (!course) return null

  const { data: enrollment } = await supabase
    .from('course_enrollments')
    .select('id, status, final_score, enrolled_at, completed_at')
    .eq('user_id', profile.id)
    .eq('course_id', course.id)
    .single()

  if (!enrollment) return null

  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, title, order_index')
    .eq('course_id', course.id)
    .eq('status', 'published')
    .order('order_index', { ascending: true })

  if (!lessons || lessons.length === 0) return null

  const lessonIds = lessons.map((l) => l.id)

  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('id, lesson_id, title')
    .in('lesson_id', lessonIds)

  if (!quizzes || quizzes.length === 0) {
    return {
      courseTitle: course.title,
      finalScore: enrollment.final_score ?? 0,
      passingScore: course.passing_score,
      passed: enrollment.status === 'passed',
      completedAt: enrollment.completed_at,
      breakdown: [],
    }
  }

  const quizIds = quizzes.map((q) => q.id)

  const [attemptsResult, questionsResult] = await Promise.all([
    supabase
      .from('quiz_attempts')
      .select('id, quiz_id, score, passed')
      .eq('user_id', profile.id)
      .in('quiz_id', quizIds)
      .not('submitted_at', 'is', null),
    supabase
      .from('questions')
      .select('quiz_id, max_points')
      .in('quiz_id', quizIds),
  ])

  const totalPointsByQuiz = new Map<string, number>()
  for (const q of questionsResult.data ?? []) {
    totalPointsByQuiz.set(q.quiz_id, (totalPointsByQuiz.get(q.quiz_id) ?? 0) + q.max_points)
  }

  const quizToLesson = new Map<string, { lessonId: string; lessonTitle: string }>()
  for (const quiz of quizzes) {
    const lesson = lessons.find((l) => l.id === quiz.lesson_id)
    if (lesson) quizToLesson.set(quiz.id, { lessonId: lesson.id, lessonTitle: lesson.title })
  }

  const attemptInfos: QuizAttemptInfo[] = (attemptsResult.data ?? []).map((a) => {
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

  return {
    courseTitle: course.title,
    finalScore: enrollment.final_score ?? finalScore,
    passingScore: course.passing_score,
    passed: enrollment.status === 'passed',
    completedAt: enrollment.completed_at,
    breakdown,
  }
}
