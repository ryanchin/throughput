import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PipelineStats } from '@/components/admin/crm/PipelineStats'

export default async function CrmDashboardPage() {
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
          <h1 className="text-3xl font-bold text-foreground">CRM Dashboard</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Pipeline overview, reminders, and recent activity.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <PipelineStats />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Reminders Section */}
        <div className="bg-surface border border-border rounded-xl p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Reminders</h2>
          <RemindersList />
        </div>

        {/* Recent Activity */}
        <div className="bg-surface border border-border rounded-xl p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
          <RecentActivity />
        </div>
      </div>
    </div>
  )
}

async function RemindersList() {
  return (
    <div className="text-sm text-foreground-muted">
      <p>Loading reminders...</p>
    </div>
  )
}

async function RecentActivity() {
  return (
    <div className="text-sm text-foreground-muted">
      <p>Loading recent activity...</p>
    </div>
  )
}
