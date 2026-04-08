import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { callOpenRouter } from '@/lib/openrouter/client'

/**
 * POST /api/admin/crm/briefing/ai-health
 * AI health assessment for a single deal.
 * Returns one-line assessment and risk level (low/medium/high).
 * Non-blocking: on LLM error, returns null values with 200.
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

  const { opportunity_id } = body as { opportunity_id?: string }
  if (!opportunity_id) {
    return NextResponse.json({ error: 'opportunity_id is required' }, { status: 400 })
  }

  // Fetch opportunity with company
  const { data: opp, error: oppError } = await supabase
    .from('crm_opportunities')
    .select('id, title, company_id, stage, value, expected_close_date, created_at, updated_at, crm_companies(id, name)')
    .eq('id', opportunity_id)
    .single()

  if (oppError || !opp) {
    return NextResponse.json({ assessment: null, risk: null })
  }

  const oppData = opp as Record<string, unknown>
  const company = oppData.crm_companies as { name: string } | null
  const companyId = oppData.company_id as string

  // Fetch recent activities for this opportunity and its company
  const { data: recentActivities } = await supabase
    .from('crm_activities')
    .select('type, subject, activity_date')
    .or(`opportunity_id.eq.${opportunity_id},company_id.eq.${companyId}`)
    .order('activity_date', { ascending: false })
    .limit(5)

  const now = new Date()
  const createdAt = new Date(oppData.created_at as string)
  const updatedAt = new Date(oppData.updated_at as string)

  // Compute days in current stage (approximated by updated_at)
  const daysInStage = Math.floor((now.getTime() - updatedAt.getTime()) / 86400000)

  // Days since last activity
  const lastActivityDate = recentActivities?.[0]?.activity_date
    ? new Date(recentActivities[0].activity_date)
    : createdAt
  const daysSinceActivity = Math.floor((now.getTime() - lastActivityDate.getTime()) / 86400000)

  const lastActivity = recentActivities?.[0]
    ? `${recentActivities[0].type} - ${recentActivities[0].subject}`
    : 'No recent activity'

  try {
    const prompt = `Assess the health of this deal in one sentence.

Deal: ${oppData.title} at ${company?.name ?? 'Unknown Company'}
Stage: ${oppData.stage}
Value: $${oppData.value ? Number(oppData.value as number).toLocaleString() : '0'}
Days in current stage: ${daysInStage}
Days since last activity: ${daysSinceActivity}
Last activity: ${lastActivity}

Return JSON: { "assessment": "one sentence", "risk": "low" | "medium" | "high" }`

    const result = await callOpenRouter(
      [
        { role: 'system', content: 'You are an experienced sales operations analyst. Assess deal health concisely.' },
        { role: 'user', content: prompt },
      ],
      {
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 256,
      }
    )

    let assessment: string | null = null
    let risk: string | null = null

    try {
      const parsed = JSON.parse(result)
      assessment = parsed.assessment ?? null
      risk = ['low', 'medium', 'high'].includes(parsed.risk) ? parsed.risk : null
    } catch {
      // Failed to parse LLM response — return nulls
    }

    return NextResponse.json({ assessment, risk })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Briefing AI Health] Error:', message)
    return NextResponse.json({ assessment: null, risk: null })
  }
}
