import { NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { OPEN_STAGES, STAGES } from '@/lib/crm/constants'

/**
 * GET /api/admin/crm/snapshots
 * Lists pipeline snapshots, ordered by snapshot_date desc, limit 12.
 */
export async function GET() {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { data: snapshots, error } = await supabase
    .from('crm_pipeline_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: false })
    .limit(12)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 })
  }

  return NextResponse.json({ snapshots: snapshots ?? [] })
}

/**
 * POST /api/admin/crm/snapshots
 * Creates (or upserts) a snapshot of the current pipeline state for today.
 */
export async function POST() {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // Fetch all opportunities to compute snapshot metrics
  const { data: opportunities, error: oppError } = await supabase
    .from('crm_opportunities')
    .select('id, value, stage, probability, updated_at')

  if (oppError) {
    return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 })
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const openStagesSet = new Set<string>(OPEN_STAGES)
  const openOpps = (opportunities ?? []).filter((o) => openStagesSet.has(o.stage))

  const totalPipelineValue = openOpps.reduce((sum, o) => sum + (Number(o.value) || 0), 0)
  const weightedPipelineValue = openOpps.reduce(
    (sum, o) => sum + (Number(o.value) || 0) * (o.probability ?? 0),
    0
  )
  const dealCount = openOpps.length

  // Stage breakdown
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

  const wonCount = (opportunities ?? []).filter(
    (o) => o.stage === '7a. Closed Won' && o.updated_at >= startOfMonth
  ).length
  const wonValue = (opportunities ?? [])
    .filter((o) => o.stage === '7a. Closed Won' && o.updated_at >= startOfMonth)
    .reduce((sum, o) => sum + (Number(o.value) || 0), 0)
  const lostCount = (opportunities ?? []).filter(
    (o) => o.stage === '7b. Closed Lost' && o.updated_at >= startOfMonth
  ).length

  // Upsert: if a snapshot for today exists, update it; otherwise insert
  const { data: snapshot, error: upsertError } = await supabase
    .from('crm_pipeline_snapshots')
    .upsert(
      {
        snapshot_date: today,
        total_pipeline_value: totalPipelineValue,
        weighted_pipeline_value: weightedPipelineValue,
        deal_count: dealCount,
        stage_breakdown: stageBreakdown,
        won_count: wonCount,
        won_value: wonValue,
        lost_count: lostCount,
      },
      { onConflict: 'snapshot_date' }
    )
    .select()
    .single()

  if (upsertError) {
    return NextResponse.json({ error: 'Failed to create snapshot' }, { status: 500 })
  }

  return NextResponse.json({ snapshot }, { status: 201 })
}
