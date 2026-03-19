import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { markdownToTiptap } from '@/lib/generate/markdown-to-tiptap'
import { callOpenRouter } from '@/lib/openrouter/client'
import { buildContext, type AiContext } from '@/lib/generate/context-builder'
import { logGeneration } from '@/lib/generate/log-generation'
import { rateLimiters, checkRateLimit } from '@/lib/security/rate-limiter'

const SYSTEM_PROMPT = `You are an expert instructional designer writing training content for Product Studio.
Write comprehensive, in-depth lesson content in Markdown format. Return ONLY the markdown content, no JSON wrapper, no preamble.

IMPORTANT STRUCTURE: Each lesson is displayed as multiple PAGES — one page per ## section.
Learners click "Next" to advance between pages. Design your content with this in mind:

- Write 5-10 ## sections per lesson, each 300-600 words (one screen of content per page)
- Each ## section should be a self-contained topic that makes sense on its own page
- Use descriptive ## headings that work as page titles (e.g., "## What Is an AI Agent?" not "## Introduction")
- Include detailed explanations, real-world examples, and best practices in each section
- Add a "## Key Takeaways" section at the end
- Total content should be 2000-4000 words across all sections

Write as if you're training someone who needs to apply this knowledge at work tomorrow.
Do NOT write a brief overview. Write the FULL training content with proper ## section structure.`

const generateLessonSchema = z.object({
  courseTitle: z.string().min(1, 'Course title is required'),
  courseDescription: z.string().optional(),
  lessonTitle: z.string().min(1, 'Lesson title is required'),
  additionalNotes: z.string().max(2000).optional(),
  // AI context fields
  instructions: z.string().max(5000).optional(),
  preset: z.enum(['technical', 'conversational', 'assessment', 'beginner']).optional(),
  fileText: z.string().optional(),
  fileName: z.string().optional(),
  courseIds: z.array(z.string().uuid()).optional(),
})

/**
 * POST /api/admin/generate/lesson
 *
 * Generates content for a single lesson using OpenRouter LLM.
 * Returns the generated content as a Tiptap JSON document, ready
 * to be loaded into the block editor. Does not persist to DB --
 * the admin reviews and saves via the lesson editor.
 *
 * Accepts optional AI context: instructions, preset, fileText, fileName,
 * courseIds -- assembled via buildContext() and injected into the prompt.
 */
export async function POST(request: NextRequest) {
  const { error: authError, profile } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // --- Rate limiting: 50 generations per admin per day ---
  const rateLimitResponse = await checkRateLimit(rateLimiters.generateLesson, profile!.id)
  if (rateLimitResponse) return rateLimitResponse

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

  const {
    courseTitle, courseDescription, lessonTitle, additionalNotes,
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
  if (contextText.trim()) {
    parts.push(`\n--- Additional Context ---\n${contextText}`)
  }
  const userPrompt = parts.join('\n')

  const startTime = Date.now()
  let markdownContent: string
  try {
    markdownContent = await callOpenRouter(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { max_tokens: 16384 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const durationMs = Date.now() - startTime

    logGeneration({
      adminId: profile!.id,
      generationType: 'lesson',
      inputs: { courseTitle, lessonTitle, hasContext: !!contextText.trim() },
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

  // Convert the markdown to Tiptap JSON document
  let content
  try {
    content = markdownToTiptap(markdownContent)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    logGeneration({
      adminId: profile!.id,
      generationType: 'lesson',
      inputs: { courseTitle, lessonTitle },
      durationMs,
      status: 'error',
      errorMessage: `Markdown conversion failed: ${message}`,
    })

    return NextResponse.json(
      { error: `Failed to convert markdown to editor format: ${message}` },
      { status: 500 }
    )
  }

  // Log the successful generation (non-blocking)
  logGeneration({
    adminId: profile!.id,
    generationType: 'lesson',
    inputs: { courseTitle, lessonTitle, hasContext: !!contextText.trim() },
    outputSummary: `Generated lesson "${lessonTitle}" for course "${courseTitle}"`,
    durationMs,
    status: 'success',
  })

  return NextResponse.json({ content })
}
