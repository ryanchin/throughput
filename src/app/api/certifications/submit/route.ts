import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { gradeOpenEndedResponse, type GradeResult } from '@/lib/openrouter/grader'
import { calculateQuizScore } from '@/lib/scoring/calculator'
import { calculateTotalPoints } from '@/lib/quiz/calculator'
import { generateCertNumber } from '@/lib/certifications/cert-number'
import { generateVerificationHash } from '@/lib/certifications/verification'
import { rateLimiters, checkRateLimit } from '@/lib/security/rate-limiter'

const answerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.string().min(1, 'Answer is required'),
})

const submitSchema = z.object({
  attemptId: z.string().uuid(),
  answers: z.array(answerSchema).min(1, 'At least one answer is required'),
})

/**
 * POST /api/certifications/submit
 *
 * Grades a certification exam attempt and issues a certificate on pass.
 *
 * Flow:
 * 1. Authenticate user
 * 2. Validate request body (attemptId + answers array)
 * 3. Fetch the cert_attempt and verify ownership
 * 4. Check the attempt hasn't already been submitted
 * 5. Fetch the track for passing_score
 * 6. Fetch questions using the stored question_ids (with correct_answer + rubric)
 * 7. Grade MC via exact match, open-ended via LLM (same pattern as quiz/submit)
 * 8. Calculate score against track passing_score (80%)
 * 9. Update cert_attempt with score, passed, submitted_at
 * 10. If passed: generate certificate with cert_number + verification_hash
 * 11. Return results
 *
 * Uses service role client for all DB writes (cert_attempts, certificates)
 * because RLS only allows admin writes on those tables. The authenticated
 * client is used for auth reads to respect RLS visibility rules.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // --- Auth ---
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // --- Rate limiting: 5 submissions per user per day ---
  const rateLimitResponse = await checkRateLimit(rateLimiters.certSubmit, user.id)
  if (rateLimitResponse) return rateLimitResponse

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

  const { attemptId, answers } = parsed.data
  const serviceClient = createServiceClient()

  // --- Fetch cert_attempt ---
  const { data: attempt, error: attemptError } = await serviceClient
    .from('cert_attempts')
    .select('id, user_id, track_id, attempt_number, question_ids, submitted_at')
    .eq('id', attemptId)
    .single()

  if (attemptError || !attempt) {
    return NextResponse.json({ error: 'Exam attempt not found' }, { status: 404 })
  }

  // --- Verify ownership ---
  if (attempt.user_id !== user.id) {
    return NextResponse.json({ error: 'You do not have permission to submit this attempt' }, { status: 403 })
  }

  // --- Check if already submitted ---
  if (attempt.submitted_at !== null) {
    return NextResponse.json({ error: 'This exam attempt has already been submitted' }, { status: 400 })
  }

  // --- Fetch track for passing_score ---
  const { data: track, error: trackError } = await serviceClient
    .from('certification_tracks')
    .select('id, title, passing_score')
    .eq('id', attempt.track_id)
    .single()

  if (trackError || !track) {
    return NextResponse.json({ error: 'Certification track not found' }, { status: 404 })
  }

  // --- Fetch questions with answers ---
  if (!attempt.question_ids || attempt.question_ids.length === 0) {
    return NextResponse.json({ error: 'No questions found for this attempt' }, { status: 400 })
  }

  const { data: questions, error: questionsError } = await serviceClient
    .from('cert_questions')
    .select('id, question_text, question_type, options, correct_answer, rubric, max_points')
    .in('id', attempt.question_ids)

  if (questionsError || !questions || questions.length === 0) {
    return NextResponse.json({ error: 'Failed to load exam questions' }, { status: 500 })
  }

  // --- Build lookup map: questionId -> question ---
  const questionMap = new Map(questions.map(q => [q.id, q]))

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
      // Skip answers for questions not in this attempt
      continue
    }

    let isCorrect = false
    let pointsEarned = 0
    let llmFeedback: GradeResult | null = null

    if (question.question_type === 'multiple_choice') {
      // --- MC: exact match (case-insensitive, trimmed) ---
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
      } catch {
        // LLM grading failed — score 0, provide feedback about the failure
        pointsEarned = 0
        isCorrect = false
        llmFeedback = {
          score: 0,
          feedback: 'Grading failed due to a system error. Please contact support for manual review.',
          strengths: [],
          improvements: [],
        }
      }
    }

    responseRecords.push({
      questionId: question.id,
      questionText: question.question_text,
      questionType: question.question_type,
      userAnswer: answer.answer,
      isCorrect,
      pointsEarned,
      maxPoints: question.max_points,
      // Only reveal correct answer for MC, not open-ended
      correctAnswer: question.question_type !== 'open_ended' ? question.correct_answer : null,
      llmFeedback,
    })
  }

  // --- Calculate exam score ---
  const totalPoints = calculateTotalPoints(questions)
  const examResult = calculateQuizScore(
    responseRecords.map(r => ({ points_earned: r.pointsEarned })),
    totalPoints,
    track.passing_score
  )

  // --- Update cert_attempt ---
  const now = new Date().toISOString()
  const cooldownExpiry = new Date()
  cooldownExpiry.setHours(cooldownExpiry.getHours() + 24)

  const { error: updateError } = await serviceClient
    .from('cert_attempts')
    .update({
      score: examResult.score,
      passed: examResult.passed,
      submitted_at: now,
      expires_at: examResult.passed ? null : cooldownExpiry.toISOString(),
    })
    .eq('id', attempt.id)

  if (updateError) {
    console.error('Failed to update cert attempt:', updateError.message)
  }

  // --- If PASSED: generate certificate ---
  if (examResult.passed) {
    const currentYear = new Date().getFullYear()

    // Count existing certificates this year for sequence number
    const { count: certsThisYear } = await serviceClient
      .from('certificates')
      .select('id', { count: 'exact', head: true })
      .like('cert_number', `AAVA-${currentYear}-%`)

    const sequence = (certsThisYear ?? 0) + 1
    const certNumber = generateCertNumber(currentYear, sequence)
    const certId = crypto.randomUUID()
    const issuedAt = now
    const verificationHash = generateVerificationHash(certId, user.id, issuedAt)

    const { error: certError } = await serviceClient
      .from('certificates')
      .insert({
        id: certId,
        user_id: user.id,
        track_id: track.id,
        attempt_id: attempt.id,
        cert_number: certNumber,
        verification_hash: verificationHash,
        issued_at: issuedAt,
        expires_at: null,
        revoked: false,
      })

    if (certError) {
      console.error('Failed to insert certificate:', certError.message)
      // Still return passed result — certificate can be re-generated manually
      return NextResponse.json({
        passed: true,
        score: examResult.score,
        attemptId: attempt.id,
        certError: 'Certificate generation failed. Please contact support.',
        responses: responseRecords,
      })
    }

    return NextResponse.json({
      passed: true,
      score: examResult.score,
      certHash: verificationHash,
      certNumber,
      attemptId: attempt.id,
      responses: responseRecords,
    })
  }

  // --- If FAILED ---
  return NextResponse.json({
    passed: false,
    score: examResult.score,
    nextAttemptAvailable: cooldownExpiry.toISOString(),
    attemptId: attempt.id,
    responses: responseRecords,
  })
}
