import { NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { createServiceClient } from '@/lib/supabase/server'
import { OPEN_STAGES, REMINDER_THRESHOLDS, ACTIVE_CANDIDATE_STATUSES } from '@/lib/crm/constants'

/**
 * GET /api/admin/crm/briefing/data
 * Aggregates all briefing data in a single response.
 * Uses service client for cross-table aggregation.
 *
 * Returns: pipeline, staleDeals, openRoles, bench, rolloffs, candidates, summary
 */
export async function GET() {
  const { error: authError } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  // Fetch all data in parallel
  const [
    pipelineRes,
    rolesRes,
    benchRes,
    rolloffsRes,
    candidatesRes,
    consultantStatsRes,
  ] = await Promise.all([
    // 1. Pipeline: open-stage opportunities with company name
    supabase
      .from('crm_opportunities')
      .select('id, title, company_id, stage, value, probability, expected_close_date, created_at, updated_at, crm_companies(id, name)')
      .in('stage', OPEN_STAGES as unknown as string[])
      .order('created_at', { ascending: false }),

    // 2. Open roles with account name and candidate count
    supabase
      .from('crm_roles')
      .select('id, name, function, status, account_id, deal_id, target_fill_date, created_at, crm_companies(id, name)')
      .eq('status', 'Open')
      .order('created_at', { ascending: false }),

    // 3. Bench consultants
    supabase
      .from('crm_consultants')
      .select('id, function, seniority, skills, status, profiles!inner(id, full_name, email)')
      .eq('status', 'Active - Bench'),

    // 4. Rolloffs: active assignments ending within 60 days
    (() => {
      const cutoff = new Date(now)
      cutoff.setDate(cutoff.getDate() + 60)
      return supabase
        .from('crm_assignments')
        .select('id, consultant_id, expected_end_date, account_id, status, crm_consultants!inner(id, function, seniority, profiles!inner(id, full_name)), crm_companies!inner(id, name)')
        .eq('status', 'Active')
        .gte('expected_end_date', todayStr)
        .lte('expected_end_date', cutoff.toISOString().split('T')[0])
        .order('expected_end_date', { ascending: true })
    })(),

    // 5. Active candidates
    supabase
      .from('crm_candidates')
      .select('id, first_name, last_name, function, seniority, status, target_account_id, target_role_id, date_added, crm_companies(id, name)')
      .in('status', ACTIVE_CANDIDATE_STATUSES as unknown as string[])
      .order('date_added', { ascending: false }),

    // 6. Consultant stats
    supabase
      .from('crm_consultants')
      .select('id, status'),
  ])

  // Process pipeline data - compute staleness
  const pipeline = pipelineRes.data ?? []
  const pipelineCompanyIds = [...new Set(pipeline.map((o: Record<string, unknown>) => o.company_id as string))]
  const oppIds = pipeline.map((o: Record<string, unknown>) => o.id as string)

  // Fetch activities for staleness calculation
  let activities: { company_id: string; opportunity_id: string | null; activity_date: string }[] = []
  if (pipelineCompanyIds.length > 0) {
    const { data: actData } = await supabase
      .from('crm_activities')
      .select('company_id, opportunity_id, activity_date')
      .in('company_id', pipelineCompanyIds)
    activities = actData ?? []
  }

  const staleDealCutoff = new Date(now)
  staleDealCutoff.setDate(staleDealCutoff.getDate() - REMINDER_THRESHOLDS.staleDealDays)

  const pipelineData = pipeline.map((opp: Record<string, unknown>) => {
    const { crm_companies, ...rest } = opp
    const relevantActivities = activities.filter(
      (a) => a.opportunity_id === rest.id || a.company_id === rest.company_id
    )
    const maxDate = relevantActivities.reduce<Date | null>((max, a) => {
      const d = new Date(a.activity_date)
      return max === null || d > max ? d : max
    }, null)
    const lastActivity = maxDate ?? new Date(rest.created_at as string)
    const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / 86400000)
    const isStale = lastActivity < staleDealCutoff

    return {
      ...rest,
      company: crm_companies ?? null,
      days_since_activity: daysSinceActivity,
      is_stale: isStale,
      last_activity_date: lastActivity.toISOString(),
    }
  })

  // Sort pipeline by staleness (most stale first)
  pipelineData.sort((a: { days_since_activity: number }, b: { days_since_activity: number }) =>
    b.days_since_activity - a.days_since_activity
  )

  // Process roles - get candidate counts
  const roles = rolesRes.data ?? []
  const roleIds = roles.map((r: Record<string, unknown>) => r.id as string)

  let roleCandidateCounts: Record<string, number> = {}
  if (roleIds.length > 0) {
    const { data: candidates } = await supabase
      .from('crm_candidates')
      .select('target_role_id')
      .in('target_role_id', roleIds)

    for (const c of candidates ?? []) {
      roleCandidateCounts[c.target_role_id] = (roleCandidateCounts[c.target_role_id] ?? 0) + 1
    }
  }

  const rolesData = roles.map((r: Record<string, unknown>) => {
    const { crm_companies, ...rest } = r
    const daysOpen = rest.created_at
      ? Math.floor((now.getTime() - new Date(rest.created_at as string).getTime()) / 86400000)
      : 0
    return {
      ...rest,
      account: crm_companies ?? null,
      candidate_count: roleCandidateCounts[rest.id as string] ?? 0,
      days_open: daysOpen,
    }
  })

  // Process bench - compute days on bench
  const benchConsultants = benchRes.data ?? []
  const benchIds = benchConsultants.map((c: Record<string, unknown>) => c.id as string)

  let lastAssignmentMap: Record<string, { actual_end_date: string; account_name: string }> = {}
  if (benchIds.length > 0) {
    const { data: assignments } = await supabase
      .from('crm_assignments')
      .select('consultant_id, actual_end_date, account_id')
      .in('consultant_id', benchIds)
      .eq('status', 'Completed')
      .order('actual_end_date', { ascending: false })

    const accountIds = [...new Set((assignments ?? []).map((a: Record<string, unknown>) => a.account_id as string).filter(Boolean))]
    let accountNameMap: Record<string, string> = {}
    if (accountIds.length > 0) {
      const { data: accounts } = await supabase
        .from('crm_companies')
        .select('id, name')
        .in('id', accountIds)
      for (const a of accounts ?? []) {
        accountNameMap[a.id] = a.name
      }
    }

    const seen = new Set<string>()
    for (const row of assignments ?? []) {
      if (seen.has(row.consultant_id)) continue
      seen.add(row.consultant_id)
      lastAssignmentMap[row.consultant_id] = {
        actual_end_date: row.actual_end_date ?? '',
        account_name: accountNameMap[row.account_id] ?? '',
      }
    }
  }

  const benchData = benchConsultants.map((c: Record<string, unknown>) => {
    const { profiles, ...rest } = c
    const last = lastAssignmentMap[rest.id as string]
    const daysOnBench = last?.actual_end_date
      ? Math.floor((now.getTime() - new Date(last.actual_end_date).getTime()) / 86400000)
      : null
    return {
      ...rest,
      user: profiles,
      days_on_bench: daysOnBench,
      last_account: last?.account_name ?? null,
    }
  })

  // Sort by days on bench descending
  benchData.sort((a: { days_on_bench: number | null }, b: { days_on_bench: number | null }) =>
    (b.days_on_bench ?? -1) - (a.days_on_bench ?? -1)
  )

  // Process rolloffs
  const rolloffs = rolloffsRes.data ?? []
  const rolloffsData = rolloffs.map((a: Record<string, unknown>) => {
    const { crm_consultants, crm_companies, ...rest } = a
    const consultant = crm_consultants as Record<string, unknown>
    const endDate = new Date(rest.expected_end_date as string)
    const daysUntil = Math.ceil((endDate.getTime() - now.getTime()) / 86400000)
    return {
      ...rest,
      consultant: { ...(({ profiles, ...c }) => ({ ...c, user: profiles }))(consultant as { profiles: unknown }) },
      account: crm_companies,
      days_until_rolloff: daysUntil,
    }
  })

  // Process candidates
  const candidates = candidatesRes.data ?? []
  const candidatesData = candidates.map((c: Record<string, unknown>) => {
    const { crm_companies, ...rest } = c
    const daysInPipeline = rest.date_added
      ? Math.floor((now.getTime() - new Date(rest.date_added as string).getTime()) / 86400000)
      : null
    return {
      ...rest,
      target_account: crm_companies ?? null,
      days_in_pipeline: daysInPipeline,
    }
  })

  // Summary stats
  const allConsultants = consultantStatsRes.data ?? []
  const totalActive = allConsultants.filter((c: Record<string, unknown>) =>
    ['Active - Placed', 'Active - Bench'].includes(c.status as string)
  ).length
  const totalPlaced = allConsultants.filter((c: Record<string, unknown>) => c.status === 'Active - Placed').length
  const totalBench = allConsultants.filter((c: Record<string, unknown>) => c.status === 'Active - Bench').length

  const rolloff30 = rolloffsData.filter((r: { days_until_rolloff: number }) => r.days_until_rolloff <= 30).length
  const rolloff60 = rolloffsData.length

  const totalPipelineValue = pipelineData.reduce((sum: number, d: { value?: number | null }) =>
    sum + (d.value != null ? Number(d.value) : 0), 0
  )

  return NextResponse.json({
    pipeline: pipelineData,
    roles: rolesData,
    bench: benchData,
    rolloffs: rolloffsData,
    candidates: candidatesData,
    summary: {
      total_active_consultants: totalActive,
      total_placed: totalPlaced,
      total_bench: totalBench,
      rolling_off_30d: rolloff30,
      rolling_off_60d: rolloff60,
      total_pipeline_value: totalPipelineValue,
      open_roles: rolesData.length,
      active_candidates: candidatesData.length,
    },
  })
}
