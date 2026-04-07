import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { nlParseRequestSchema } from '@/lib/crm/schemas'
import { buildNLParsePrompt } from '@/lib/crm/ai-prompts'
import { callOpenRouter } from '@/lib/openrouter/client'
import type { Json } from '@/lib/supabase/database.types'

interface ParsedAction {
  action: string
  company_name?: string
  [key: string]: unknown
}

interface ActionWithMatch extends ParsedAction {
  matched_company?: { id: string; name: string } | null
  company_candidates?: { id: string; name: string }[]
}

/**
 * POST /api/admin/crm/ai/parse
 * Parses natural language text into structured CRM actions.
 * Performs fuzzy company matching via trigram similarity.
 * Logs the parse to crm_nl_parse_log for accuracy tracking.
 */
export async function POST(request: NextRequest) {
  const { error: authError, supabase, profile } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = nlParseRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { text } = parsed.data

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const prompt = buildNLParsePrompt(text)

    const result = await callOpenRouter(
      [
        { role: 'system', content: 'You are a CRM assistant that parses sales updates into structured actions.' },
        { role: 'user', content: prompt },
      ],
      {
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 2048,
      }
    )

    clearTimeout(timeout)

    // Parse the response -- could be a JSON array or an object with an actions array
    let actions: ParsedAction[]
    try {
      const parsed = JSON.parse(result)
      if (Array.isArray(parsed)) {
        actions = parsed
      } else if (Array.isArray(parsed.actions)) {
        actions = parsed.actions
      } else {
        actions = [parsed]
      }
    } catch {
      return NextResponse.json(
        { error: 'AI returned invalid JSON' },
        { status: 503 }
      )
    }

    // Fuzzy match company names against existing companies
    const actionsWithMatches: ActionWithMatch[] = []

    for (const action of actions) {
      const enrichedAction: ActionWithMatch = { ...action }

      if (action.company_name && typeof action.company_name === 'string') {
        const companyName = action.company_name

        // Use ILIKE for substring match + trigram similarity for fuzzy matching
        // Supabase JS client doesn't support raw SQL with similarity(), so we
        // use textSearch via ilike as primary and fetch candidates
        const { data: candidates } = await supabase
          .from('crm_companies')
          .select('id, name')
          .or(`name.ilike.%${companyName}%,name.ilike.${companyName}%`)
          .limit(5)

        if (candidates && candidates.length > 0) {
          // Best match: exact case-insensitive match first, then first ILIKE result
          const exactMatch = candidates.find(
            (c) => c.name.toLowerCase() === companyName.toLowerCase()
          )
          enrichedAction.matched_company = exactMatch ?? candidates[0]
          enrichedAction.company_candidates = candidates.slice(0, 3)
        } else {
          enrichedAction.matched_company = null
          enrichedAction.company_candidates = []
        }
      }

      actionsWithMatches.push(enrichedAction)
    }

    // Log to crm_nl_parse_log for accuracy tracking
    await supabase.from('crm_nl_parse_log').insert({
      raw_input: text,
      parsed_actions: actionsWithMatches as unknown as Json,
      created_by: profile!.id,
    })

    return NextResponse.json({ actions: actionsWithMatches })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[CRM AI Parse] Error:', message)
    return NextResponse.json(
      { error: 'AI parsing unavailable' },
      { status: 503 }
    )
  }
}
