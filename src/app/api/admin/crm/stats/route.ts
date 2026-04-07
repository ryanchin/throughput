import { NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { OPEN_STAGES, STAGES } from '@/lib/crm/constants'

/**
 * GET /api/admin/crm/stats
 * Returns dashboard metrics: pipeline value, weighted pipeline, deal count,
 * won/lost this month, stage breakdown, and company status breakdown.
 */
export async function GET() {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // Fetch all opportunities in one query to compute multiple metrics
  const { data: opportunities, error: oppError } = await supabase
    .from('crm_opportunities')
    .select('id, value, stage, probability, updated_at')

  if (oppError) {
    return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 })
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const openStagesSet = new Set<string>(OPEN_STAGES)
  const openOpps = (opportunities ?? []).filter((o) => openStagesSet.has(o.stage))

  // Pipeline value: sum of value for open opportunities
  const pipelineValue = openOpps.reduce((sum, o) => sum + (Number(o.value) || 0), 0)

  // Weighted pipeline: sum of (value * probability / 100) for open opportunities
  const weightedPipeline = openOpps.reduce(
    (sum, o) => sum + ((Number(o.value) || 0) * (o.probability ?? 0)) / 100,
    0
  )

  // Deal count: open opportunities
  const dealCount = openOpps.length

  // Won this month
  const wonThisMonth = (opportunities ?? []).filter(
    (o) => o.stage === 'closed_won' && o.updated_at >= startOfMonth
  )
  const wonCount = wonThisMonth.length
  const wonValue = wonThisMonth.reduce((sum, o) => sum + (Number(o.value) || 0), 0)

  // Lost this month
  const lostCount = (opportunities ?? []).filter(
    (o) => o.stage === 'closed_lost' && o.updated_at >= startOfMonth
  ).length

  // Stage breakdown: count + total value per stage
  const stageBreakdown: Record<string, { count: number; value: number }> = {}
  for (const stage of STAGES) {
    stageBreakdown[stage] = { count: 0, value: 0 }
  }
  for (const opp of opportunities ?? []) {
    if (stageBreakdown[opp.stage]) {
      stageBreakdown[opp.stage].count += 1
      stageBreakdown[opp.stage].value += Number(opp.value) || 0
    }
  }

  // Companies by status
  const { data: companies, error: compError } = await supabase
    .from('crm_companies')
    .select('status')

  if (compError) {
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })
  }

  const companiesByStatus: Record<string, number> = {}
  for (const c of companies ?? []) {
    companiesByStatus[c.status] = (companiesByStatus[c.status] ?? 0) + 1
  }

  return NextResponse.json({
    pipelineValue,
    weightedPipeline,
    dealCount,
    wonThisMonth: { count: wonCount, value: wonValue },
    lostThisMonth: { count: lostCount },
    stageBreakdown,
    companiesByStatus,
  })
}
