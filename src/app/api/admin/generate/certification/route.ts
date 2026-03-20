import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { callOpenRouter } from '@/lib/openrouter/client'
import { buildContext, type AiContext } from '@/lib/generate/context-builder'
import { logGeneration } from '@/lib/generate/log-generation'
import { rateLimiters, checkRateLimit } from '@/lib/security/rate-limiter'

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert certification exam designer working for AAVA Product Studio.
Generate certification exam questions in JSON. Return ONLY valid JSON, no markdown fences, no preamble.

JSON structure:
{
  "questions": [
    {
      "question_text": string,
      "question_type": "multiple_choice" | "open_ended",
      "options": [{ "text": string, "is_correct": boolean }],
      "correct_answer": string,
      "rubric": string,
      "difficulty": "easy" | "medium" | "hard",
      "max_points": 10
    }
  ]
}

Rules:
- For multiple_choice: provide exactly 4 options, exactly 1 correct. Set correct_answer to the correct option text. rubric should be null.
- For open_ended: options should be null. correct_answer should be null. Provide a detailed rubric for grading (what a full-marks answer looks like, partial credit criteria).
- Distribute difficulty: roughly 30% easy, 50% medium, 20% hard.
- All questions should be certification-quality: scenario-based, application-focused, not trivial recall.
- max_points is always 10.`

// ---------------------------------------------------------------------------
// Input Schema
// ---------------------------------------------------------------------------

const generateCertificationSchema = z.object({
  trackTitle: z.string().min(1, 'Track title is required').max(200),
  trackDescription: z.string().max(2000).optional(),
  questionCount: z.number().int().min(1).max(100).default(30),
  questionTypes: z
    .array(z.enum(['multiple_choice', 'open_ended']))
    .min(1)
    .default(['multiple_choice', 'open_ended']),
  // AI context fields
  instructions: z.string().max(50000).optional(),
  preset: z.enum(['technical', 'conversational', 'assessment', 'beginner']).optional(),
  fileText: z.string().optional(),
  fileName: z.string().optional(),
  courseIds: z.array(z.string().uuid()).optional(),
})

// ---------------------------------------------------------------------------
// Response Validation
// ---------------------------------------------------------------------------

const certQuestionSchema = z.object({
  question_text: z.string().min(1),
  question_type: z.enum(['multiple_choice', 'open_ended']),
  options: z
    .array(
      z.object({
        text: z.string().min(1),
        is_correct: z.boolean(),
      })
    )
    .nullable()
    .optional(),
  correct_answer: z.string().nullable().optional(),
  rubric: z.string().nullable().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  max_points: z.number().int().min(1).default(10),
})

const certResponseSchema = z.object({
  questions: z.array(certQuestionSchema).min(1, 'Must generate at least one question'),
})

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

/**
 * POST /api/admin/generate/certification
 *
 * Generates certification exam questions using OpenRouter LLM.
 * Returns the questions array -- does NOT write to DB. The caller
 * (admin UI) handles persisting questions to cert_questions.
 *
 * Accepts optional AI context: instructions, preset, fileText, fileName,
 * courseIds -- assembled via buildContext() and injected into the prompt.
 */
export async function POST(request: NextRequest) {
  const { error: authError, profile } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // --- Rate limiting: 20 generations per admin per day ---
  const rateLimitResponse = await checkRateLimit(rateLimiters.generateCertification, profile!.id)
  if (rateLimitResponse) return rateLimitResponse

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = generateCertificationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const {
    trackTitle, trackDescription, questionCount, questionTypes,
    instructions, preset, fileText, fileName, courseIds,
  } = parsed.data

  // Build AI context from optional inputs
  const aiContext: AiContext = {
    instructions: instructions ?? null,
    preset: preset ?? null,
    fileText: fileText ?? null,
    fileName: fileName ?? null,
    fileWordCount: fileText ? fileText.split(/\s+/).filter(Boolean).length : 0,
    courseIds: courseIds ?? [],
  }

  let contextText = ''
  try {
    const built = await buildContext(aiContext)
    contextText = built.contextText
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to build context: ${message}` },
      { status: 500 }
    )
  }

  // Build user prompt
  const promptParts = [
    `Generate ${questionCount} certification exam questions for the track titled "${trackTitle}".`,
    `Allowed question types: ${questionTypes.join(', ')}.`,
  ]
  if (trackDescription) {
    promptParts.push(`Track description: ${trackDescription}`)
  }
  if (contextText.trim()) {
    promptParts.push(`\n--- Additional Context ---\n${contextText}`)
  }
  const userPrompt = promptParts.join('\n')

  const startTime = Date.now()
  let llmResponseText: string
  try {
    llmResponseText = await callOpenRouter(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      {
        response_format: { type: 'json_object' },
        max_tokens: 8192,
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const durationMs = Date.now() - startTime

    logGeneration({
      adminId: profile!.id,
      generationType: 'certification',
      inputs: { trackTitle, questionCount, questionTypes, hasContext: !!contextText.trim() },
      durationMs,
      status: 'error',
      errorMessage: message,
    })

    return NextResponse.json(
      { error: `Failed to call LLM: ${message}` },
      { status: 500 }
    )
  }

  const durationMs = Date.now() - startTime

  // Parse and validate the LLM JSON response
  let questions
  try {
    // Strip markdown code fences if present
    let cleaned = llmResponseText.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '')
      cleaned = cleaned.replace(/\n?\s*```\s*$/, '')
    }

    const rawParsed = JSON.parse(cleaned)
    const validated = certResponseSchema.safeParse(rawParsed)

    if (!validated.success) {
      const issues = validated.error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n')
      throw new Error(`Validation failed:\n${issues}`)
    }

    questions = validated.data.questions
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    logGeneration({
      adminId: profile!.id,
      generationType: 'certification',
      inputs: { trackTitle, questionCount, questionTypes },
      durationMs,
      status: 'error',
      errorMessage: `Parse failed: ${message}`,
    })

    return NextResponse.json(
      { error: `Failed to parse LLM response: ${message}` },
      { status: 500 }
    )
  }

  // Log the successful generation (non-blocking)
  logGeneration({
    adminId: profile!.id,
    generationType: 'certification',
    inputs: { trackTitle, questionCount, questionTypes, hasContext: !!contextText.trim() },
    outputSummary: `Generated ${questions.length} certification questions for "${trackTitle}"`,
    durationMs,
    status: 'success',
  })

  return NextResponse.json({ questions })
}
