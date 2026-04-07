import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getProfile } from '@/lib/auth/getProfile'
import { createClient } from '@/lib/supabase/server'
import { ConsultantDetail } from '@/components/admin/crm/ConsultantDetail'

export default async function ConsultantDetailPage({
  params,
}: {
  params: Promise<{ consultantId: string }>
}) {
  const { consultantId } = await params
  const profile = await getProfile()

  if (!profile || !['admin', 'sales'].includes(profile.role)) {
    redirect('/training')
  }

  const supabase = await createClient()

  // Fetch consultant with user profile and account
  const { data: consultant, error } = await supabase
    .from('crm_consultants')
    .select('*, profiles!inner(id, full_name, email), crm_companies(id, name)')
    .eq('id', consultantId)
    .single()

  if (error || !consultant) notFound()

  // Fetch assignment history
  const { data: assignments } = await supabase
    .from('crm_assignments')
    .select('*, crm_companies(id, name), crm_opportunities(id, title)')
    .eq('consultant_id', consultantId)
    .order('start_date', { ascending: false })

  type ShapedAssignment = {
    id: string
    account: { id: string; name: string } | null
    deal: { id: string; title: string } | null
    start_date: string | null
    expected_end_date: string | null
    actual_end_date: string | null
    bill_rate: number | null
    status: 'Planned' | 'Active' | 'Completed' | 'Cancelled'
    end_reason: string | null
    [key: string]: unknown
  }

  const shapedAssignments: ShapedAssignment[] = (assignments ?? []).map((a) => {
    const { crm_companies, crm_opportunities, ...rest } = a as Record<string, unknown>
    return {
      ...rest,
      account: crm_companies as { id: string; name: string } | null,
      deal: crm_opportunities as { id: string; title: string } | null,
    } as ShapedAssignment
  })

  const currentAssignment = shapedAssignments.find((a) => a.status === 'Active') ?? null

  const { profiles, crm_companies, ...rest } = consultant as Record<string, unknown>
  const consultantData = {
    ...(rest as {
      id: string
      function: string
      seniority: string | null
      skills: string[]
      status: 'Active - Placed' | 'Active - Bench' | 'On Leave' | 'Offboarded'
      start_date: string | null
      expected_end_date: string | null
      location: string | null
      notes: string | null
      hire_date: string | null
      promoted_from_candidate_id?: string | null
    }),
    user: profiles as { id: string; full_name: string; email: string },
    account: (crm_companies as { id: string; name: string }) ?? null,
    current_assignment: currentAssignment,
    assignments: shapedAssignments,
  }

  const userName = (consultantData.user as { full_name: string }).full_name

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
        <span className="text-foreground">{userName}</span>
      </nav>

      <ConsultantDetail consultant={consultantData} />
    </div>
  )
}
