import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { LessonEditor } from '@/components/admin/LessonEditor'

export default async function LessonEditorPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>
}) {
  const { courseId, lessonId } = await params
  const supabase = await createClient()

  // Verify user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    notFound()
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    notFound()
  }

  // Fetch the lesson with all fields including content
  const { data: lesson, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .single()

  if (error || !lesson) {
    notFound()
  }

  // Fetch quiz for this lesson (one-to-one)
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('*')
    .eq('lesson_id', lessonId)
    .maybeSingle()

  // Fetch questions if quiz exists
  let questions: Database['public']['Tables']['questions']['Row'][] = []
  if (quiz) {
    const { data: questionData } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('order_index', { ascending: true })

    questions = questionData ?? []
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <LessonEditor
        courseId={courseId}
        lesson={lesson}
        initialQuiz={quiz ?? null}
        initialQuestions={questions ?? []}
      />
    </div>
  )
}
