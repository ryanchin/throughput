import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'

type RouteParams = {
  params: Promise<{ trackId: string; questionId: string }>
}

const mcOptionSchema = z.object({
  text: z.string().min(1),
  is_correct: z.boolean(),
})

const updateQuestionSchema = z.object({
  question_text: z.string().min(1).max(2000).optional(),
  question_type: z.enum(['multiple_choice', 'open_ended']).optional(),
  options: z.array(mcOptionSchema).nullable().optional(),
  correct_answer: z.string().nullable().optional(),
  rubric: z.string().max(2000).nullable().optional(),
  max_points: z.number().int().min(1).max(100).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  tags: z.array(z.string()).optional(),
})

/**
 * PATCH /api/admin/certifications/[trackId]/questions/[questionId]
 * Updates a certification question. All fields are optional.
 * When question_type changes, validates that required fields for the new type are present.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { trackId, questionId } = await params
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // Verify question exists and belongs to the track
  const { data: existingQuestion, error: fetchError } = await supabase
    .from('cert_questions')
    .select('*')
    .eq('id', questionId)
    .eq('track_id', trackId)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to fetch question' }, { status: 500 })
  }

  if (!existingQuestion) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

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

  // Determine effective question_type after the update
  const effectiveType = updates.question_type ?? existingQuestion.question_type

  // Validate type-specific constraints against the merged state
  if (effectiveType === 'multiple_choice') {
    const effectiveOptions = updates.options !== undefined
      ? updates.options
      : existingQuestion.options

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

  if (effectiveType === 'open_ended') {
    const effectiveRubric = updates.rubric !== undefined
      ? updates.rubric
      : existingQuestion.rubric

    if (!effectiveRubric || effectiveRubric.trim().length === 0) {
      return NextResponse.json(
        { error: 'Open-ended questions require a rubric for LLM grading' },
        { status: 400 }
      )
    }
  }

  const { data: question, error } = await supabase
    .from('cert_questions')
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
 * DELETE /api/admin/certifications/[trackId]/questions/[questionId]
 * Deletes a certification question from the track's question pool.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { trackId, questionId } = await params
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // Verify question exists and belongs to the track
  const { data: existingQuestion } = await supabase
    .from('cert_questions')
    .select('id')
    .eq('id', questionId)
    .eq('track_id', trackId)
    .maybeSingle()

  if (!existingQuestion) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('cert_questions')
    .delete()
    .eq('id', questionId)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
