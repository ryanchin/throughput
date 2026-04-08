import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getProfile } from '@/lib/auth/getProfile'
import { createClient } from '@/lib/supabase/server'
import { RoleDetail } from '@/components/admin/crm/RoleDetail'
import type { CandidateStatus, ConsultantFunction } from '@/lib/crm/constants'

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ roleId: string }>
}) {
  const { roleId } = await params
  const profile = await getProfile()

  if (!profile || !['admin', 'sales'].includes(profile.role)) {
    redirect('/training')
  }

  const supabase = await createClient()

  // Fetch role with account and deal joins
  const { data: role, error } = await supabase
    .from('crm_roles')
    .select('*, crm_companies(id, name), crm_opportunities(id, title)')
    .eq('id', roleId)
    .single()

  if (error || !role) notFound()

  // Fetch candidates assigned to this role
  const { data: candidates } = await supabase
    .from('crm_candidates')
    .select('id, first_name, last_name, function, seniority, skills, status, source, date_added, promoted_to_consultant_id')
    .eq('target_role_id', roleId)
    .order('date_added', { ascending: false })

  // Fetch bench consultants matching the role's function
  let matchingBench: { id: string; function: string; seniority: string | null; skills: string[]; user: { id: string; full_name: string } }[] = []
  if (role.function) {
    const { data: bench } = await supabase
      .from('crm_consultants')
      .select('id, function, seniority, skills, profiles!inner(id, full_name)')
      .eq('status', 'Active - Bench')
      .eq('function', role.function as unknown as ConsultantFunction)

    matchingBench = (bench ?? []).map((c) => {
      const { profiles, ...rest } = c as Record<string, unknown>
      return {
        ...rest,
        user: profiles,
      } as { id: string; function: string; seniority: string | null; skills: string[]; user: { id: string; full_name: string } }
    })
  }

  // Shape the role data
  const { crm_companies, crm_opportunities, ...rest } = role as Record<string, unknown>
  const roleData = {
    ...(rest as {
      id: string
      name: string
      function: string | null
      status: string
      priority: number | null
      target_fill_date: string | null
      role_stage: string | null
      blocker: string | null
      description: string | null
      notes: string | null
    }),
    account: (crm_companies as { id: string; name: string }) ?? null,
    deal: (crm_opportunities as { id: string; title: string }) ?? null,
  }

  const shapedCandidates = (candidates ?? []).map((c) => ({
    ...c,
    status: c.status as CandidateStatus,
  }))

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-foreground-muted">
        <Link href="/admin/crm" className="hover:text-accent transition-colors">
          CRM
        </Link>
        <span>/</span>
        <Link href="/admin/crm/resources" className="hover:text-accent transition-colors">
          Resources
        </Link>
        <span>/</span>
        <Link href="/admin/crm/resources/roles" className="hover:text-accent transition-colors">
          Roles
        </Link>
        <span>/</span>
        <span className="text-foreground">{roleData.name}</span>
      </nav>

      <RoleDetail
        role={roleData}
        candidates={shapedCandidates}
        matchingBench={matchingBench}
      />
    </div>
  )
}
