/**
 * Regenerate lesson content for existing courses using the new section-optimized prompt.
 * Each lesson gets 5-10 ## sections of 300-600 words, optimized for page-by-page navigation.
 *
 * Usage: npx tsx scripts/regenerate-lessons.ts [courseId]
 * If no courseId, regenerates ALL courses.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const openrouterKey = process.env.OPENROUTER_API_KEY!

if (!supabaseUrl || !supabaseKey || !openrouterKey) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

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

Write as if you're training someone who needs to apply this knowledge at work tomorrow.`

async function generateLessonContent(courseTitle: string, lessonTitle: string, lessonSummary: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openrouterKey}`,
      'HTTP-Referer': 'https://throughput.aava.ai',
      'X-Title': 'Throughput Lesson Regeneration',
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Write comprehensive training content for the lesson "${lessonTitle}" in the course "${courseTitle}".\n\nLesson summary: ${lessonSummary || 'Not provided — infer from the title and course context.'}`,
        },
      ],
      max_tokens: 16384,
    }),
  })

  if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

/** Convert markdown to basic Tiptap JSON (heading + paragraph nodes). */
function markdownToBasicTiptap(markdown: string): object {
  const lines = markdown.split('\n')
  const nodes: object[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const h2Match = trimmed.match(/^##\s+(.+)/)
    const h3Match = trimmed.match(/^###\s+(.+)/)
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/)
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)/)

    if (h2Match) {
      nodes.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: h2Match[1] }],
      })
    } else if (h3Match) {
      nodes.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: h3Match[1] }],
      })
    } else if (bulletMatch) {
      nodes.push({
        type: 'bulletList',
        content: [{
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: bulletMatch[1] }],
          }],
        }],
      })
    } else if (numberedMatch) {
      nodes.push({
        type: 'orderedList',
        content: [{
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: numberedMatch[1] }],
          }],
        }],
      })
    } else {
      // Handle bold text within paragraphs
      const parts: object[] = []
      const boldRegex = /\*\*(.+?)\*\*/g
      let lastIndex = 0
      let match
      while ((match = boldRegex.exec(trimmed)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ type: 'text', text: trimmed.slice(lastIndex, match.index) })
        }
        parts.push({ type: 'text', marks: [{ type: 'bold' }], text: match[1] })
        lastIndex = match.index + match[0].length
      }
      if (lastIndex < trimmed.length) {
        parts.push({ type: 'text', text: trimmed.slice(lastIndex) })
      }
      if (parts.length > 0) {
        nodes.push({ type: 'paragraph', content: parts })
      }
    }
  }

  return { type: 'doc', content: nodes }
}

async function main() {
  const targetCourseId = process.argv[2]

  let query = supabase.from('courses').select('id, title')
  if (targetCourseId) {
    query = query.eq('id', targetCourseId)
  }

  const { data: courses, error } = await query
  if (error || !courses?.length) {
    console.error('No courses found:', error?.message)
    process.exit(1)
  }

  console.log(`Regenerating lessons for ${courses.length} course(s)\n`)

  for (const course of courses) {
    console.log(`\n━━━ ${course.title} ━━━`)

    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, title, slug, order_index')
      .eq('course_id', course.id)
      .order('order_index', { ascending: true })

    if (!lessons?.length) {
      console.log('  No lessons found, skipping.')
      continue
    }

    for (const lesson of lessons) {
      console.log(`  Regenerating: ${lesson.title}...`)
      const startTime = Date.now()

      try {
        const markdown = await generateLessonContent(course.title, lesson.title, '')
        const wordCount = markdown.split(/\s+/).filter(Boolean).length
        const sectionCount = (markdown.match(/^## /gm) || []).length

        const tiptapContent = markdownToBasicTiptap(markdown)

        const { error: updateError } = await supabase
          .from('lessons')
          .update({ content: tiptapContent })
          .eq('id', lesson.id)

        if (updateError) {
          console.log(`    FAIL: ${updateError.message}`)
        } else {
          const duration = ((Date.now() - startTime) / 1000).toFixed(1)
          console.log(`    ✓ ${wordCount} words, ${sectionCount} sections (${duration}s)`)
        }

        // Rate limit: wait between lessons
        await new Promise((r) => setTimeout(r, 2000))
      } catch (err) {
        console.log(`    FAIL: ${err}`)
      }
    }
  }

  console.log('\nDone!')
}

main()
