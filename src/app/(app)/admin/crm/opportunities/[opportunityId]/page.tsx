import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getProfile } from '@/lib/auth/getProfile'
import { createClient } from '@/lib/supabase/server'
import { OpportunityDetail } from '@/components/admin/crm/OpportunityDetail'
import type { Opportunity } from '@/lib/crm/types'
import type { Stage } from '@/lib/crm/constants'

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>
}) {
  const { opportunityId } = await params
  const profile = await getProfile()

  if (!profile || !['admin', 'sales'].includes(profile.role)) {
    redirect('/training')
  }

  const supabase = await createClient()

  const { data: opportunity, error } = await supabase
    .from('crm_opportunities')
    .select('*, crm_companies(id, name)')
    .eq('id', opportunityId)
    .single()

  if (error || !opportunity) notFound()

  // Map to our Opportunity type
  const company = opportunity.crm_companies as unknown as { id: string; name: string } | null
  const opportunityData: Opportunity = {
    id: opportunity.id,
    company_id: opportunity.company_id,
    contact_id: opportunity.contact_id ?? null,
    title: opportunity.title,
    value: opportunity.value ?? 0,
    stage: opportunity.stage as Stage,
    probability: opportunity.probability ?? null,
    expected_close_date: opportunity.expected_close_date ?? null,
    notes: opportunity.notes ?? null,
    close_reason: opportunity.close_reason ?? null,
    ai_score: opportunity.ai_score ?? null,
    ai_score_explanation: null,
    created_at: opportunity.created_at,
    updated_at: opportunity.updated_at,
    company: company ? { id: company.id, name: company.name } : undefined,
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-foreground-muted">
        <Link href="/admin/crm" className="hover:text-accent transition-colors">
          CRM
        </Link>
        <span>/</span>
        <Link href="/admin/crm" className="hover:text-accent transition-colors">
          Pipeline
        </Link>
        <span>/</span>
        <span className="text-foreground">{opportunityData.title}</span>
      </nav>

      <OpportunityDetail opportunity={opportunityData} userRole={profile.role} />
    </div>
  )
}
