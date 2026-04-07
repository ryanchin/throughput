import { NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { REMINDER_THRESHOLDS, OPEN_STAGES } from '@/lib/crm/constants'

/**
 * GET /api/admin/crm/reminders
 * Computes on-demand reminders: stale deals, stale companies,
 * upcoming closes, and overdue tasks.
 */
export async function GET() {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const now = new Date()

  // ---- Stale deals ----
  // Opportunities in open stages where the most recent activity
  // (by company_id OR opportunity_id) is older than staleDealDays days.
  const staleDealCutoff = new Date(now)
  staleDealCutoff.setDate(staleDealCutoff.getDate() - REMINDER_THRESHOLDS.staleDealDays)

  const { data: openOpps, error: oppError } = await supabase
    .from('crm_opportunities')
    .select('id, title, company_id, stage, value, expected_close_date, created_at')
    .in('stage', OPEN_STAGES as unknown as string[])

  if (oppError) {
    return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 })
  }

  // Get all activities for relevant companies and opportunities
  const companyIds = [...new Set((openOpps ?? []).map((o) => o.company_id))]
  const oppIds = (openOpps ?? []).map((o) => o.id)

  let activities: { company_id: string; opportunity_id: string | null; activity_date: string }[] = []
  if (companyIds.length > 0) {
    const { data: actData } = await supabase
      .from('crm_activities')
      .select('company_id, opportunity_id, activity_date')
      .in('company_id', companyIds)

    activities = actData ?? []
  }

  // Build max activity date per opportunity (using opp-level or company-level activities)
  const staleDeals: {
    id: string
    title: string
    company_id: string
    stage: string
    value: number | null
    daysSinceActivity: number
  }[] = []

  for (const opp of openOpps ?? []) {
    // Activities directly linked to this opportunity, or to its company
    const relevantActivities = activities.filter(
      (a) => a.opportunity_id === opp.id || a.company_id === opp.company_id
    )

    const maxDate = relevantActivities.reduce<Date | null>((max, a) => {
      const d = new Date(a.activity_date)
      return max === null || d > max ? d : max
    }, null)

    // Fall back to opportunity created_at if no activities
    const lastActivity = maxDate ?? new Date(opp.created_at)

    if (lastActivity < staleDealCutoff) {
      const daysSince = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
      staleDeals.push({
        id: opp.id,
        title: opp.title,
        company_id: opp.company_id,
        stage: opp.stage,
        value: opp.value != null ? Number(opp.value) : null,
        daysSinceActivity: daysSince,
      })
    }
  }

  // ---- Stale companies ----
  const staleCompanyCutoff = new Date(now)
  staleCompanyCutoff.setDate(staleCompanyCutoff.getDate() - REMINDER_THRESHOLDS.staleCompanyDays)

  const { data: allCompanies, error: compError } = await supabase
    .from('crm_companies')
    .select('id, name, status, created_at')

  if (compError) {
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })
  }

  // Get all activities grouped by company
  let allActivities: { company_id: string; activity_date: string }[] = []
  if ((allCompanies ?? []).length > 0) {
    const allCompIds = (allCompanies ?? []).map((c) => c.id)
    const { data: allActData } = await supabase
      .from('crm_activities')
      .select('company_id, activity_date')
      .in('company_id', allCompIds)

    allActivities = allActData ?? []
  }

  // Max activity date per company
  const companyMaxActivity: Record<string, Date> = {}
  for (const a of allActivities) {
    const d = new Date(a.activity_date)
    if (!companyMaxActivity[a.company_id] || d > companyMaxActivity[a.company_id]) {
      companyMaxActivity[a.company_id] = d
    }
  }

  const staleCompanies: {
    id: string
    name: string
    status: string
    daysSinceActivity: number
  }[] = []

  for (const comp of allCompanies ?? []) {
    const lastActivity = companyMaxActivity[comp.id] ?? new Date(comp.created_at)
    if (lastActivity < staleCompanyCutoff) {
      const daysSince = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
      staleCompanies.push({
        id: comp.id,
        name: comp.name,
        status: comp.status,
        daysSinceActivity: daysSince,
      })
    }
  }

  // ---- Upcoming closes ----
  const upcomingCutoff = new Date(now)
  upcomingCutoff.setDate(upcomingCutoff.getDate() + REMINDER_THRESHOLDS.upcomingCloseDays)
  const todayStr = now.toISOString().split('T')[0]
  const cutoffStr = upcomingCutoff.toISOString().split('T')[0]

  const { data: upcomingOpps, error: upcomingError } = await supabase
    .from('crm_opportunities')
    .select('id, title, company_id, stage, value, expected_close_date')
    .in('stage', OPEN_STAGES as unknown as string[])
    .gte('expected_close_date', todayStr)
    .lte('expected_close_date', cutoffStr)

  if (upcomingError) {
    return NextResponse.json({ error: 'Failed to fetch upcoming closes' }, { status: 500 })
  }

  const upcomingCloses = (upcomingOpps ?? []).map((o) => ({
    id: o.id,
    title: o.title,
    company_id: o.company_id,
    stage: o.stage,
    value: o.value != null ? Number(o.value) : null,
    expected_close_date: o.expected_close_date,
  }))

  // ---- Overdue tasks ----
  const { data: overdueTasks, error: taskError } = await supabase
    .from('crm_activities')
    .select('id, subject, company_id, opportunity_id, activity_date')
    .eq('type', 'task')
    .eq('completed', false)
    .lt('activity_date', now.toISOString())

  if (taskError) {
    return NextResponse.json({ error: 'Failed to fetch overdue tasks' }, { status: 500 })
  }

  const totalCount =
    staleDeals.length +
    staleCompanies.length +
    upcomingCloses.length +
    (overdueTasks ?? []).length

  return NextResponse.json({
    staleDeals,
    staleCompanies,
    upcomingCloses,
    overdueTasks: overdueTasks ?? [],
    totalCount,
  })
}
