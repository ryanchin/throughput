/**
 * Backfill SEO metadata for all docs pages that don't have meta_title or meta_description.
 * Uses OpenRouter AI to generate from page title + content.
 *
 * Usage: npx tsx scripts/backfill-seo.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const openrouterKey = process.env.OPENROUTER_API_KEY!
if (!openrouterKey) {
  console.error('Missing OPENROUTER_API_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function extractText(content: unknown): string {
  if (!content || typeof content !== 'object') return ''
  const node = content as Record<string, unknown>
  let text = ''
  if (node.text && typeof node.text === 'string') text += node.text
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      text += extractText(child) + ' '
    }
  }
  return text.trim()
}

async function generateSeo(title: string, contentText: string): Promise<{ metaTitle: string; metaDescription: string }> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openrouterKey}`,
      'HTTP-Referer': 'https://throughput.aava.ai',
      'X-Title': 'Throughput SEO Backfill',
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content: `You are an SEO specialist. Generate a meta title and meta description for a documentation page.

Rules:
- Meta title: max 60 characters, include the main topic, be descriptive and clear
- Meta description: max 155 characters, summarize the page content, include a call to action or value proposition
- Return ONLY valid JSON: {"metaTitle": "...", "metaDescription": "..."}
- No markdown fences, no preamble, just the JSON object`,
        },
        {
          role: 'user',
          content: `Page title: ${title}\n\nPage content:\n${contentText.slice(0, 2000)}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenRouter error: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(text)

  return {
    metaTitle: (parsed.metaTitle ?? parsed.meta_title ?? '').slice(0, 70),
    metaDescription: (parsed.metaDescription ?? parsed.meta_description ?? '').slice(0, 160),
  }
}

async function main() {
  // Fetch all docs pages missing SEO metadata
  const { data: pages, error } = await supabase
    .from('docs_pages')
    .select('id, title, content, meta_title, meta_description')
    .or('meta_title.is.null,meta_description.is.null')

  if (error) {
    console.error('Failed to fetch pages:', error.message)
    process.exit(1)
  }

  const toProcess = (pages ?? []).filter(
    (p) => !p.meta_title || !p.meta_description
  )

  console.log(`Found ${toProcess.length} pages needing SEO metadata\n`)

  let success = 0
  let failed = 0

  for (const page of toProcess) {
    const contentText = extractText(page.content)

    if (!contentText && !page.title) {
      console.log(`  SKIP  ${page.id} — no title or content`)
      continue
    }

    try {
      const seo = await generateSeo(page.title, contentText)

      const { error: updateError } = await supabase
        .from('docs_pages')
        .update({
          meta_title: seo.metaTitle,
          meta_description: seo.metaDescription,
        })
        .eq('id', page.id)

      if (updateError) {
        console.log(`  FAIL  "${page.title}" — ${updateError.message}`)
        failed++
      } else {
        console.log(`  ✓     "${page.title}"`)
        console.log(`        title: ${seo.metaTitle}`)
        console.log(`        desc:  ${seo.metaDescription}\n`)
        success++
      }

      // Rate limit: 1 request per second
      await new Promise((r) => setTimeout(r, 1000))
    } catch (err) {
      console.log(`  FAIL  "${page.title}" — ${err}`)
      failed++
    }
  }

  console.log(`\nDone: ${success} updated, ${failed} failed`)
}

main()
