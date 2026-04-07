import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getProfile } from '@/lib/auth/getProfile'
import { CandidatesList } from '@/components/admin/crm/CandidatesList'

export default async function CandidatesPage() {
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
        <Link href="/admin/crm/resources" className="hover:text-accent transition-colors">
          Resources
        </Link>
        <span>/</span>
        <span className="text-foreground">Candidates</span>
      </nav>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Candidates</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Hiring pipeline for potential consultants.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mt-8">
        <CandidatesList />
      </div>
    </div>
  )
}
