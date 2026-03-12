import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'

type RouteParams = { params: Promise<{ courseId: string; lessonId: string }> }

const optionSchema = z.object({
  text: z.string().min(1),
  is_correct: z.boolean(),
})

const createQuestionSchema = z.object({
  question_text: z.string().min(1, 'Question text is required').max(2000),
  question_type: z.enum(['multiple_choice', 'true_false', 'open_ended']),
  options: z.array(optionSchema).nullable().optional(),
  correct_answer: z.string().nullable().optional(),
  rubric: z.string().nullable().optional(),
  max_points: z.number().int().min(1).max(100).optional().default(10),
  order_index: z.number().int().min(0).optional(),
}).superRefine((data, ctx) => {
  if (data.question_type === 'multiple_choice') {
    if (!data.options || data.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Multiple choice questions require at least 2 options',
        path: ['options'],
      })
    }
    if (data.options && !data.options.some((o) => o.is_correct)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one option must be marked as correct',
        path: ['options'],
      })
    }
  }

  if (data.question_type === 'true_false') {
    if (!data.correct_answer || !['true', 'false'].includes(data.correct_answer)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'True/false questions require correct_answer to be "true" or "false"',
        path: ['correct_answer'],
      })
    }
  }

  if (data.question_type === 'open_ended') {
    if (!data.rubric || data.rubric.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Open-ended questions require a rubric',
        path: ['rubric'],
      })
    }
  }
})

/**
 * GET /api/admin/courses/[courseId]/lessons/[lessonId]/quiz/questions
 * List all questions for the lesson's quiz, ordered by order_index.
 * Returns 404 if no quiz exists for the lesson.
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

  // Find the quiz for this lesson
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id')
    .eq('lesson_id', lessonId)
    .maybeSingle()

  if (!quiz) {
    return NextResponse.json({ error: 'No quiz exists for this lesson' }, { status: 404 })
  }

  const { data: questions, error } = await supabase
    .from('questions')
    .select('*')
    .eq('quiz_id', quiz.id)
    .order('order_index', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
  }

  return NextResponse.json({ questions: questions ?? [] })
}

/**
 * POST /api/admin/courses/[courseId]/lessons/[lessonId]/quiz/questions
 * Create a new question for the lesson's quiz.
 * Auto-assigns order_index if not provided.
 * For true_false questions, auto-generates standard options.
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

  // Find the quiz for this lesson
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id')
    .eq('lesson_id', lessonId)
    .maybeSingle()

  if (!quiz) {
    return NextResponse.json({ error: 'No quiz exists for this lesson. Create a quiz first.' }, { status: 404 })
  }

  // Parse body
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

  const { question_text, question_type, max_points, rubric, correct_answer } = parsed.data
  let { options, order_index } = parsed.data

  // Auto-generate options for true/false
  if (question_type === 'true_false') {
    options = [
      { text: 'True', is_correct: correct_answer === 'true' },
      { text: 'False', is_correct: correct_answer === 'false' },
    ]
  }

  // Auto-assign order_index if not provided
  if (order_index === undefined) {
    const { data: lastQuestion } = await supabase
      .from('questions')
      .select('order_index')
      .eq('quiz_id', quiz.id)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()

    order_index = lastQuestion ? lastQuestion.order_index + 1 : 0
  }

  const { data: question, error } = await supabase
    .from('questions')
    .insert({
      quiz_id: quiz.id,
      question_text,
      question_type,
      options: options ?? null,
      correct_answer: correct_answer ?? null,
      rubric: rubric ?? null,
      max_points,
      order_index,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 })
  }

  return NextResponse.json({ question }, { status: 201 })
}
