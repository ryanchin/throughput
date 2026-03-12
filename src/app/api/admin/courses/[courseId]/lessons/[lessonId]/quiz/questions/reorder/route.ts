import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'

type RouteParams = { params: Promise<{ courseId: string; lessonId: string }> }

const reorderSchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1, 'At least one question ID is required'),
})

/**
 * PATCH /api/admin/courses/[courseId]/lessons/[lessonId]/quiz/questions/reorder
 * Reorder questions by providing the full ordered list of question IDs.
 * Every question in the quiz must be included exactly once.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { courseId, lessonId } = await params

  // Verify the lesson belongs to the course
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('id')
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .single()

  if (lessonError || !lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  // Find the quiz for this lesson
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id')
    .eq('lesson_id', lessonId)
    .maybeSingle()

  if (!quiz) {
    return NextResponse.json({ error: 'No quiz exists for this lesson' }, { status: 404 })
  }

  // Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { questionIds } = parsed.data

  // Fetch existing questions for this quiz
  const { data: existingQuestions, error: fetchError } = await supabase
    .from('questions')
    .select('id')
    .eq('quiz_id', quiz.id)

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
  }

  const existingIds = new Set((existingQuestions ?? []).map((q) => q.id))
  const providedIds = new Set(questionIds)

  // Check for duplicates in the provided list
  if (providedIds.size !== questionIds.length) {
    return NextResponse.json(
      { error: 'Duplicate question IDs in the provided list' },
      { status: 400 }
    )
  }

  // Check that every existing question is accounted for
  if (providedIds.size !== existingIds.size) {
    return NextResponse.json(
      { error: 'Provided question IDs must match the exact set of questions in the quiz' },
      { status: 400 }
    )
  }

  for (const id of questionIds) {
    if (!existingIds.has(id)) {
      return NextResponse.json(
        { error: `Question ${id} does not belong to this quiz` },
        { status: 400 }
      )
    }
  }

  // Update order_index for each question
  const updatePromises = questionIds.map((id, index) =>
    supabase
      .from('questions')
      .update({ order_index: index })
      .eq('id', id)
  )

  const results = await Promise.all(updatePromises)
  const failed = results.some((r) => r.error)

  if (failed) {
    return NextResponse.json({ error: 'Failed to reorder some questions' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
