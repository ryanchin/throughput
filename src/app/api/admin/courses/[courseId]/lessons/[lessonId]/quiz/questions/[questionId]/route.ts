import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'

type RouteParams = {
  params: Promise<{ courseId: string; lessonId: string; questionId: string }>
}

const optionSchema = z.object({
  text: z.string().min(1),
  is_correct: z.boolean(),
})

const updateQuestionSchema = z.object({
  question_text: z.string().min(1).max(2000).optional(),
  question_type: z.enum(['multiple_choice', 'true_false', 'open_ended']).optional(),
  options: z.array(optionSchema).nullable().optional(),
  correct_answer: z.string().nullable().optional(),
  rubric: z.string().nullable().optional(),
  max_points: z.number().int().min(1).max(100).optional(),
  order_index: z.number().int().min(0).optional(),
})

/**
 * PATCH /api/admin/courses/[courseId]/lessons/[lessonId]/quiz/questions/[questionId]
 * Update a question. All fields are optional.
 * When question_type changes, validates that required fields for the new type are present.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { courseId, lessonId, questionId } = await params

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

  // Verify the question belongs to this quiz
  const { data: existingQuestion, error: questionError } = await supabase
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .eq('quiz_id', quiz.id)
    .single()

  if (questionError || !existingQuestion) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  // Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = updateQuestionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const updates = parsed.data
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Determine the effective question_type after the update
  const effectiveType = updates.question_type ?? existingQuestion.question_type

  // Validate type-specific constraints against the merged state
  if (effectiveType === 'multiple_choice') {
    const effectiveOptions = updates.options !== undefined ? updates.options : existingQuestion.options
    if (!effectiveOptions || !Array.isArray(effectiveOptions) || effectiveOptions.length < 2) {
      return NextResponse.json(
        { error: 'Multiple choice questions require at least 2 options' },
        { status: 400 }
      )
    }
    const hasCorrect = (effectiveOptions as Array<{ is_correct: boolean }>).some((o) => o.is_correct)
    if (!hasCorrect) {
      return NextResponse.json(
        { error: 'At least one option must be marked as correct' },
        { status: 400 }
      )
    }
  }

  if (effectiveType === 'true_false') {
    const effectiveAnswer = updates.correct_answer !== undefined
      ? updates.correct_answer
      : existingQuestion.correct_answer
    if (!effectiveAnswer || !['true', 'false'].includes(effectiveAnswer)) {
      return NextResponse.json(
        { error: 'True/false questions require correct_answer to be "true" or "false"' },
        { status: 400 }
      )
    }
    // Auto-generate options for true/false
    updates.options = [
      { text: 'True', is_correct: effectiveAnswer === 'true' },
      { text: 'False', is_correct: effectiveAnswer === 'false' },
    ]
  }

  if (effectiveType === 'open_ended') {
    const effectiveRubric = updates.rubric !== undefined
      ? updates.rubric
      : existingQuestion.rubric
    if (!effectiveRubric || effectiveRubric.trim().length === 0) {
      return NextResponse.json(
        { error: 'Open-ended questions require a rubric' },
        { status: 400 }
      )
    }
  }

  const { data: question, error } = await supabase
    .from('questions')
    .update(updates)
    .eq('id', questionId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update question' }, { status: 500 })
  }

  return NextResponse.json({ question })
}

/**
 * DELETE /api/admin/courses/[courseId]/lessons/[lessonId]/quiz/questions/[questionId]
 * Delete a question and re-index remaining questions to maintain contiguous order.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { courseId, lessonId, questionId } = await params

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

  // Verify the question belongs to this quiz
  const { data: existingQuestion, error: questionError } = await supabase
    .from('questions')
    .select('id, order_index')
    .eq('id', questionId)
    .eq('quiz_id', quiz.id)
    .single()

  if (questionError || !existingQuestion) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  // Delete the question
  const { error: deleteError } = await supabase
    .from('questions')
    .delete()
    .eq('id', questionId)

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 })
  }

  // Re-index remaining questions to maintain contiguous order
  const { data: remaining, error: fetchError } = await supabase
    .from('questions')
    .select('id, order_index')
    .eq('quiz_id', quiz.id)
    .order('order_index', { ascending: true })

  if (!fetchError && remaining) {
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].order_index !== i) {
        await supabase
          .from('questions')
          .update({ order_index: i })
          .eq('id', remaining[i].id)
      }
    }
  }

  return NextResponse.json({ success: true })
}
