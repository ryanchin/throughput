import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/getProfile'
import { CompanyTable } from '@/components/admin/crm/CompanyTable'

export default async function CompaniesPage() {
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
        <span className="text-foreground">Companies</span>
      </nav>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Companies</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Manage your company accounts and relationships.
          </p>
        </div>
        <Link
          href="/admin/crm/companies/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
          data-testid="new-company-button"
        >
          New Company
        </Link>
      </div>

      {/* Company table with search and filters */}
      <div className="mt-8">
        <CompanyTable />
      </div>
    </div>
  )
}
