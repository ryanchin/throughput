import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { buildDealScorePrompt } from '@/lib/crm/ai-prompts'
import { callOpenRouter } from '@/lib/openrouter/client'

const scoreRequestSchema = z.object({
  opportunityId: z.string().uuid('Must be a valid opportunity ID'),
})

/**
 * POST /api/admin/crm/ai/score
 * AI-powered deal scoring. Fetches the opportunity + company + activity metrics,
 * asks the LLM for a 0-100 score, and persists the score on the opportunity row.
 */
export async function POST(request: NextRequest) {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = scoreRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { opportunityId } = parsed.data

  // Fetch opportunity with company name
  const { data: opportunity, error: oppError } = await supabase
    .from('crm_opportunities')
    .select('id, title, stage, value, probability, created_at, company_id')
    .eq('id', opportunityId)
    .single()

  if (oppError || !opportunity) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  const { data: company } = await supabase
    .from('crm_companies')
    .select('name')
    .eq('id', opportunity.company_id)
    .single()

  const companyName = company?.name ?? 'Unknown Company'

  // Activity count for this opportunity (or its company)
  const { count: activityCount } = await supabase
    .from('crm_activities')
    .select('id', { count: 'exact', head: true })
    .or(`opportunity_id.eq.${opportunityId},company_id.eq.${opportunity.company_id}`)

  // Days since last activity
  const { data: lastActivity } = await supabase
    .from('crm_activities')
    .select('activity_date')
    .or(`opportunity_id.eq.${opportunityId},company_id.eq.${opportunity.company_id}`)
    .order('activity_date', { ascending: false })
    .limit(1)
    .single()

  const now = new Date()
  const daysSinceLastActivity = lastActivity
    ? Math.floor(
        (now.getTime() - new Date(lastActivity.activity_date).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null

  // Days in current stage (approximated from created_at since we don't track stage changes)
  const daysInStage = Math.floor(
    (now.getTime() - new Date(opportunity.created_at).getTime()) /
      (1000 * 60 * 60 * 24)
  )

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const prompt = buildDealScorePrompt({
      companyName,
      title: opportunity.title,
      stage: opportunity.stage,
      value: opportunity.value != null ? Number(opportunity.value) : null,
      daysInStage,
      activityCount: activityCount ?? 0,
      daysSinceLastActivity,
    })

    const result = await callOpenRouter(
      [
        { role: 'system', content: 'You are a sales analytics expert scoring deal close probability.' },
        { role: 'user', content: prompt },
      ],
      {
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 256,
      }
    )

    clearTimeout(timeout)

    let score: number
    let reasoning: string
    try {
      const parsed = JSON.parse(result)
      score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 50
      reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : 'No reasoning provided'
    } catch {
      return NextResponse.json(
        { error: 'AI returned invalid response' },
        { status: 503 }
      )
    }

    // Persist the AI score on the opportunity
    const { error: updateError } = await supabase
      .from('crm_opportunities')
      .update({ ai_score: score })
      .eq('id', opportunityId)

    if (updateError) {
      console.error('[CRM AI Score] Failed to persist score:', updateError.message)
      // Still return the score even if persistence fails
    }

    return NextResponse.json({ score, reasoning })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[CRM AI Score] Error:', message)
    return NextResponse.json(
      { error: 'AI scoring unavailable' },
      { status: 503 }
    )
  }
}
