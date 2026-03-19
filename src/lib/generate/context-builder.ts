import 'server-only'

import { createServiceClient } from '@/lib/supabase/server'
import { callOpenRouter } from '@/lib/openrouter/client'

/** Maximum word count before triggering smart summarization. */
const SUMMARIZATION_THRESHOLD = 12_000

export interface AiContext {
  instructions: string | null
  preset: string | null
  fileText: string | null
  fileName: string | null
  fileWordCount: number
  courseIds: string[]
}

export interface BuiltContext {
  /** Combined context string ready for the LLM prompt. */
  contextText: string
  /** Total word count of the final context. */
  totalWords: number
  /** Whether summarization was triggered. */
  wasSummarized: boolean
}

/**
 * Build the final context string from admin-provided inputs.
 * Fetches course content from DB, combines all sources, and
 * applies smart truncation (summarization) if total exceeds threshold.
 */
export async function buildContext(ctx: AiContext): Promise<BuiltContext> {
  const parts: { label: string; text: string }[] = []

  // 1. Style preset → instruction prefix
  if (ctx.preset) {
    const presetInstructions = PRESET_MAP[ctx.preset]
    if (presetInstructions) {
      parts.push({ label: 'Style', text: presetInstructions })
    }
  }

  // 2. Custom instructions
  if (ctx.instructions?.trim()) {
    parts.push({ label: 'Instructions', text: ctx.instructions.trim() })
  }

  // 3. File content
  if (ctx.fileText?.trim()) {
    parts.push({
      label: `File: ${ctx.fileName ?? 'uploaded file'}`,
      text: ctx.fileText.trim(),
    })
  }

  // 4. Course content
  if (ctx.courseIds.length > 0) {
    const courseTexts = await fetchCourseContent(ctx.courseIds)
    for (const ct of courseTexts) {
      if (ct.text.trim()) {
        parts.push({ label: `Course: ${ct.title}`, text: ct.text.trim() })
      }
    }
  }

  // Calculate total words
  const totalWords = parts.reduce(
    (sum, p) => sum + p.text.split(/\s+/).filter(Boolean).length,
    0
  )

  // Smart truncation: summarize if over threshold
  let wasSummarized = false
  let contextText: string

  if (totalWords > SUMMARIZATION_THRESHOLD) {
    try {
      contextText = await summarizeContext(parts)
      wasSummarized = true
    } catch {
      // Degrade gracefully: simple truncation
      contextText = simpleJoin(parts, SUMMARIZATION_THRESHOLD)
    }
  } else {
    contextText = simpleJoin(parts)
  }

  const finalWords = contextText.split(/\s+/).filter(Boolean).length

  return { contextText, totalWords: finalWords, wasSummarized }
}

/** Fetch lesson content text for the given course IDs. */
async function fetchCourseContent(
  courseIds: string[]
): Promise<{ title: string; text: string }[]> {
  const serviceClient = createServiceClient()

  const { data: courses } = await serviceClient
    .from('courses')
    .select('id, title')
    .in('id', courseIds)

  if (!courses || courses.length === 0) return []

  const { data: lessons } = await serviceClient
    .from('lessons')
    .select('course_id, content')
    .in('course_id', courseIds)
    .eq('status', 'published')

  if (!lessons) return []

  // Group lessons by course and extract text
  const courseMap = new Map(courses.map((c) => [c.id, c.title]))
  const textByCourse = new Map<string, string[]>()

  for (const lesson of lessons) {
    const text = extractTiptapText(lesson.content)
    if (text) {
      const existing = textByCourse.get(lesson.course_id) ?? []
      existing.push(text)
      textByCourse.set(lesson.course_id, existing)
    }
  }

  return courseIds
    .filter((id) => courseMap.has(id))
    .map((id) => ({
      title: courseMap.get(id)!,
      text: (textByCourse.get(id) ?? []).join('\n\n'),
    }))
}

/** Recursively extract plain text from Tiptap JSON content. */
function extractTiptapText(content: unknown): string {
  if (!content || typeof content !== 'object') return ''
  const node = content as Record<string, unknown>
  let text = ''
  if (node.text && typeof node.text === 'string') text += node.text
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      text += extractTiptapText(child) + ' '
    }
  }
  return text.trim()
}

/** Summarize long context using an LLM call. */
async function summarizeContext(
  parts: { label: string; text: string }[]
): Promise<string> {
  const input = parts
    .map((p) => `### ${p.label}\n${p.text.slice(0, 3000)}`)
    .join('\n\n')

  const summary = await callOpenRouter(
    [
      {
        role: 'system',
        content:
          'Summarize the following context into a concise reference document. Preserve key facts, terminology, and concepts. Keep it under 3000 words. Return only the summary text, no preamble.',
      },
      { role: 'user', content: input },
    ],
    { temperature: 0.2, max_tokens: 4096 }
  )

  return summary
}

/** Join parts with labels, optionally truncating to a word limit. */
function simpleJoin(
  parts: { label: string; text: string }[],
  maxWords?: number
): string {
  const full = parts.map((p) => `### ${p.label}\n${p.text}`).join('\n\n')
  if (!maxWords) return full

  const words = full.split(/\s+/)
  if (words.length <= maxWords) return full
  return words.slice(0, maxWords).join(' ') + '\n\n[Context truncated]'
}

/** Map of preset names to instruction text. */
const PRESET_MAP: Record<string, string> = {
  technical:
    'Write in a technical, precise tone. Use industry terminology. Be formal and detailed. Include specific examples and data points where relevant.',
  conversational:
    'Write in a friendly, conversational tone. Use clear, simple language. Be engaging and approachable. Use analogies and real-world examples.',
  assessment:
    'Focus on assessment and evaluation. Generate content that tests understanding. Include challenging scenarios, edge cases, and application-based questions.',
  beginner:
    'Write for beginners with no prior knowledge. Use simple language, define all terms, and build concepts step by step. Include plenty of examples.',
}
