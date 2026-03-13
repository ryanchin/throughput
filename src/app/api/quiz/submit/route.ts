import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { gradeOpenEndedResponse, type GradeResult } from '@/lib/openrouter/grader'
import { calculateQuizScore } from '@/lib/scoring/calculator'
import { calculateTotalPoints } from '@/lib/quiz/calculator'

const answerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.string().min(1, 'Answer is required'),
})

const submitSchema = z.object({
  quizId: z.string().uuid(),
  answers: z.array(answerSchema).min(1, 'At least one answer is required'),
})

/**
 * POST /api/quiz/submit
 *
 * Submits and grades a quiz attempt for the authenticated user.
 *
 * Flow:
 * 1. Authenticate user
 * 2. Validate request body (quizId + answers array)
 * 3. Fetch quiz + questions
 * 4. Verify user is enrolled in the course
 * 5. Create a quiz_attempt record
 * 6. Score MC/TF questions immediately, grade open-ended via LLM
 * 7. Calculate final quiz score and update the attempt
 * 8. Return detailed results
 *
 * Uses service role client for all DB writes (quiz_attempts, question_responses)
 * because RLS policies only allow admin writes on those tables. The authenticated
 * client is used for reads to respect RLS visibility rules.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // --- Auth ---
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // --- Input validation ---
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = submitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { quizId, answers } = parsed.data

  // --- Fetch quiz ---
  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .select('id, lesson_id, title, passing_score, max_attempts')
    .eq('id', quizId)
    .single()

  if (quizError || !quiz) {
    return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
  }

  // --- Fetch questions ---
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('id, quiz_id, question_text, question_type, options, correct_answer, rubric, max_points, order_index')
    .eq('quiz_id', quizId)
    .order('order_index', { ascending: true })

  if (questionsError || !questions || questions.length === 0) {
    return NextResponse.json({ error: 'Quiz has no questions' }, { status: 404 })
  }

  // --- Enrollment check ---
  // Quiz -> lesson -> course -> enrollment
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('id, course_id')
    .eq('id', quiz.lesson_id)
    .single()

  if (lessonError || !lesson) {
    return NextResponse.json({ error: 'Lesson not found for this quiz' }, { status: 404 })
  }

  const { data: enrollment, error: enrollmentError } = await supabase
    .from('course_enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', lesson.course_id)
    .single()

  if (enrollmentError || !enrollment) {
    return NextResponse.json(
      { error: 'You must be enrolled in this course to submit a quiz' },
      { status: 403 }
    )
  }

  // --- Create quiz attempt ---
  // Service role client for writes — RLS only allows admin writes on quiz_attempts
  const serviceClient = createServiceClient()

  // Count existing attempts for this user + quiz to determine attempt_number
  const { count: existingAttempts } = await serviceClient
    .from('quiz_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('quiz_id', quizId)

  const attemptCount = existingAttempts ?? 0
  const attemptNumber = attemptCount + 1

  // Check max attempts limit
  if (quiz.max_attempts !== null && attemptCount >= quiz.max_attempts) {
    return NextResponse.json(
      { error: `Maximum attempts (${quiz.max_attempts}) reached for this quiz` },
      { status: 429 }
    )
  }

  const { data: attempt, error: attemptError } = await serviceClient
    .from('quiz_attempts')
    .insert({
      user_id: user.id,
      quiz_id: quizId,
      attempt_number: attemptNumber,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (attemptError || !attempt) {
    return NextResponse.json(
      { error: 'Failed to create quiz attempt' },
      { status: 500 }
    )
  }

  // --- Build a lookup map: questionId -> question ---
  const questionMap = new Map(questions.map((q) => [q.id, q]))

  // --- Grade each answer ---
  interface ResponseRecord {
    questionId: string
    questionText: string
    questionType: string
    userAnswer: string
    isCorrect: boolean
    pointsEarned: number
    maxPoints: number
    correctAnswer: string | null
    llmFeedback: GradeResult | null
  }

  const responseRecords: ResponseRecord[] = []

  for (const answer of answers) {
    const question = questionMap.get(answer.questionId)
    if (!question) {
      // Skip answers for questions not in this quiz
      continue
    }

    let isCorrect = false
    let pointsEarned = 0
    let llmFeedback: GradeResult | null = null
    let llmFeedbackJson: string | null = null
    let gradedAt: string | null = null

    if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
      // --- MC / TF: exact match (case-insensitive, trimmed) ---
      const userNormalized = answer.answer.trim().toLowerCase()
      const correctNormalized = (question.correct_answer ?? '').trim().toLowerCase()
      isCorrect = userNormalized === correctNormalized
      pointsEarned = isCorrect ? question.max_points : 0
    } else if (question.question_type === 'open_ended') {
      // --- Open-ended: LLM grading ---
      try {
        llmFeedback = await gradeOpenEndedResponse(
          question.question_text,
          question.rubric ?? 'Evaluate for accuracy, completeness, and clarity.',
          answer.answer,
          question.max_points
        )
        pointsEarned = llmFeedback.score
        isCorrect = llmFeedback.score >= question.max_points * 0.7
        llmFeedbackJson = JSON.stringify(llmFeedback)
        gradedAt = new Date().toISOString()
      } catch {
        // LLM grading failed — score 0, give feedback about the failure
        pointsEarned = 0
        isCorrect = false
        llmFeedback = {
          score: 0,
          feedback: 'Grading failed due to a system error. Please contact your instructor for manual review.',
          strengths: [],
          improvements: [],
        }
        llmFeedbackJson = JSON.stringify(llmFeedback)
        gradedAt = new Date().toISOString()
      }
    }

    // Insert question_response via service role
    const { error: responseError } = await serviceClient
      .from('question_responses')
      .insert({
        attempt_id: attempt.id,
        question_id: question.id,
        user_answer: answer.answer,
        is_correct: isCorrect,
        points_earned: pointsEarned,
        llm_feedback: llmFeedbackJson,
        graded_at: gradedAt,
      })

    if (responseError) {
      // Log but continue — partial grading is better than total failure
      console.error(`Failed to insert response for question ${question.id}:`, responseError.message)
    }

    responseRecords.push({
      questionId: question.id,
      questionText: question.question_text,
      questionType: question.question_type,
      userAnswer: answer.answer,
      isCorrect,
      pointsEarned,
      maxPoints: question.max_points,
      // Only reveal correct answer for MC/TF, not open-ended
      correctAnswer: question.question_type !== 'open_ended' ? question.correct_answer : null,
      llmFeedback,
    })
  }

  // --- Calculate quiz score ---
  const totalPoints = calculateTotalPoints(questions)
  const quizResult = calculateQuizScore(
    responseRecords.map((r) => ({ points_earned: r.pointsEarned })),
    totalPoints,
    quiz.passing_score
  )

  // --- Update the quiz_attempt with final score ---
  const { error: updateError } = await serviceClient
    .from('quiz_attempts')
    .update({
      score: quizResult.score,
      passed: quizResult.passed,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', attempt.id)

  if (updateError) {
    console.error('Failed to update quiz attempt score:', updateError.message)
  }

  // --- Return results ---
  return NextResponse.json({
    attempt: {
      id: attempt.id,
      score: quizResult.score,
      passed: quizResult.passed,
      attemptNumber: attemptNumber,
    },
    responses: responseRecords,
    quizTitle: quiz.title,
    passingScore: quiz.passing_score,
  })
}
