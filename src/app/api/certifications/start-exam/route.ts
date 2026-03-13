import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stratifiedSample } from '@/lib/certifications/sampling'

const startExamSchema = z.object({
  trackId: z.string().uuid(),
})

/**
 * POST /api/certifications/start-exam
 *
 * Creates a new certification exam attempt with stratified-sampled questions.
 *
 * Flow:
 * 1. Authenticate user
 * 2. Validate request body (trackId)
 * 3. Fetch track and verify it's published
 * 4. Check prerequisite certification is earned (if required)
 * 5. Enforce attempt limit (max 3 per 30 days)
 * 6. Return existing in-progress attempt if one exists
 * 7. Sample questions using stratified sampling across difficulty levels
 * 8. Create cert_attempt record
 * 9. Return attempt ID + questions (without answers)
 *
 * Uses service role client for the cert_attempt insert because RLS
 * only allows admin writes on that table. The authenticated client
 * is used for auth reads to respect RLS visibility rules.
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

  const parsed = startExamSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { trackId } = parsed.data
  const serviceClient = createServiceClient()

  // --- Fetch track ---
  const { data: track, error: trackError } = await serviceClient
    .from('certification_tracks')
    .select('id, title, slug, tier, prerequisite_track_id, passing_score, exam_duration_minutes, question_pool_size, questions_per_exam, status')
    .eq('id', trackId)
    .eq('status', 'published')
    .single()

  if (trackError || !track) {
    return NextResponse.json({ error: 'Certification track not found' }, { status: 404 })
  }

  // --- Prerequisite check ---
  if (track.prerequisite_track_id) {
    const { data: prereqCert, error: prereqError } = await serviceClient
      .from('certificates')
      .select('id')
      .eq('user_id', user.id)
      .eq('track_id', track.prerequisite_track_id)
      .eq('revoked', false)
      .limit(1)
      .single()

    if (prereqError || !prereqCert) {
      return NextResponse.json(
        { error: 'Prerequisite certification not met. You must earn the prerequisite certification before attempting this exam.' },
        { status: 403 }
      )
    }
  }

  // --- Attempt limit: max 3 per 30 days ---
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { count: recentAttemptCount, error: countError } = await serviceClient
    .from('cert_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('track_id', trackId)
    .gte('started_at', thirtyDaysAgo.toISOString())

  if (countError) {
    console.error('Failed to count recent attempts:', countError.message)
    return NextResponse.json({ error: 'Failed to check attempt history' }, { status: 500 })
  }

  if ((recentAttemptCount ?? 0) >= 3) {
    // Find the earliest recent attempt to calculate when the window resets
    const { data: earliestAttempt } = await serviceClient
      .from('cert_attempts')
      .select('started_at, expires_at')
      .eq('user_id', user.id)
      .eq('track_id', trackId)
      .gte('started_at', thirtyDaysAgo.toISOString())
      .order('started_at', { ascending: true })
      .limit(1)
      .single()

    return NextResponse.json(
      {
        error: 'Maximum attempts (3) reached for this 30-day period. Please try again later.',
        expiresAt: earliestAttempt?.expires_at ?? null,
      },
      { status: 429 }
    )
  }

  // --- Check for existing in-progress attempt ---
  const { data: existingAttempt } = await serviceClient
    .from('cert_attempts')
    .select('id, question_ids, started_at')
    .eq('user_id', user.id)
    .eq('track_id', trackId)
    .is('submitted_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (existingAttempt && existingAttempt.question_ids) {
    // Fetch the questions for the existing attempt (without answers)
    const { data: existingQuestions, error: questionsError } = await serviceClient
      .from('cert_questions')
      .select('id, question_text, question_type, options, max_points')
      .in('id', existingAttempt.question_ids)

    if (questionsError || !existingQuestions) {
      return NextResponse.json({ error: 'Failed to load exam questions' }, { status: 500 })
    }

    // Preserve the order from question_ids
    const questionMap = new Map(existingQuestions.map(q => [q.id, q]))
    const orderedQuestions = existingAttempt.question_ids
      .map(id => questionMap.get(id))
      .filter(Boolean)

    return NextResponse.json({
      attemptId: existingAttempt.id,
      questions: orderedQuestions,
      examDurationMinutes: track.exam_duration_minutes,
      startsAt: existingAttempt.started_at,
    }, { status: 200 })
  }

  // --- Fetch all questions for this track ---
  const { data: allQuestions, error: poolError } = await serviceClient
    .from('cert_questions')
    .select('id, question_text, question_type, options, max_points, difficulty')
    .eq('track_id', trackId)

  if (poolError || !allQuestions || allQuestions.length === 0) {
    return NextResponse.json({ error: 'This certification track has no questions available' }, { status: 404 })
  }

  // --- Stratified sample ---
  const selectedIds = stratifiedSample(
    allQuestions.map(q => ({ id: q.id, difficulty: q.difficulty })),
    track.questions_per_exam
  )

  // --- Calculate attempt number ---
  const { count: totalAttempts } = await serviceClient
    .from('cert_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('track_id', trackId)

  const attemptNumber = (totalAttempts ?? 0) + 1

  // --- Insert cert_attempt ---
  const now = new Date().toISOString()

  const { data: attempt, error: attemptError } = await serviceClient
    .from('cert_attempts')
    .insert({
      user_id: user.id,
      track_id: trackId,
      attempt_number: attemptNumber,
      question_ids: selectedIds,
      started_at: now,
      expires_at: null,
    })
    .select('id, started_at')
    .single()

  if (attemptError || !attempt) {
    console.error('Failed to create cert attempt:', attemptError?.message)
    return NextResponse.json({ error: 'Failed to create exam attempt' }, { status: 500 })
  }

  // --- Fetch selected questions (without correct_answer and rubric) ---
  const { data: selectedQuestions, error: selectedError } = await serviceClient
    .from('cert_questions')
    .select('id, question_text, question_type, options, max_points')
    .in('id', selectedIds)

  if (selectedError || !selectedQuestions) {
    return NextResponse.json({ error: 'Failed to load exam questions' }, { status: 500 })
  }

  // Preserve the order from selectedIds
  const questionMap = new Map(selectedQuestions.map(q => [q.id, q]))
  const orderedQuestions = selectedIds
    .map(id => questionMap.get(id))
    .filter(Boolean)

  return NextResponse.json({
    attemptId: attempt.id,
    questions: orderedQuestions,
    examDurationMinutes: track.exam_duration_minutes,
    startsAt: attempt.started_at,
  }, { status: 201 })
}
