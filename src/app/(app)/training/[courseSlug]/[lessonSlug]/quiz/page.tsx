import { redirect, notFound } from 'next/navigation'
import { getProfile } from '@/lib/auth/getProfile'
import { createClient } from '@/lib/supabase/server'
import QuizPageClient from './QuizPageClient'

export default async function QuizPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>
}) {
  const { courseSlug, lessonSlug } = await params
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()

  // Fetch course
  const { data: course } = await supabase
    .from('courses')
    .select('id, slug, zone')
    .eq('slug', courseSlug)
    .eq('status', 'published')
    .single()

  if (!course) notFound()

  // Zone check — employees cannot access sales courses
  if (profile.role === 'employee' && course.zone === 'sales') {
    redirect('/training')
  }

  // Fetch lesson
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, slug')
    .eq('course_id', course.id)
    .eq('slug', lessonSlug)
    .eq('status', 'published')
    .single()

  if (!lesson) notFound()

  // Fetch quiz
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id, title, passing_score')
    .eq('lesson_id', lesson.id)
    .single()

  if (!quiz) notFound()

  // Fetch questions — strip correct_answer and rubric so learner cannot see answers
  const { data: questions } = await supabase
    .from('questions')
    .select('id, question_text, question_type, options, max_points, order_index')
    .eq('quiz_id', quiz.id)
    .order('order_index', { ascending: true })

  if (!questions || questions.length === 0) notFound()

  // Strip is_correct from MC options so learner cannot inspect correct answers
  const sanitizedQuestions = questions.map((q) => ({
    ...q,
    options:
      q.question_type === 'multiple_choice' && Array.isArray(q.options)
        ? (q.options as Array<{ text: string; is_correct?: boolean }>).map(
            (opt) => ({ text: opt.text })
          )
        : q.options,
  }))

  // Find the next lesson for navigation after quiz pass
  const { data: allLessons } = await supabase
    .from('lessons')
    .select('slug, order_index')
    .eq('course_id', course.id)
    .eq('status', 'published')
    .order('order_index', { ascending: true })

  const currentLessonIndex = (allLessons ?? []).findIndex((l) => l.slug === lessonSlug)
  const nextLesson = currentLessonIndex >= 0 && currentLessonIndex < (allLessons ?? []).length - 1
    ? (allLessons ?? [])[currentLessonIndex + 1]
    : null

  return (
    <QuizPageClient
      quizId={quiz.id}
      quizTitle={quiz.title ?? 'Quiz'}
      questions={sanitizedQuestions}
      passingScore={quiz.passing_score}
      courseSlug={courseSlug}
      lessonSlug={lessonSlug}
      lessonId={lesson.id}
      basePath="/training"
      nextLessonSlug={nextLesson?.slug ?? null}
    />
  )
}
