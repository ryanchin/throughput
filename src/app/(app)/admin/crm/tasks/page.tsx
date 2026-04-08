import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/getProfile'
import { TasksView } from '@/components/admin/crm/TasksView'

export default async function TasksPage() {
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
        <span className="text-foreground">Tasks</span>
      </nav>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Manage your tasks, follow-ups, and action items.
          </p>
        </div>
      </div>

      {/* Tasks view with tabs, filters, and table */}
      <div className="mt-8">
        <TasksView />
      </div>
    </div>
  )
}
