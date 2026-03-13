import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'
import { parseCourseResponse } from '@/lib/generate/parser'
import { markdownToTiptap } from '@/lib/generate/markdown-to-tiptap'
import { generateSlug } from '@/lib/utils/slug'
import type { Json, QuestionType } from '@/lib/supabase/database.types'

const SYSTEM_PROMPT = `You are an expert instructional designer and product management trainer working for AAVA Product Studio.
Generate a complete course outline in JSON. Return ONLY valid JSON, no markdown fences, no preamble.

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
      "content_outline": string,
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

const generateCourseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  zone: z.enum(['training', 'sales']).default('training'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  lessonCount: z.number().int().min(1).max(20).default(5),
  includeQuizzes: z.boolean().default(true),
})

/**
 * POST /api/admin/generate/course
 *
 * Generates a full course with lessons (and optionally quizzes) using
 * OpenRouter LLM. All generated content is created in draft status.
 * Uses the service role client for DB writes to bypass RLS.
 */
export async function POST(request: NextRequest) {
  const { error: authError, profile } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

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

  const { title, zone, description, lessonCount, includeQuizzes } = parsed.data

  // Call OpenRouter to generate the course outline
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenRouter API key is not configured' },
      { status: 500 }
    )
  }

  const userPrompt = `Create a ${lessonCount}-lesson course titled "${title}" for ${zone}.\nDescription: ${description}\nInclude quizzes: ${includeQuizzes}`

  let llmResponseText: string
  try {
    const llmResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        response_format: { type: 'json_object' },
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

    llmResponseText = choice.message.content
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to call LLM: ${message}` },
      { status: 500 }
    )
  }

  // Parse the LLM JSON response into a structured course
  let generatedCourse
  try {
    generatedCourse = parseCourseResponse(llmResponseText)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to parse LLM response: ${message}` },
      { status: 500 }
    )
  }

  // Write everything to the DB using the service role client.
  // Service role bypasses RLS — we already validated the admin session above.
  const serviceClient = createServiceClient()
  let courseId: string | null = null

  try {
    // 1. Create the course
    const { data: course, error: courseError } = await serviceClient
      .from('courses')
      .insert({
        title: generatedCourse.title,
        slug: generateSlug(title),
        description: generatedCourse.description,
        zone,
        passing_score: 70,
        status: 'draft',
        created_by: profile!.id,
        learning_objectives: generatedCourse.learning_objectives,
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

    // 2. Create lessons (and optionally quizzes + questions)
    for (let i = 0; i < generatedCourse.lessons.length; i++) {
      const lesson = generatedCourse.lessons[i]

      const { data: lessonRow, error: lessonError } = await serviceClient
        .from('lessons')
        .insert({
          course_id: courseId,
          title: lesson.title,
          slug: generateSlug(lesson.title),
          content: markdownToTiptap(lesson.content_outline) as unknown as Json,
          order_index: i,
          status: 'draft',
        })
        .select('id')
        .single()

      if (lessonError || !lessonRow) {
        throw new Error(`Failed to create lesson "${lesson.title}": ${lessonError?.message}`)
      }

      // Create quiz and questions if requested and available
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

          // Determine the correct_answer based on question type
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

    return NextResponse.json({ courseId }, { status: 201 })
  } catch (err) {
    // Attempt cleanup: delete the course (cascade will remove lessons/quizzes/questions)
    if (courseId) {
      await serviceClient.from('courses').delete().eq('id', courseId)
    }

    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to save generated course: ${message}` },
      { status: 500 }
    )
  }
}
