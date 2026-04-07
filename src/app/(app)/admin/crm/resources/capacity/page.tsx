import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getProfile } from '@/lib/auth/getProfile'
import { CapacityDashboard } from '@/components/admin/crm/CapacityDashboard'

export default async function CapacityPage() {
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
        <span className="text-foreground">Capacity</span>
      </nav>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Capacity Summary</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Resource utilization and pipeline overview.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mt-8">
        <CapacityDashboard />
      </div>
    </div>
  )
}
