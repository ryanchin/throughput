import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { COMPANY_STATUS_LABELS } from '@/lib/crm/constants'
import type { CompanyStatus } from '@/lib/crm/constants'

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = await params
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

  const { data: company, error } = await supabase
    .from('crm_companies')
    .select('*')
    .eq('id', companyId)
    .single()

  if (error || !company) notFound()

  // Fetch related counts
  const [contactsRes, oppsRes, activitiesRes] = await Promise.all([
    supabase.from('crm_contacts').select('id', { count: 'exact' }).eq('company_id', companyId),
    supabase.from('crm_opportunities').select('id, value, stage').eq('company_id', companyId),
    supabase.from('crm_activities').select('*').eq('company_id', companyId).order('activity_date', { ascending: false }).limit(10),
  ])

  const contactCount = contactsRes.count ?? 0
  const opportunities = oppsRes.data ?? []
  const activities = activitiesRes.data ?? []
  const pipelineValue = opportunities
    .filter(o => !['closed_won', 'closed_lost'].includes(o.stage))
    .reduce((sum, o) => sum + (Number(o.value) || 0), 0)

  const statusLabel = COMPANY_STATUS_LABELS[company.status as CompanyStatus] ?? company.status

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-sm text-foreground-muted mb-4">
        <Link href="/admin/crm/companies" className="hover:text-accent">Companies</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{company.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{company.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              company.status === 'active' ? 'bg-green-900/30 text-green-400 border border-green-700/50' :
              company.status === 'prospect' ? 'bg-accent-muted text-accent border border-accent/30' :
              company.status === 'partner' ? 'bg-purple-900/30 text-purple-400 border border-purple-700/50' :
              'bg-red-900/30 text-red-400 border border-red-700/50'
            }`}>
              {statusLabel}
            </span>
            {company.industry && (
              <span className="text-sm text-foreground-muted">{company.industry}</span>
            )}
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:text-accent-hover">
                {new URL(company.website).hostname}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-sm text-foreground-muted">Contacts</p>
          <p className="text-2xl font-bold text-foreground">{contactCount}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-sm text-foreground-muted">Deals</p>
          <p className="text-2xl font-bold text-foreground">{opportunities.length}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-sm text-foreground-muted">Pipeline Value</p>
          <p className="text-2xl font-bold text-foreground">${pipelineValue.toLocaleString()}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-sm text-foreground-muted">Activities</p>
          <p className="text-2xl font-bold text-foreground">{activities.length}</p>
        </div>
      </div>

      {/* Notes */}
      {company.notes && (
        <div className="mt-6 bg-surface border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">Notes</h2>
          <p className="text-sm text-foreground-muted whitespace-pre-wrap">{company.notes}</p>
        </div>
      )}

      {/* Tags */}
      {company.tags && company.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {company.tags.map((tag: string) => (
            <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground-muted border border-border">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Recent Activities */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activities</h2>
        {activities.length === 0 ? (
          <p className="text-sm text-foreground-muted">No activities logged yet.</p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="bg-surface border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground-muted border border-border capitalize">
                      {activity.type}
                    </span>
                    <span className="text-sm font-medium text-foreground">{activity.subject}</span>
                  </div>
                  <span className="text-xs text-foreground-muted">
                    {new Date(activity.activity_date).toLocaleDateString()}
                  </span>
                </div>
                {activity.description && (
                  <p className="mt-1 text-sm text-foreground-muted">{activity.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Opportunities */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Opportunities</h2>
        {opportunities.length === 0 ? (
          <p className="text-sm text-foreground-muted">No deals yet.</p>
        ) : (
          <div className="space-y-3">
            {opportunities.map((opp) => (
              <div key={opp.id} className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-foreground">{(opp as Record<string, unknown>).title as string}</span>
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent-muted text-accent border border-accent/30">
                    {opp.stage.replace('_', ' ')}
                  </span>
                </div>
                {opp.value && (
                  <span className="text-sm font-semibold text-foreground">
                    ${Number(opp.value).toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
