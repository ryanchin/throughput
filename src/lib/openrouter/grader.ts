/**
 * LLM-based grading for open-ended quiz questions.
 *
 * Uses the OpenRouter client to evaluate learner responses against
 * a rubric, returning a structured score with narrative feedback.
 *
 * Server-side only — never import this in client components.
 */

import { callOpenRouter } from './client'

export interface GradeResult {
  /** Score from 0 to max_points */
  score: number
  /** Full narrative feedback (2-3 sentences) */
  feedback: string
  /** Bullet list of strengths in the response */
  strengths: string[]
  /** Bullet list of areas for improvement */
  improvements: string[]
}

/**
 * Grade an open-ended quiz response using LLM.
 *
 * Sends the question, rubric, and learner answer to OpenRouter and
 * parses the structured JSON response. Falls back to safe defaults
 * if the LLM response is malformed.
 *
 * @param questionText - The question that was asked
 * @param rubric       - Grading rubric/criteria for the question
 * @param userAnswer   - The learner's response
 * @param maxPoints    - Maximum points for this question
 * @returns Structured grading result with score, feedback, strengths, improvements
 */
export async function gradeOpenEndedResponse(
  questionText: string,
  rubric: string,
  userAnswer: string,
  maxPoints: number
): Promise<GradeResult> {
  const systemPrompt = `You are an expert training evaluator for AAVA Product Studio. Grade the learner's response to a quiz question.

You must return ONLY valid JSON with this exact structure:
{
  "score": <number 0-${maxPoints}>,
  "feedback": "<2-3 sentence narrative assessment>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"]
}

Grading criteria:
- Score 0: No relevant content or completely wrong
- Score 1-${Math.floor(maxPoints * 0.4)}: Partially addresses the question but misses key points
- Score ${Math.floor(maxPoints * 0.4) + 1}-${Math.floor(maxPoints * 0.7)}: Addresses most points but lacks depth
- Score ${Math.floor(maxPoints * 0.7) + 1}-${maxPoints}: Comprehensive and accurate response

Be fair but rigorous. Give specific, actionable feedback.`

  const userMessage = `Question: ${questionText}

Grading Rubric: ${rubric}

Learner's Response: ${userAnswer}

Grade this response. Return ONLY valid JSON.`

  const raw = await callOpenRouter(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    {
      temperature: 0.3,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    }
  )

  return parseGradeResponse(raw, maxPoints)
}

/**
 * Parse and validate the LLM grading response.
 *
 * Clamps the score to [0, maxPoints] and falls back to safe defaults
 * if the response JSON is malformed or unparseable.
 */
export function parseGradeResponse(raw: string, maxPoints: number): GradeResult {
  try {
    const parsed = JSON.parse(raw)

    // Validate and clamp score to [0, maxPoints]
    const score = typeof parsed.score === 'number'
      ? Math.min(Math.max(Math.round(parsed.score), 0), maxPoints)
      : 0

    const feedback = typeof parsed.feedback === 'string' && parsed.feedback.length > 0
      ? parsed.feedback
      : 'Unable to generate detailed feedback.'

    const strengths = Array.isArray(parsed.strengths)
      ? parsed.strengths.filter((s: unknown) => typeof s === 'string')
      : []

    const improvements = Array.isArray(parsed.improvements)
      ? parsed.improvements.filter((s: unknown) => typeof s === 'string')
      : []

    return { score, feedback, strengths, improvements }
  } catch {
    // JSON parse failed — return safe defaults
    return {
      score: 0,
      feedback: 'Unable to grade this response automatically. Please contact your instructor.',
      strengths: [],
      improvements: [],
    }
  }
}
