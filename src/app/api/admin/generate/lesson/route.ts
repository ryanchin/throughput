import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { markdownToTiptap } from '@/lib/generate/markdown-to-tiptap'

const SYSTEM_PROMPT =
  'You are an expert instructional designer. Generate detailed lesson content in Markdown format. Include headers, bullet points, and clear explanations. Return ONLY the markdown content, no JSON wrapper.'

const generateLessonSchema = z.object({
  courseTitle: z.string().min(1, 'Course title is required'),
  courseDescription: z.string().optional(),
  lessonTitle: z.string().min(1, 'Lesson title is required'),
  additionalNotes: z.string().max(2000).optional(),
})

/**
 * POST /api/admin/generate/lesson
 *
 * Generates content for a single lesson using OpenRouter LLM.
 * Returns the generated content as a Tiptap JSON document, ready
 * to be loaded into the block editor. Does not persist to DB —
 * the admin reviews and saves via the lesson editor.
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = generateLessonSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { courseTitle, courseDescription, lessonTitle, additionalNotes } = parsed.data

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenRouter API key is not configured' },
      { status: 500 }
    )
  }

  // Build the user prompt with optional context
  const parts = [
    `Generate content for a lesson titled "${lessonTitle}" in the course "${courseTitle}".`,
  ]
  if (courseDescription) {
    parts.push(`Course description: ${courseDescription}`)
  }
  if (additionalNotes) {
    parts.push(`Additional notes: ${additionalNotes}`)
  }
  const userPrompt = parts.join('\n')

  let markdownContent: string
  try {
    const llmResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    if (!llmResponse.ok) {
      const errorBody = await llmResponse.text()
      return NextResponse.json(
        { error: `LLM request failed with status ${llmResponse.status}: ${errorBody}` },
        { status: 500 }
      )
    }

    const llmData = await llmResponse.json()
    const choice = llmData.choices?.[0]
    if (!choice?.message?.content) {
      return NextResponse.json(
        { error: 'LLM returned an empty response' },
        { status: 500 }
      )
    }

    markdownContent = choice.message.content
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to call LLM: ${message}` },
      { status: 500 }
    )
  }

  // Convert the markdown to Tiptap JSON document
  let content
  try {
    content = markdownToTiptap(markdownContent)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to convert markdown to editor format: ${message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ content })
}
