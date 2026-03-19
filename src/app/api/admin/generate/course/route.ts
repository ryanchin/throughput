import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'
import { markdownToTiptap } from '@/lib/generate/markdown-to-tiptap'
import { generateSlug } from '@/lib/utils/slug'
import { callOpenRouter } from '@/lib/openrouter/client'
import { buildContext, type AiContext } from '@/lib/generate/context-builder'
import { logGeneration } from '@/lib/generate/log-generation'
import type { Json, QuestionType } from '@/lib/supabase/database.types'
import { rateLimiters, checkRateLimit } from '@/lib/security/rate-limiter'

/**
 * Phase 1 prompt: Generate the course outline (titles, topics, quiz questions).
 * Content is NOT generated here — just the structure.
 */
const OUTLINE_SYSTEM_PROMPT = `You are an expert instructional designer working for Product Studio.
Generate a course OUTLINE in JSON. Return ONLY valid JSON, no markdown fences, no preamble.

Generate the structure only — do NOT write lesson content yet. Each lesson just needs a title, summary, key topics, and quiz questions.

JSON structure:
{
  "title": string,
  "description": string,
  "learning_objectives": string[],
  "lessons": [
    {
      "title": string,
      "summary": string,
      "key_topics": string[],
      "quiz": {
        "questions": [
          {
            "type": "multiple_choice" | "true_false" | "open_ended",
            "question_text": string,
            "options": [{ "text": string, "is_correct": boolean }],
            "rubric": string
          }
        ]
      }
    }
  ]
}`

/**
 * Phase 2 prompt: Generate deep, comprehensive content for a single lesson.
 */
const LESSON_SYSTEM_PROMPT = `You are an expert instructional designer writing training content for Product Studio.
Write comprehensive, in-depth lesson content in Markdown format. Return ONLY the markdown content, no JSON wrapper, no preamble.

IMPORTANT STRUCTURE: Each lesson is displayed as multiple PAGES — one page per ## section.
Learners click "Next" to advance between pages. Design your content with this in mind:

- Write 5-10 ## sections per lesson, each 300-600 words (one screen of content per page)
- Each ## section should be a self-contained topic that makes sense on its own page
- Use descriptive ## headings that work as page titles (e.g., "## What Is an AI Agent?" not "## Introduction")
- Include detailed explanations, real-world examples, and best practices in each section
- Add a "## Key Takeaways" section at the end
- Total content should be 2000-4000 words across all sections

Structure example:
## Understanding the Core Concept (300-600 words of content)
## How It Works in Practice (300-600 words with examples)
## Step-by-Step Walkthrough (300-600 words with process)
## Common Pitfalls to Avoid (300-600 words)
## Best Practices (300-600 words)
## Key Takeaways (summary + action items)

Write as if you're training someone who needs to apply this knowledge at work tomorrow.
Do NOT write a brief overview. Write the FULL training content.`

const generateCourseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  zone: z.enum(['training', 'sales']).default('training'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  lessonCount: z.number().int().min(1).max(20).nullable().optional(),
  includeQuizzes: z.boolean().default(true),
  instructions: z.string().max(5000).optional(),
  preset: z.enum(['technical', 'conversational', 'assessment', 'beginner']).optional(),
  fileText: z.string().optional(),
  fileName: z.string().optional(),
  courseIds: z.array(z.string().uuid()).optional(),
})

/**
 * POST /api/admin/generate/course
 *
 * Two-phase course generation:
 *   Phase 1: Generate course outline (titles, topics, quiz questions) — fast
 *   Phase 2: Generate deep content for each lesson individually — thorough
 *
 * This approach gives each lesson the full token budget (16K) instead of
 * splitting tokens across all lessons, producing 2000-4000 word lessons.
 */
