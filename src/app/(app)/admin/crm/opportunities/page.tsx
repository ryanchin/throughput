import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getProfile } from '@/lib/auth/getProfile'
import { OpportunityKanban } from '@/components/admin/crm/OpportunityKanban'

export default async function OpportunitiesPage() {
  const profile = await getProfile()

  if (!profile || !['admin', 'sales'].includes(profile.role)) {
    redirect('/training')
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-foreground-muted">
        <Link href="/admin/crm" className="hover:text-accent transition-colors">
          CRM
        </Link>
        <span>/</span>
        <span className="text-foreground">Pipeline</span>
      </nav>

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Pipeline</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Manage your sales pipeline across stages.
        </p>
      </div>

      <div className="mt-8">
        <OpportunityKanban />
      </div>
    </div>
  )
}
