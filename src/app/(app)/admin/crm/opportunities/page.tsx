import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OpportunityKanban } from '@/components/admin/crm/OpportunityKanban'

export default async function OpportunitiesPage() {
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
          <h1 className="text-3xl font-bold text-foreground">Pipeline</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Manage your sales pipeline. Drag deals between stages.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <OpportunityKanban />
      </div>
    </div>
  )
}
