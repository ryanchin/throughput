import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getProfile } from '@/lib/auth/getProfile'
import { ActivityFeed } from '@/components/admin/crm/ActivityFeed'

export default async function ActivitiesPage() {
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
        <span className="text-foreground">Activities</span>
      </nav>

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Activities</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Timeline of all sales activities and interactions.
        </p>
      </div>

      {/* ActivityFeed includes its own "Log Activity" modal trigger */}
      <div className="mt-8">
        <ActivityFeed />
      </div>
    </div>
  )
}
