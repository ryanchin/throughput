import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CompanyTable } from '@/components/admin/crm/CompanyTable'

export default async function CompaniesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'sales'].includes(profile.role)) {
    redirect('/training')
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Companies</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Manage your company relationships.
          </p>
        </div>
        <Link
          href="/admin/crm/companies/new"
          className="inline-flex items-center px-4 py-2 bg-accent text-background font-medium rounded-lg hover:bg-accent-hover transition-colors shadow-accent-glow"
        >
          + New Company
        </Link>
      </div>

      <div className="mt-8">
        <CompanyTable />
      </div>
    </div>
  )
}
