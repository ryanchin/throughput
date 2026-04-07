import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getProfile } from '@/lib/auth/getProfile'
import { createClient } from '@/lib/supabase/server'
import { CompanyDetail } from '@/components/admin/crm/CompanyDetail'
import type { Company } from '@/lib/crm/types'

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = await params
  const profile = await getProfile()

  if (!profile || !['admin', 'sales'].includes(profile.role)) {
    redirect('/training')
  }

  const supabase = await createClient()

  const { data: company, error } = await supabase
    .from('crm_companies')
    .select('*')
    .eq('id', companyId)
    .single()

  if (error || !company) notFound()

  // Map to our Company type, handling potentially missing fields
  const companyData: Company = {
    id: company.id,
    name: company.name,
    website: company.website ?? null,
    industry: company.industry ?? null,
    company_size: company.company_size ?? null,
    status: company.status ?? 'prospect',
    notes: company.notes ?? null,
    tags: company.tags ?? [],
    ai_enriched: company.ai_enriched ?? false,
    ai_enrichment_data: company.ai_enrichment_data ?? null,
    created_at: company.created_at,
    updated_at: company.updated_at,
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-foreground-muted">
        <Link href="/admin/crm" className="hover:text-accent transition-colors">
          CRM
        </Link>
        <span>/</span>
        <Link href="/admin/crm/companies" className="hover:text-accent transition-colors">
          Companies
        </Link>
        <span>/</span>
        <span className="text-foreground">{companyData.name}</span>
      </nav>

      <CompanyDetail company={companyData} userRole={profile.role} />
    </div>
  )
}
