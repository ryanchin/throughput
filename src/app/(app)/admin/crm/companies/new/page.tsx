import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getProfile } from '@/lib/auth/getProfile'
import { CompanyForm } from '@/components/admin/crm/CompanyForm'

export default async function NewCompanyPage() {
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
        <Link href="/admin/crm/companies" className="hover:text-accent transition-colors">
          Companies
        </Link>
        <span>/</span>
        <span className="text-foreground">New</span>
      </nav>

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">New Company</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Add a new company to your CRM.
        </p>
      </div>

      <CompanyForm />
    </div>
  )
}
