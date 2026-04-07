import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getProfile } from '@/lib/auth/getProfile'
import { PipelineStats } from '@/components/admin/crm/PipelineStats'

export default async function CrmDashboardPage() {
  const profile = await getProfile()

  if (!profile || !['admin', 'sales'].includes(profile.role)) {
    redirect('/training')
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">CRM Dashboard</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Track your pipeline, deals, and customer relationships.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-8">
        <PipelineStats />
      </div>

      {/* Quick links */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink
          href="/admin/crm/companies"
          title="Companies"
          description="View and manage all companies"
          icon="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
        />
        <QuickLink
          href="/admin/crm/opportunities"
          title="Pipeline"
          description="View deals across all stages"
          icon="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
        />
        <QuickLink
          href="/admin/crm/activities"
          title="Activities"
          description="View all logged activities"
          icon="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
        <QuickLink
          href="/admin/crm/import"
          title="Import"
          description="Import companies from CSV"
          icon="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
        />
      </div>

      {/* Reminders */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Reminders</h2>
          <RemindersSection />
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
            <Link
              href="/admin/crm/activities"
              className="text-sm text-accent hover:text-accent-hover transition-colors"
            >
              View All
            </Link>
          </div>
          <RecentActivities />
        </div>
      </div>
    </div>
  )
}

function QuickLink({
  href,
  title,
  description,
  icon,
}: {
  href: string
  title: string
  description: string
  icon: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-surface p-5 shadow-card transition-colors hover:border-accent/30"
      data-testid={`quick-link-${title.toLowerCase()}`}
    >
      <svg
        className="size-6 text-accent"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      <h3 className="mt-3 text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
        {title}
      </h3>
      <p className="mt-1 text-xs text-foreground-muted">{description}</p>
    </Link>
  )
}

function RemindersSection() {
  return (
    <div data-testid="reminders-section">
      <p className="text-sm text-foreground-muted">
        No reminders at this time. Stale deals and upcoming closes will appear here.
      </p>
    </div>
  )
}

function RecentActivities() {
  return (
    <div data-testid="recent-activities">
      <p className="text-sm text-foreground-muted">
        Recent activities will appear here once you start logging interactions.
      </p>
    </div>
  )
}
