import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { enrichRequestSchema } from '@/lib/crm/schemas'
import { buildEnrichmentPrompt } from '@/lib/crm/ai-prompts'
import { callOpenRouter } from '@/lib/openrouter/client'

/**
 * POST /api/admin/crm/ai/enrich
 * AI-powered company enrichment. Returns structured data (industry, size,
 * description, website) without saving -- the frontend merges into the form.
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = enrichRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { name, url } = parsed.data

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const prompt = buildEnrichmentPrompt(name, url || undefined)

    const result = await callOpenRouter(
      [
        { role: 'system', content: 'You are a helpful business research assistant.' },
        { role: 'user', content: prompt },
      ],
      {
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 512,
      }
    )

    clearTimeout(timeout)

    // Parse and validate the response
    let enriched: Record<string, unknown>
    try {
      enriched = JSON.parse(result)
    } catch {
      return NextResponse.json(
        { error: 'AI returned invalid JSON' },
        { status: 503 }
      )
    }

    return NextResponse.json({
      industry: typeof enriched.industry === 'string' ? enriched.industry : null,
      company_size: typeof enriched.company_size === 'string' ? enriched.company_size : null,
      description: typeof enriched.description === 'string' ? enriched.description : null,
      website: typeof enriched.website === 'string' ? enriched.website : null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[CRM AI Enrich] Error:', message)
    return NextResponse.json(
      { error: 'AI enrichment unavailable' },
      { status: 503 }
    )
  }
}
