import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ActivitiesPage() {
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

  // Fetch recent activities
  // Note: crm_activities table may not be in generated types yet.
  // Using any cast until types are regenerated from migration.
  const { data: activities } = await (supabase as any)
    .from('crm_activities')
    .select('*')
    .order('activity_date', { ascending: false })
    .limit(50) as { data: any[] | null }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Activities</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Timeline of all sales activities.
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {(!activities || activities.length === 0) ? (
          <div className="text-center py-12 bg-surface border border-border rounded-xl">
            <p className="text-foreground-muted">No activities logged yet.</p>
            <p className="text-sm text-foreground-subtle mt-1">
              Log your first activity from a company detail page.
            </p>
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground-muted border border-border capitalize">
                    {activity.type}
                  </span>
                  <span className="text-sm font-medium text-foreground">{activity.subject}</span>
                  {activity.company_name && (
                    <span className="text-sm text-foreground-muted">
                      at {activity.company_name}
                    </span>
                  )}
                </div>
                <span className="text-xs text-foreground-muted">
                  {new Date(activity.activity_date).toLocaleDateString()}
                </span>
              </div>
              {activity.description && (
                <p className="mt-2 text-sm text-foreground-muted">{activity.description}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
