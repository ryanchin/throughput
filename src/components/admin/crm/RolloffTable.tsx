'use client'

import { useState, useEffect } from 'react'
import { formatShortDate } from '@/lib/crm/format'

interface Rolloff {
  id: string
  consultant: {
    id: string
    user: { id: string; full_name: string; email: string }
  }
  account: { id: string; name: string }
  deal: { id: string; title: string } | null
  expected_end_date: string
  days_until_rolloff: number
}

export function RolloffTable() {
  const [rolloffs, setRolloffs] = useState<Rolloff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRolloffs() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/crm/consultants/rolloffs?days=60')
        if (!res.ok) throw new Error('Failed to load rolloffs')
        const data = await res.json()
        setRolloffs(data.rolloffs ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load rolloffs')
      } finally {
        setLoading(false)
      }
    }
    fetchRolloffs()
  }, [])

  return (
    <div>
      {/* Error */}
      {error && (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-foreground-muted">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && rolloffs.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-card">
          <svg className="mx-auto size-12 text-foreground-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-foreground">No upcoming rolloffs</h3>
          <p className="mt-1 text-sm text-foreground-muted">
            No upcoming rolloffs in the next 60 days.
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && rolloffs.length > 0 && (
        <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Consultant</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Account</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Deal</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Expected End</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Days Until Rolloff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rolloffs.map((r) => (
                <tr
                  key={r.id}
                  className={`transition-colors hover:bg-raised ${r.days_until_rolloff < 30 ? 'bg-[var(--warning-muted)]' : ''}`}
                >
                  <td className="px-5 py-4 text-sm font-medium text-foreground">
                    {r.consultant.user.full_name}
                  </td>
                  <td className="px-5 py-4 text-sm text-foreground-muted">
                    {r.account.name}
                  </td>
                  <td className="px-5 py-4 text-sm text-foreground-muted">
                    {r.deal?.title ?? '--'}
                  </td>
                  <td className="px-5 py-4 text-sm text-foreground-muted">
                    {formatShortDate(r.expected_end_date)}
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-foreground">
                    {r.days_until_rolloff}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
