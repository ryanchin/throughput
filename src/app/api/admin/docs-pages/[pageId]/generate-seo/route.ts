import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'
import { callOpenRouter } from '@/lib/openrouter/client'

/**
 * POST /api/admin/docs-pages/[pageId]/generate-seo
 * Generates meta title and description using AI based on the page content.
 * Admin only.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { error: authError } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { pageId } = await params
  const serviceClient = createServiceClient()

  const { data: page, error } = await serviceClient
    .from('docs_pages')
    .select('title, content')
    .eq('id', pageId)
    .eq('type', 'docs')
    .single()

  if (error || !page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  }

  // Extract plain text from Tiptap JSON content
  const plainText = extractText(page.content)

  if (!plainText && !page.title) {
    return NextResponse.json(
      { error: 'Page has no content or title to generate SEO from' },
      { status: 400 }
    )
  }

  try {
    const result = await callOpenRouter(
      [
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
          content: `Page title: ${page.title}\n\nPage content:\n${plainText.slice(0, 2000)}`,
        },
      ],
      {
        temperature: 0.4,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }
    )

    const parsed = JSON.parse(result)
    const metaTitle = (parsed.metaTitle ?? parsed.meta_title ?? '').slice(0, 70)
    const metaDescription = (parsed.metaDescription ?? parsed.meta_description ?? '').slice(0, 160)

    return NextResponse.json({ metaTitle, metaDescription })
  } catch (err) {
    console.error('SEO generation failed:', err)
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
  }
}

/** Recursively extract plain text from Tiptap JSON content. */
function extractText(content: unknown): string {
  if (!content || typeof content !== 'object') return ''

  const node = content as Record<string, unknown>
  let text = ''

  if (node.text && typeof node.text === 'string') {
    text += node.text
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      text += extractText(child) + ' '
    }
  }

  return text.trim()
}
