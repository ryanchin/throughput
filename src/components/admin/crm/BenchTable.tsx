'use client'

import { useState, useEffect } from 'react'

interface BenchConsultant {
  id: string
  function: string
  seniority: string | null
  skills: string[]
  user: { id: string; full_name: string; email: string }
  days_on_bench: number | null
  last_account: string | null
}

export function BenchTable() {
  const [bench, setBench] = useState<BenchConsultant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchBench() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/crm/consultants/bench')
        if (!res.ok) throw new Error('Failed to load bench consultants')
        const data = await res.json()
        setBench(data.bench ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load bench consultants')
      } finally {
        setLoading(false)
      }
    }
    fetchBench()
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
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && bench.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-card">
          <svg className="mx-auto size-12 text-foreground-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-foreground">No consultants on bench</h3>
          <p className="mt-1 text-sm text-foreground-muted">
            All consultants are currently placed.
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && bench.length > 0 && (
        <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Function</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Seniority</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Skills</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Days on Bench</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Last Account</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bench.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-raised">
                  <td className="px-5 py-4 text-sm font-medium text-foreground">
                    {c.user.full_name}
                  </td>
                  <td className="px-5 py-4 text-sm text-foreground-muted">
                    {c.function}
                  </td>
                  <td className="px-5 py-4 text-sm text-foreground-muted">
                    {c.seniority ?? '--'}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap">
                      {c.skills.length > 0 ? (
                        c.skills.map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center rounded-full bg-accent-muted px-2 py-0.5 text-xs text-accent mr-1 mb-1"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-foreground-muted">--</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-foreground">
                    {c.days_on_bench != null ? `${c.days_on_bench}d` : '--'}
                  </td>
                  <td className="px-5 py-4 text-sm text-foreground-muted">
                    {c.last_account ?? '--'}
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
