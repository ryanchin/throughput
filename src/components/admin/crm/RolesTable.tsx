'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ROLE_STATUSES,
  ROLE_FUNCTIONS,
  type RoleStatus,
  type RoleFunction,
} from '@/lib/crm/constants'
import { formatShortDate } from '@/lib/crm/format'

interface Role {
  id: string
  name: string
  function: string | null
  status: RoleStatus
  priority: number | null
  target_fill_date: string | null
  role_stage: string | null
  blocker: string | null
  account: { id: string; name: string } | null
  deal: { id: string; title: string } | null
}

function RoleStatusBadge({ status }: { status: RoleStatus }) {
  const styles: Record<RoleStatus, string> = {
    Open: 'bg-accent-muted text-accent',
    Filled: 'bg-[var(--success-muted)] text-[var(--success)]',
    'Filled- External': 'bg-[var(--success-muted)] text-[var(--success)]',
    Fulfilled: 'bg-[var(--success-muted)] text-[var(--success)]',
    Cancelled: 'bg-[var(--destructive-muted)] text-[var(--destructive)]',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}

export function RolesTable() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<RoleStatus | ''>('Open')
  const [functionFilter, setFunctionFilter] = useState<RoleFunction | ''>('')

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (functionFilter) params.set('function', functionFilter)

      const res = await fetch(`/api/admin/crm/roles?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load roles')
      const data = await res.json()
      setRoles(data.roles ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, functionFilter])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as RoleStatus | '')}
          className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">All Statuses</option>
          {ROLE_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={functionFilter}
          onChange={(e) => setFunctionFilter(e.target.value as RoleFunction | '')}
          className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">All Functions</option>
          {ROLE_FUNCTIONS.map((f) => (
            <option key={f} value={f}>{f}</option>
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
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && roles.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-card">
          <svg className="mx-auto size-12 text-foreground-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-foreground">No roles found</h3>
          <p className="mt-1 text-sm text-foreground-muted">
            Roles are created when deals close won.
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && roles.length > 0 && (
        <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Role Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Account</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Deal</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Function</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Priority</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Target Fill Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Role Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roles.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-raised">
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/crm/resources/roles/${r.id}`}
                      className="text-sm font-medium text-foreground hover:text-accent transition-colors"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-sm text-foreground-muted">
                    {r.account ? (
                      <Link
                        href={`/admin/crm/companies/${r.account.id}`}
                        className="text-sm text-foreground-muted hover:text-accent transition-colors"
                      >
                        {r.account.name}
                      </Link>
                    ) : (
                      '--'
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-foreground-muted">
                    {r.deal ? (
                      <Link
                        href={`/admin/crm/opportunities/${r.deal.id}`}
                        className="text-sm text-foreground-muted hover:text-accent transition-colors"
                      >
                        {r.deal.title}
                      </Link>
                    ) : (
                      '--'
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-foreground-muted">
                    {r.function ?? '--'}
                  </td>
                  <td className="px-5 py-4">
                    <RoleStatusBadge status={r.status} />
                  </td>
                  <td className="px-5 py-4 text-sm text-foreground-muted">
                    {r.priority != null ? (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.priority === 1
                          ? 'bg-[var(--destructive-muted)] text-[var(--destructive)]'
                          : 'bg-[var(--warning-muted)] text-[var(--warning)]'
                      }`}>
                        P{r.priority}
                      </span>
                    ) : (
                      '--'
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-foreground-muted">
                    {r.target_fill_date ? formatShortDate(r.target_fill_date) : '--'}
                  </td>
                  <td className="px-5 py-4 text-sm text-foreground-muted">
                    {r.role_stage ?? '--'}
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
