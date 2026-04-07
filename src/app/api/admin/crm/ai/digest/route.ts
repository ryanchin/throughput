import { NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { buildWeeklyDigestPrompt } from '@/lib/crm/ai-prompts'
import { callOpenRouter } from '@/lib/openrouter/client'
import { OPEN_STAGES, STAGES, REMINDER_THRESHOLDS } from '@/lib/crm/constants'

/**
 * POST /api/admin/crm/ai/digest
 * Generates a weekly pipeline digest using AI.
 * Computes all CRM stats, then passes them to the LLM for a natural language summary.
 */
export async function POST() {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // Fetch all opportunities
  const { data: opportunities, error: oppError } = await supabase
    .from('crm_opportunities')
    .select('id, title, value, stage, probability, expected_close_date, company_id, updated_at')

  if (oppError) {
    return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 })
  }

  const now = new Date()
  const oneWeekAgo = new Date(now)
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const oneWeekAgoStr = oneWeekAgo.toISOString()

  const openStagesSet = new Set<string>(OPEN_STAGES)
  const allOpps = opportunities ?? []
  const openOpps = allOpps.filter((o) => openStagesSet.has(o.stage))

  const totalPipeline = openOpps.reduce((sum, o) => sum + (Number(o.value) || 0), 0)
  const weightedPipeline = openOpps.reduce(
    (sum, o) => sum + (Number(o.value) || 0) * (o.probability ?? 0),
    0
  )
  const dealCount = openOpps.length

  const wonThisWeek = allOpps.filter(
    (o) => o.stage === '7a. Closed Won' && o.updated_at >= oneWeekAgoStr
  )
  const wonValueThisWeek = wonThisWeek.reduce((sum, o) => sum + (Number(o.value) || 0), 0)
  const lostThisWeek = allOpps.filter(
    (o) => o.stage === '7b. Closed Lost' && o.updated_at >= oneWeekAgoStr
  ).length

  // Stage breakdown
  const stageBreakdown: Record<string, { count: number; value: number }> = {}
  for (const stage of STAGES) {
    stageBreakdown[stage] = { count: 0, value: 0 }
  }
  for (const opp of allOpps) {
    if (stageBreakdown[opp.stage]) {
      stageBreakdown[opp.stage].count += 1
      stageBreakdown[opp.stage].value += Number(opp.value) || 0
    }
  }

  // Fetch company names for stale deals and upcoming closes
  const companyIds = [...new Set(allOpps.map((o) => o.company_id))]
  let companyNameMap: Record<string, string> = {}
  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from('crm_companies')
      .select('id, name')
      .in('id', companyIds)

    for (const c of companies ?? []) {
      companyNameMap[c.id] = c.name
    }
  }

  // Stale deals: open opportunities with no recent activity
  const staleDealCutoff = new Date(now)
  staleDealCutoff.setDate(staleDealCutoff.getDate() - REMINDER_THRESHOLDS.staleDealDays)

  // Fetch activities for open opportunities
  const openCompanyIds = [...new Set(openOpps.map((o) => o.company_id))]
  let activities: { company_id: string; opportunity_id: string | null; activity_date: string }[] = []
  if (openCompanyIds.length > 0) {
    const { data: actData } = await supabase
      .from('crm_activities')
      .select('company_id, opportunity_id, activity_date')
      .in('company_id', openCompanyIds)

    activities = actData ?? []
  }

  const staleDeals: { title: string; company: string; daysSinceActivity: number }[] = []
  for (const opp of openOpps) {
    const relevantActivities = activities.filter(
      (a) => a.opportunity_id === opp.id || a.company_id === opp.company_id
    )
    const maxDate = relevantActivities.reduce<Date | null>((max, a) => {
      const d = new Date(a.activity_date)
      return max === null || d > max ? d : max
    }, null)

    const lastActivity = maxDate ?? new Date(now) // If no activities, treat as recent (don't flag)
    if (maxDate && lastActivity < staleDealCutoff) {
      const daysSince = Math.floor(
        (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
      )
      staleDeals.push({
        title: opp.title,
        company: companyNameMap[opp.company_id] ?? 'Unknown',
        daysSinceActivity: daysSince,
      })
    }
  }

  // Upcoming closes
  const upcomingCutoff = new Date(now)
  upcomingCutoff.setDate(upcomingCutoff.getDate() + REMINDER_THRESHOLDS.upcomingCloseDays)
  const todayStr = now.toISOString().split('T')[0]
  const cutoffStr = upcomingCutoff.toISOString().split('T')[0]

  const upcomingCloses = openOpps
    .filter((o) => o.expected_close_date && o.expected_close_date >= todayStr && o.expected_close_date <= cutoffStr)
    .map((o) => ({
      title: o.title,
      company: companyNameMap[o.company_id] ?? 'Unknown',
      closeDate: o.expected_close_date!,
    }))

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const prompt = buildWeeklyDigestPrompt({
      totalPipeline,
      weightedPipeline,
      dealCount,
      wonThisWeek: wonThisWeek.length,
      wonValueThisWeek,
      lostThisWeek,
      stageBreakdown,
      staleDeals,
      upcomingCloses,
    })

    const result = await callOpenRouter(
      [
        { role: 'system', content: 'You are a sales operations analyst generating a concise weekly digest for a team meeting.' },
        { role: 'user', content: prompt },
      ],
      {
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 1500,
      }
    )

    clearTimeout(timeout)

    let digest: { summary: string; highlights: string[]; action_items: string[] }
    try {
      const parsed = JSON.parse(result)
      digest = {
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
        action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
      }
    } catch {
      return NextResponse.json(
        { error: 'AI returned invalid response' },
        { status: 503 }
      )
    }

    return NextResponse.json(digest)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[CRM AI Digest] Error:', message)
    return NextResponse.json(
      { error: 'AI digest generation unavailable' },
      { status: 503 }
    )
  }
}
