'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABELS,
  type ActivityType,
} from '@/lib/crm/constants'
import { formatRelativeDate } from '@/lib/crm/format'
import type { Activity } from '@/lib/crm/types'
import { ActivityForm } from './ActivityForm'
import { CompanyCombobox } from './CompanyCombobox'

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  call: 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z',
  email: 'M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75',
  meeting: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
  note: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  task: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [companyFilter, setCompanyFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<ActivityType | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [showActivityForm, setShowActivityForm] = useState(false)

  const fetchActivities = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (companyFilter) params.set('company_id', companyFilter)
      if (typeFilter) params.set('type', typeFilter)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)

      const res = await fetch(`/api/admin/crm/activities?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load activities')
      const data = await res.json()
      setActivities(data.activities ?? data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities')
    } finally {
      setLoading(false)
    }
  }, [companyFilter, typeFilter, dateFrom, dateTo])

  useEffect(() => {
    const timer = setTimeout(fetchActivities, 300)
    return () => clearTimeout(timer)
  }, [fetchActivities])

  return (
    <div data-testid="activity-feed">
      {/* Header with Log Activity button */}
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={() => setShowActivityForm(true)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
          data-testid="log-activity-button"
        >
          Log Activity
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center mb-6">
        <div className="w-64">
          <CompanyCombobox
            value={companyFilter}
            onChange={setCompanyFilter}
            placeholder="Filter by company..."
            allowNone
            noneLabel="All Companies"
            data-testid="activity-company-filter"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ActivityType | '')}
          className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          data-testid="activity-type-filter"
        >
          <option value="">All Types</option>
          {ACTIVITY_TYPES.map((t) => (
            <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="From"
            data-testid="activity-date-from"
          />
          <span className="text-foreground-muted text-sm">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="To"
            data-testid="activity-date-to"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-foreground-muted" data-testid="activity-feed-error">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 rounded-xl bg-surface border border-border p-4">
              <div className="size-8 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                <div className="h-3 w-32 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && activities.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-card" data-testid="activity-empty-state">
          <svg className="mx-auto size-12 text-foreground-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-foreground">No activities yet</h3>
          <p className="mt-1 text-sm text-foreground-muted">
            Log your first activity to start tracking interactions.
          </p>
        </div>
      )}

      {/* Timeline */}
      {!loading && !error && activities.length > 0 && (
        <div className="space-y-3" data-testid="activity-timeline">
          {activities.map((act) => (
            <div
              key={act.id}
              className="flex gap-3 rounded-xl border border-border bg-surface p-4 shadow-card"
              data-testid={`activity-item-${act.id}`}
            >
              <div className="shrink-0 mt-0.5 flex size-8 items-center justify-center rounded-full bg-muted">
                <svg className="size-4 text-foreground-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={ACTIVITY_ICONS[act.type as ActivityType] ?? ACTIVITY_ICONS.note} />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{act.subject}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground-muted">
                    {ACTIVITY_TYPE_LABELS[act.type as ActivityType] ?? act.type}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-foreground-muted">
                  {act.company && (
                    <Link
                      href={`/admin/crm/companies/${act.company.id}`}
                      className="hover:text-accent transition-colors"
                    >
                      {act.company.name}
                    </Link>
                  )}
                  <span>{formatRelativeDate(act.activity_date)}</span>
                </div>
                {act.description && (
                  <p className="mt-2 text-sm text-foreground-muted">{act.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log Activity Form */}
      <ActivityForm
        open={showActivityForm}
        onOpenChange={setShowActivityForm}
        onSaved={() => {
          setShowActivityForm(false)
          fetchActivities()
        }}
      />
    </div>
  )
}
