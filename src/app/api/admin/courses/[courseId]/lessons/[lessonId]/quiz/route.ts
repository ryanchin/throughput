import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'

type RouteParams = { params: Promise<{ courseId: string; lessonId: string }> }

/**
 * GET /api/admin/courses/[courseId]/lessons/[lessonId]/quiz
 * Fetch the quiz for a lesson, including all questions ordered by order_index.
 * Returns { quiz: null } if no quiz exists for the lesson.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
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

  // Fetch quiz by lesson_id
  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .select('*')
    .eq('lesson_id', lessonId)
    .maybeSingle()

  if (quizError) {
    return NextResponse.json({ error: 'Failed to fetch quiz' }, { status: 500 })
  }

  if (!quiz) {
    return NextResponse.json({ quiz: null })
  }

  // Fetch questions for this quiz
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .eq('quiz_id', quiz.id)
    .order('order_index', { ascending: true })

  if (questionsError) {
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
  }

  return NextResponse.json({ quiz: { ...quiz, questions: questions ?? [] } })
}

const createQuizSchema = z.object({
  title: z.string().max(255).nullable().optional(),
  passing_score: z.number().int().min(0).max(100).optional().default(70),
})

/**
 * POST /api/admin/courses/[courseId]/lessons/[lessonId]/quiz
 * Create a quiz for a lesson. Returns 409 if a quiz already exists.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

  // Check if a quiz already exists for this lesson
  const { data: existing } = await supabase
    .from('quizzes')
    .select('id')
    .eq('lesson_id', lessonId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'A quiz already exists for this lesson' },
      { status: 409 }
    )
  }

  // Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createQuizSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { title, passing_score } = parsed.data

  const { data: quiz, error } = await supabase
    .from('quizzes')
    .insert({
      lesson_id: lessonId,
      title: title ?? null,
      passing_score,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create quiz' }, { status: 500 })
  }

  return NextResponse.json({ quiz }, { status: 201 })
}

const updateQuizSchema = z.object({
  title: z.string().max(255).nullable().optional(),
  passing_score: z.number().int().min(0).max(100).optional(),
})

/**
 * PATCH /api/admin/courses/[courseId]/lessons/[lessonId]/quiz
 * Update quiz metadata (title, passing_score).
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
  const { data: existingQuiz, error: quizLookupError } = await supabase
    .from('quizzes')
    .select('id')
    .eq('lesson_id', lessonId)
    .maybeSingle()

  if (quizLookupError) {
    return NextResponse.json({ error: 'Failed to fetch quiz' }, { status: 500 })
  }

  if (!existingQuiz) {
    return NextResponse.json({ error: 'No quiz exists for this lesson' }, { status: 404 })
  }

  // Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = updateQuizSchema.safeParse(body)
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

  const { data: quiz, error } = await supabase
    .from('quizzes')
    .update(updates)
    .eq('id', existingQuiz.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update quiz' }, { status: 500 })
  }

  return NextResponse.json({ quiz })
}

/**
 * DELETE /api/admin/courses/[courseId]/lessons/[lessonId]/quiz
 * Delete the quiz for a lesson. Cascades to questions via FK.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
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
  const { data: existingQuiz } = await supabase
    .from('quizzes')
    .select('id')
    .eq('lesson_id', lessonId)
    .maybeSingle()

  if (!existingQuiz) {
    return NextResponse.json({ error: 'No quiz exists for this lesson' }, { status: 404 })
  }

  const { error } = await supabase
    .from('quizzes')
    .delete()
    .eq('id', existingQuiz.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete quiz' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
