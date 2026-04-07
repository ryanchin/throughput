import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'

/**
 * GET /api/admin/crm/consultants/rolloffs?days=60
 * Active assignments ending within N days.
 * Returns consultant name, account, deal, expected_end_date, days_until_rolloff.
 */
export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const days = Number(request.nextUrl.searchParams.get('days') ?? 60)
  if (isNaN(days) || days < 1 || days > 365) {
    return NextResponse.json({ error: 'days must be between 1 and 365' }, { status: 400 })
  }

  const today = new Date()
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() + days)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  const { data: assignments, error } = await supabase
    .from('crm_assignments')
    .select('*, crm_consultants!inner(id, function, seniority, profiles!inner(id, full_name, email)), crm_companies!inner(id, name), crm_opportunities(id, title)')
    .eq('status', 'Active')
    .gte('expected_end_date', todayStr)
    .lte('expected_end_date', cutoffStr)
    .order('expected_end_date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch rolloffs' }, { status: 500 })
  }

  const shaped = (assignments ?? []).map((a) => {
    const { crm_consultants, crm_companies, crm_opportunities, ...rest } = a as Record<string, unknown>
    const consultant = crm_consultants as Record<string, unknown>
    const endDate = new Date(rest.expected_end_date as string)
    const daysUntil = Math.ceil((endDate.getTime() - today.getTime()) / 86400000)
    return {
      ...rest,
      consultant: { ...(({ profiles, ...c }) => ({ ...c, user: profiles }))(consultant as { profiles: unknown }) },
      account: crm_companies,
      deal: crm_opportunities ?? null,
      days_until_rolloff: daysUntil,
    }
  })

  return NextResponse.json({ rolloffs: shaped, total: shaped.length })
}
