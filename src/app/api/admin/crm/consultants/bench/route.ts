import { NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'

/**
 * GET /api/admin/crm/consultants/bench
 * Bench consultants with days_on_bench (computed from last assignment end date)
 * and last account placed at. Sorted by days on bench descending.
 */
export async function GET() {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { data: consultants, error } = await supabase
    .from('crm_consultants')
    .select('*, profiles!inner(id, full_name, email)')
    .eq('status', 'Active - Bench')

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch bench consultants' }, { status: 500 })
  }

  const consultantIds = (consultants ?? []).map((c) => c.id)

  // Fetch last completed assignment for each bench consultant
  let lastAssignmentMap: Record<string, { actual_end_date: string; account_name: string }> = {}
  if (consultantIds.length > 0) {
    const { data: assignments } = await supabase
      .from('crm_assignments')
      .select('consultant_id, actual_end_date, account_id')
      .in('consultant_id', consultantIds)
      .eq('status', 'Completed')
      .order('actual_end_date', { ascending: false })

    // Resolve account names for last assignments
    const accountIds = [...new Set((assignments ?? []).map((a) => a.account_id).filter(Boolean))]
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

  const today = new Date()
  const shaped = (consultants ?? []).map((c) => {
    const { profiles, ...rest } = c as Record<string, unknown>
    const last = lastAssignmentMap[rest.id as string]
    const daysOnBench = last?.actual_end_date
      ? Math.floor((today.getTime() - new Date(last.actual_end_date).getTime()) / 86400000)
      : null
    return {
      ...rest,
      user: profiles,
      days_on_bench: daysOnBench,
      last_account: last?.account_name ?? null,
    }
  })

  // Sort by days on bench descending (nulls last)
  shaped.sort((a, b) => (b.days_on_bench ?? -1) - (a.days_on_bench ?? -1))

  return NextResponse.json({ bench: shaped, total: shaped.length })
}
