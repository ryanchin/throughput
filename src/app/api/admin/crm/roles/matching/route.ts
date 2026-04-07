import { NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'

/**
 * GET /api/admin/crm/roles/matching
 * For each open role, finds bench consultants whose function matches.
 * Returns role info with an array of matching consultants sorted by skill overlap.
 */
export async function GET() {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // Fetch open roles
  const { data: roles, error: rolesErr } = await supabase
    .from('crm_roles')
    .select('*, crm_companies(id, name)')
    .eq('status', 'Open')
    .order('target_fill_date', { ascending: true })

  if (rolesErr) {
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 })
  }

  // Fetch bench consultants
  const { data: benchConsultants, error: benchErr } = await supabase
    .from('crm_consultants')
    .select('*, profiles!inner(id, full_name, email)')
    .eq('status', 'Active - Bench')

  if (benchErr) {
    return NextResponse.json({ error: 'Failed to fetch bench consultants' }, { status: 500 })
  }

  const today = new Date()

  const matchedRoles = (roles ?? []).map((role) => {
    const { crm_companies, ...roleRest } = role as Record<string, unknown>
    const roleFunction = roleRest.function as string | null
    const targetFillDate = roleRest.target_fill_date as string | null
    const daysOverdue = targetFillDate
      ? Math.floor((today.getTime() - new Date(targetFillDate).getTime()) / 86400000)
      : null

    // Match bench consultants by function
    const matches = (benchConsultants ?? [])
      .filter((c) => !roleFunction || c.function === roleFunction)
      .map((c) => {
        const { profiles, ...consultantRest } = c as Record<string, unknown>
        // No role-level skills to match against, so just count consultant skills
        const skills = (consultantRest.skills as string[]) ?? []
        return {
          ...consultantRest,
          user: profiles,
          skill_count: skills.length,
        }
      })
      .sort((a, b) => b.skill_count - a.skill_count)

    return {
      ...roleRest,
      account: crm_companies ?? null,
      days_overdue: daysOverdue,
      matching_consultants: matches,
      match_count: matches.length,
    }
  })

  return NextResponse.json({ roles: matchedRoles, total: matchedRoles.length })
}
