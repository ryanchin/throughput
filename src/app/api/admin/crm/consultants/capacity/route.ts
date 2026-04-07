import { NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { ACTIVE_CANDIDATE_STATUSES } from '@/lib/crm/constants'

/**
 * GET /api/admin/crm/consultants/capacity
 * Returns the capacity summary metrics object.
 */
export async function GET() {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const today = new Date()
  const d30 = new Date(today)
  d30.setDate(d30.getDate() + 30)
  const d60 = new Date(today)
  d60.setDate(d60.getDate() + 60)
  const todayStr = today.toISOString().split('T')[0]
  const d30Str = d30.toISOString().split('T')[0]
  const d60Str = d60.toISOString().split('T')[0]

  const [
    activeResult,
    placedResult,
    benchResult,
    rolloff30Result,
    rolloff60Result,
    openRolesResult,
    overdueRolesResult,
    activeCandidatesResult,
  ] = await Promise.all([
    supabase.from('crm_consultants').select('id', { count: 'exact', head: true }).like('status', 'Active%'),
    supabase.from('crm_consultants').select('id', { count: 'exact', head: true }).eq('status', 'Active - Placed'),
    supabase.from('crm_consultants').select('id', { count: 'exact', head: true }).eq('status', 'Active - Bench'),
    supabase.from('crm_assignments').select('id', { count: 'exact', head: true }).eq('status', 'Active').gte('expected_end_date', todayStr).lte('expected_end_date', d30Str),
    supabase.from('crm_assignments').select('id', { count: 'exact', head: true }).eq('status', 'Active').gte('expected_end_date', todayStr).lte('expected_end_date', d60Str),
    supabase.from('crm_roles').select('id', { count: 'exact', head: true }).eq('status', 'Open'),
    supabase.from('crm_roles').select('id', { count: 'exact', head: true }).eq('status', 'Open').lt('target_fill_date', todayStr),
    supabase.from('crm_candidates').select('id', { count: 'exact', head: true }).in('status', [...ACTIVE_CANDIDATE_STATUSES]),
  ])

  return NextResponse.json({
    capacity: {
      total_active: activeResult.count ?? 0,
      placed: placedResult.count ?? 0,
      bench: benchResult.count ?? 0,
      rolling_off_30d: rolloff30Result.count ?? 0,
      rolling_off_60d: rolloff60Result.count ?? 0,
      open_roles: openRolesResult.count ?? 0,
      overdue_roles: overdueRolesResult.count ?? 0,
      active_candidates: activeCandidatesResult.count ?? 0,
    },
  })
}