export async function POST(request: NextRequest) {
  const { error: authError, profile } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const rateLimitResponse = await checkRateLimit(rateLimiters.generateCourse, profile!.id)
  if (rateLimitResponse) return rateLimitResponse

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = generateCourseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const {
    title, zone, description, lessonCount, includeQuizzes,
    instructions, preset, fileText, fileName, courseIds,
  } = parsed.data

  // Build AI context
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
    return NextResponse.json({ error: `Failed to build context: ${message}` }, { status: 500 })
  }

  const startTime = Date.now()

  // ============================================================
  // PHASE 1: Generate course outline
  // ============================================================
  const lessonInstruction = lessonCount
    ? `Create a ${lessonCount}-lesson course`
    : 'Create a course with as many lessons as appropriate for the topic (typically 4-8)'
  const outlinePromptParts = [
    `${lessonInstruction} titled "${title}" for ${zone}.`,
    `Description: ${description}`,
    `Include quizzes: ${includeQuizzes}`,
  ]
  if (contextText.trim()) {
    outlinePromptParts.push(`\n--- Additional Context ---\n${contextText}`)
  }

  let outline: {
    title: string
    description: string
    learning_objectives: string[]
    lessons: Array<{
      title: string
      summary: string
      key_topics: string[]
      quiz?: { questions: Array<{ type: string; question_text: string; options?: Array<{ text: string; is_correct: boolean }>; rubric?: string }> }
    }>
  }

  try {
    const outlineText = await callOpenRouter(
      [
        { role: 'system', content: OUTLINE_SYSTEM_PROMPT },
        { role: 'user', content: outlinePromptParts.join('\n') },
      ],
      { response_format: { type: 'json_object' }, max_tokens: 8192 }
    )

    // Strip markdown fences if present
    const cleaned = outlineText.replace(/^```(?:json)?\n?/gm, '').replace(/\n?```$/gm, '').trim()
    outline = JSON.parse(cleaned)

    if (!outline.lessons || outline.lessons.length === 0) {
      throw new Error('No lessons in outline')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logGeneration({
      adminId: profile!.id, generationType: 'course',
      inputs: { title, zone, description, lessonCount, phase: 'outline' },
      durationMs: Date.now() - startTime, status: 'error', errorMessage: message,
    })
    return NextResponse.json({ error: `Failed to generate course outline: ${message}` }, { status: 500 })
  }

  console.log(`[generate/course] Phase 1 complete: ${outline.lessons.length} lessons outlined in ${((Date.now() - startTime) / 1000).toFixed(1)}s`)

  // ============================================================
  // PHASE 2: Generate deep content for each lesson
  // ============================================================
  const lessonContents: string[] = []

  for (let i = 0; i < outline.lessons.length; i++) {
    const lesson = outline.lessons[i]
    const lessonPromptParts = [
      `Write comprehensive training content for Lesson ${i + 1} of the course "${outline.title}".`,
      `Lesson title: "${lesson.title}"`,
      `Lesson summary: ${lesson.summary}`,
      `Key topics to cover: ${lesson.key_topics.join(', ')}`,
      `Course description: ${description}`,
    ]
    if (contextText.trim()) {
      lessonPromptParts.push(`\n--- Reference Context ---\n${contextText}`)
    }

    try {
      const content = await callOpenRouter(
        [
          { role: 'system', content: LESSON_SYSTEM_PROMPT },
          { role: 'user', content: lessonPromptParts.join('\n') },
        ],
        { max_tokens: 16384 }
      )
      lessonContents.push(content)
      console.log(`[generate/course] Phase 2: Lesson ${i + 1}/${outline.lessons.length} generated (${content.split(/\s+/).length} words)`)
    } catch (err) {
      // If one lesson fails, use a placeholder so the rest still saves
      console.error(`[generate/course] Lesson ${i + 1} generation failed:`, err)
      lessonContents.push(`# ${lesson.title}\n\n${lesson.summary}\n\n*Content generation failed for this lesson. Use the lesson editor to regenerate.*`)
    }
  }

  const totalDurationMs = Date.now() - startTime
  console.log(`[generate/course] Phase 2 complete: all lessons generated in ${(totalDurationMs / 1000).toFixed(1)}s total`)

  // ============================================================
  // PHASE 3: Write everything to DB
  // ============================================================
  const serviceClient = createServiceClient()
  let courseId: string | null = null

  try {
    const { data: course, error: courseError } = await serviceClient
      .from('courses')
      .insert({
        title: outline.title,
        slug: generateSlug(title),
        description: outline.description,
        zone,
        passing_score: 70,
        status: 'draft',
        created_by: profile!.id,
        learning_objectives: outline.learning_objectives,
      })
      .select('id')
      .single()

    if (courseError || !course) {
      return NextResponse.json(
        { error: `Failed to create course: ${courseError?.message ?? 'Unknown error'}` },
        { status: 500 }
      )
    }

    courseId = course.id

    for (let i = 0; i < outline.lessons.length; i++) {
      const lesson = outline.lessons[i]
      const content = lessonContents[i] ?? lesson.summary

      const { data: lessonRow, error: lessonError } = await serviceClient
        .from('lessons')
        .insert({
          course_id: courseId,
          title: lesson.title,
          slug: generateSlug(lesson.title),
          content: markdownToTiptap(content) as unknown as Json,
          order_index: i,
          status: 'draft',
        })
        .select('id')
        .single()

      if (lessonError || !lessonRow) {
        throw new Error(`Failed to create lesson "${lesson.title}": ${lessonError?.message}`)
      }

      if (includeQuizzes && lesson.quiz?.questions?.length) {
        const { data: quizRow, error: quizError } = await serviceClient
          .from('quizzes')
          .insert({
            lesson_id: lessonRow.id,
            title: `${lesson.title} Quiz`,
            passing_score: 70,
          })
          .select('id')
          .single()

        if (quizError || !quizRow) {
          throw new Error(`Failed to create quiz for "${lesson.title}": ${quizError?.message}`)
        }

        for (let j = 0; j < lesson.quiz.questions.length; j++) {
          const q = lesson.quiz.questions[j]
          let correctAnswer: string | null = null
          if (q.type === 'multiple_choice' && q.options?.length) {
            const correctOption = q.options.find((o) => o.is_correct)
            correctAnswer = correctOption?.text ?? null
          } else if (q.type === 'true_false') {
            correctAnswer = 'true'
          }

          const { error: questionError } = await serviceClient
            .from('questions')
            .insert({
              quiz_id: quizRow.id,
              question_type: q.type as QuestionType,
              question_text: q.question_text,
              options: (q.type === 'multiple_choice' ? q.options : null) as Json | null,
              correct_answer: correctAnswer,
              rubric: q.rubric ?? null,
              max_points: 10,
              order_index: j,
            })

          if (questionError) {
            throw new Error(`Failed to create question: ${questionError.message}`)
          }
        }
      }
    }

    logGeneration({
      adminId: profile!.id, generationType: 'course',
      inputs: { title, zone, description, lessonCount: outline.lessons.length, includeQuizzes, hasContext: !!contextText.trim() },
      outputSummary: `Generated "${outline.title}" with ${outline.lessons.length} in-depth lessons`,
      durationMs: totalDurationMs, status: 'success',
    })

    return NextResponse.json({ courseId }, { status: 201 })
  } catch (err) {
    if (courseId) {
      await serviceClient.from('courses').delete().eq('id', courseId)
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to save generated course: ${message}` }, { status: 500 })
  }
}
