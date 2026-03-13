import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'

type RouteParams = {
  params: Promise<{ trackId: string }>
}

/**
 * GET /api/admin/certifications/[trackId]/questions
 * Lists all questions for a certification track, ordered by created_at ascending.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { trackId } = await params
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // Verify track exists
  const { data: track } = await supabase
    .from('certification_tracks')
    .select('id')
    .eq('id', trackId)
    .maybeSingle()

  if (!track) {
    return NextResponse.json({ error: 'Certification track not found' }, { status: 404 })
  }

  const { data: questions, error } = await supabase
    .from('cert_questions')
    .select('*')
    .eq('track_id', trackId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
  }

  return NextResponse.json({ questions })
}

const mcOptionSchema = z.object({
  text: z.string().min(1),
  is_correct: z.boolean(),
})

const createQuestionSchema = z.object({
  question_text: z.string().min(1, 'Question text is required').max(2000),
  question_type: z.enum(['multiple_choice', 'open_ended']),
  options: z.array(mcOptionSchema).nullable().optional(),
  correct_answer: z.string().nullable().optional(),
  rubric: z.string().max(2000).nullable().optional(),
  max_points: z.number().int().min(1).max(100).optional().default(10),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  tags: z.array(z.string()).optional(),
})

/**
 * POST /api/admin/certifications/[trackId]/questions
 * Creates a new question for a certification track.
 * Validates type-specific constraints (options for MC, rubric for open-ended).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { trackId } = await params
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // Verify track exists
  const { data: track } = await supabase
    .from('certification_tracks')
    .select('id')
    .eq('id', trackId)
    .maybeSingle()

  if (!track) {
    return NextResponse.json({ error: 'Certification track not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createQuestionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const data = parsed.data

  // Type-specific validation
  if (data.question_type === 'multiple_choice') {
    if (!data.options || data.options.length < 2) {
      return NextResponse.json(
        { error: 'Multiple choice questions require at least 2 options' },
        { status: 400 }
      )
    }

    const hasCorrect = data.options.some((o) => o.is_correct)
    if (!hasCorrect) {
      return NextResponse.json(
        { error: 'At least one option must be marked as correct' },
        { status: 400 }
      )
    }

    if (!data.correct_answer) {
      // Auto-set correct_answer from the first correct option
      const correctOption = data.options.find((o) => o.is_correct)
      if (correctOption) {
        data.correct_answer = correctOption.text
      }
    }
  }

  if (data.question_type === 'open_ended') {
    if (!data.rubric || data.rubric.trim().length === 0) {
      return NextResponse.json(
        { error: 'Open-ended questions require a rubric for LLM grading' },
        { status: 400 }
      )
    }
  }

  const { data: question, error } = await supabase
    .from('cert_questions')
    .insert({
      track_id: trackId,
      question_text: data.question_text,
      question_type: data.question_type,
      options: data.options ?? null,
      correct_answer: data.correct_answer ?? null,
      rubric: data.rubric ?? null,
      max_points: data.max_points,
      difficulty: data.difficulty,
      tags: data.tags ?? [],
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 })
  }

  return NextResponse.json({ question }, { status: 201 })
}
