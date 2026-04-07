'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  CONSULTANT_STATUSES,
  CONSULTANT_FUNCTIONS,
  type ConsultantStatus,
  type ConsultantFunction,
} from '@/lib/crm/constants'
import { formatShortDate } from '@/lib/crm/format'

interface Consultant {
  id: string
  function: string
  seniority: string | null
  skills: string[]
  status: ConsultantStatus
  start_date: string | null
  expected_end_date: string | null
  location: string | null
  notes: string | null
  user: { id: string; full_name: string; email: string }
  account: { id: string; name: string } | null
  days_on_bench: number | null
}

interface Account {
  id: string
  name: string
}

function ConsultantStatusBadge({ status }: { status: ConsultantStatus }) {
  const styles: Record<ConsultantStatus, string> = {
    'Active - Placed': 'bg-[var(--success-muted)] text-[var(--success)]',
    'Active - Bench': 'bg-[var(--warning-muted)] text-[var(--warning)]',
    'On Leave': 'bg-[var(--secondary-muted)] text-[var(--secondary)]',
    'Offboarded': 'bg-muted text-foreground-muted',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}

function getRowBg(status: ConsultantStatus): string {
  switch (status) {
    case 'Active - Bench':
      return 'bg-[var(--warning-muted)]'
    case 'Offboarded':
      return 'bg-muted/50'
    default:
      return ''
  }
}

function sortConsultants(consultants: Consultant[]): Consultant[] {
  return [...consultants].sort((a, b) => {
    // Placed first
    const aPlaced = a.status === 'Active - Placed' ? 0 : 1
    const bPlaced = b.status === 'Active - Placed' ? 0 : 1
    if (aPlaced !== bPlaced) return aPlaced - bPlaced

    // Then by expected_end_date ascending (soonest first, nulls last)
    const aEnd = a.expected_end_date ? new Date(a.expected_end_date).getTime() : Infinity
    const bEnd = b.expected_end_date ? new Date(b.expected_end_date).getTime() : Infinity
    return aEnd - bEnd
  })
}

export function RosterTable() {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<ConsultantStatus | ''>('')
  const [functionFilter, setFunctionFilter] = useState<ConsultantFunction | ''>('')
  const [accountFilter, setAccountFilter] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])

  // Fetch accounts for filter dropdown
  useEffect(() => {
    fetch('/api/admin/crm/companies?limit=100')
      .then((res) => res.json())
      .then((data) => {
        const sorted = (data.companies ?? []).sort((a: Account, b: Account) =>
          a.name.localeCompare(b.name)
        )
        setAccounts(sorted)
      })
      .catch(() => {})
  }, [])

  const fetchConsultants = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (functionFilter) params.set('function', functionFilter)
      if (accountFilter) params.set('account_id', accountFilter)

      const res = await fetch(`/api/admin/crm/consultants?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load consultants')
      const data = await res.json()
      setConsultants(sortConsultants(data.consultants ?? []))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load consultants')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, functionFilter, accountFilter])

  useEffect(() => {
    fetchConsultants()
  }, [fetchConsultants])

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ConsultantStatus | '')}
          className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">All Statuses</option>
          {CONSULTANT_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={functionFilter}
          onChange={(e) => setFunctionFilter(e.target.value as ConsultantFunction | '')}
          className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">All Functions</option>
          {CONSULTANT_FUNCTIONS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">All Accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

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
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && consultants.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-card">
          <svg className="mx-auto size-12 text-foreground-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-foreground">No consultants found</h3>
          <p className="mt-1 text-sm text-foreground-muted">
            Try adjusting your filters or add a new consultant.
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && consultants.length > 0 && (
        <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Function</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Seniority</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Account</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Expected End</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {consultants.map((c) => (
                <tr key={c.id} className={`transition-colors hover:bg-raised ${getRowBg(c.status)}`}>
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/crm/resources/${c.id}`}
                      className="text-sm font-medium text-foreground hover:text-accent transition-colors"
                    >
                      {c.user.full_name}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-sm text-foreground-muted">
                    {c.function}
                  </td>
                  <td className="px-5 py-4 text-sm text-foreground-muted">
                    {c.seniority ?? '--'}
                  </td>
                  <td className="px-5 py-4">
                    <ConsultantStatusBadge status={c.status} />
                  </td>
                  <td className="px-5 py-4 text-sm text-foreground-muted">
                    {c.account ? (
                      <Link
                        href={`/admin/crm/companies/${c.account.id}`}
                        className="text-sm text-foreground-muted hover:text-accent transition-colors"
                      >
                        {c.account.name}
                      </Link>
                    ) : (
                      '--'
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-foreground-muted">
                    {c.expected_end_date ? formatShortDate(c.expected_end_date) : '--'}
                  </td>
                  <td className="px-5 py-4 text-sm text-foreground-muted">
                    {c.location ?? '--'}
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
