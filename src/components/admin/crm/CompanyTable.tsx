'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  COMPANY_STATUSES,
  COMPANY_STATUS_LABELS,
  type CompanyStatus,
} from '@/lib/crm/constants'
import { formatRelativeDate } from '@/lib/crm/format'
import type { Company } from '@/lib/crm/types'

function CompanyStatusBadge({ status }: { status: CompanyStatus }) {
  const styles: Record<CompanyStatus, string> = {
    prospect: 'bg-accent-muted text-accent',
    active: 'bg-[var(--success-muted)] text-[var(--success)]',
    churned: 'bg-[var(--destructive-muted)] text-[var(--destructive)]',
    partner: 'bg-[var(--secondary-muted)] text-[var(--secondary)]',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
      data-testid={`company-status-${status}`}
    >
      {COMPANY_STATUS_LABELS[status]}
    </span>
  )
}

export function CompanyTable() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | ''>('')

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/admin/crm/companies?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load companies')
      const data = await res.json()
      setCompanies(data.companies ?? data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load companies')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    const timer = setTimeout(fetchCompanies, 300)
    return () => clearTimeout(timer)
  }, [fetchCompanies])

  return (
    <div data-testid="company-table-wrapper">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies..."
          className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          data-testid="company-search-input"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CompanyStatus | '')}
          className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          data-testid="company-status-filter"
        >
          <option value="">All Statuses</option>
          {COMPANY_STATUSES.map((s) => (
            <option key={s} value={s}>{COMPANY_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-foreground-muted" data-testid="company-table-error">
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && companies.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-card" data-testid="company-empty-state">
          <svg className="mx-auto size-12 text-foreground-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-foreground">No companies yet</h3>
          <p className="mt-1 text-sm text-foreground-muted">
            Add your first company to get started.
          </p>
          <div className="mt-6">
            <Link
              href="/admin/crm/companies/new"
              className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
              data-testid="empty-new-company-button"
            >
              Add Company
            </Link>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && companies.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
              <table className="w-full" data-testid="companies-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Industry</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Status</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-foreground-muted">Deals</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Last Activity</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {companies.map((company) => (
                    <tr key={company.id} className="transition-colors hover:bg-raised" data-testid={`company-row-${company.id}`}>
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/crm/companies/${company.id}`}
                          className="text-sm font-medium text-foreground hover:text-accent transition-colors"
                        >
                          {company.name}
                        </Link>
                        {company.website && (
                          <p className="mt-0.5 text-xs text-foreground-muted truncate max-w-[200px]">
                            {company.website.replace(/^https?:\/\//, '')}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground-muted">
                        {company.industry ?? '--'}
                      </td>
                      <td className="px-5 py-4">
                        <CompanyStatusBadge status={company.status} />
                      </td>
                      <td className="px-5 py-4 text-center text-sm text-foreground-muted">
                        --
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground-muted">
                        {formatRelativeDate(company.updated_at)}
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground-muted">
                        {formatRelativeDate(company.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {companies.map((company) => (
              <div key={company.id} className="rounded-xl border border-border bg-surface p-4 shadow-card" data-testid={`company-card-${company.id}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <Link
                      href={`/admin/crm/companies/${company.id}`}
                      className="text-sm font-medium text-foreground hover:text-accent transition-colors"
                    >
                      {company.name}
                    </Link>
                    <div className="mt-2">
                      <CompanyStatusBadge status={company.status} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-foreground-muted">
                  {company.industry && <span>{company.industry}</span>}
                  <span>Created {formatRelativeDate(company.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
