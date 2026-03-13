import { z } from 'zod'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeneratedQuestion {
  type: 'multiple_choice' | 'true_false' | 'open_ended'
  question_text: string
  options?: { text: string; is_correct: boolean }[]
  rubric?: string
}

export interface GeneratedLesson {
  title: string
  summary: string
  key_topics: string[]
  content_outline: string
  quiz?: {
    questions: GeneratedQuestion[]
  }
}

export interface GeneratedCourse {
  title: string
  description: string
  learning_objectives: string[]
  lessons: GeneratedLesson[]
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const questionOptionSchema = z.object({
  text: z.string().min(1, 'Option text must not be empty'),
  is_correct: z.boolean(),
})

const generatedQuestionSchema = z
  .object({
    type: z.enum(['multiple_choice', 'true_false', 'open_ended']),
    question_text: z.string().min(1, 'Question text must not be empty'),
    options: z.array(questionOptionSchema).optional(),
    rubric: z.string().optional(),
  })
  .superRefine((q, ctx) => {
    if (q.type === 'multiple_choice') {
      if (!q.options || q.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Multiple choice questions must have at least 2 options',
          path: ['options'],
        })
      }
    }
  })
  .transform((q) => {
    // Auto-generate options for true_false if not provided
    if (q.type === 'true_false' && (!q.options || q.options.length === 0)) {
      return {
        ...q,
        options: [
          { text: 'True', is_correct: true },
          { text: 'False', is_correct: false },
        ],
      }
    }
    return q
  })

const generatedLessonSchema = z.object({
  title: z.string().min(1, 'Lesson title must not be empty'),
  summary: z.string().min(1, 'Lesson summary must not be empty'),
  key_topics: z
    .array(z.string().min(1))
    .min(1, 'Lesson must have at least one key topic'),
  content_outline: z
    .string()
    .min(1, 'Lesson content outline must not be empty'),
  quiz: z
    .object({
      questions: z
        .array(generatedQuestionSchema)
        .min(1, 'Quiz must have at least one question'),
    })
    .optional(),
})

export const generatedCourseSchema = z.object({
  title: z.string().min(1, 'Course title must not be empty'),
  description: z.string().min(1, 'Course description must not be empty'),
  learning_objectives: z
    .array(z.string().min(1))
    .min(1, 'Course must have at least one learning objective'),
  lessons: z
    .array(generatedLessonSchema)
    .min(1, 'Course must have at least one lesson'),
})

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parses and validates a raw JSON string returned by the LLM into a
 * strongly-typed {@link GeneratedCourse} object.
 *
 * The function:
 * 1. Strips optional markdown code-fence wrappers (`\`\`\`json ... \`\`\``)
 * 2. Parses the JSON string
 * 3. Validates the structure with Zod, throwing a descriptive error on failure
 * 4. Auto-generates True/False options for `true_false` questions when missing
 *
 * @param raw - The raw string response from the LLM (expected to be JSON)
 * @returns A validated {@link GeneratedCourse} object
 * @throws {Error} If the string is not valid JSON or fails schema validation
 */
export function parseCourseResponse(raw: string): GeneratedCourse {
  // Strip markdown code fences that LLMs sometimes wrap around JSON
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    // Remove opening fence (```json or just ```)
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '')
    // Remove closing fence
    cleaned = cleaned.replace(/\n?\s*```\s*$/, '')
  }

  // Parse JSON
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown JSON parse error'
    throw new Error(`Failed to parse LLM response as JSON: ${message}`)
  }

  // Validate with Zod
  const result = generatedCourseSchema.safeParse(parsed)

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(
      `LLM response failed validation:\n${issues}`
    )
  }

  return result.data as GeneratedCourse
}
