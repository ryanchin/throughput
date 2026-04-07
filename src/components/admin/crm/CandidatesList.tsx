'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatShortDate } from '@/lib/crm/format'
import type { CandidateStatus } from '@/lib/crm/constants'

interface Candidate {
  id: string
  first_name: string
  last_name: string
  function: string
  seniority: string | null
  skills: string[]
  status: CandidateStatus
  source: string | null
  target_account: { id: string; name: string } | null
  target_role: { id: string; name: string } | null
  date_added: string
  days_in_pipeline: number | null
  promoted_to_consultant_id: string | null
}

function CandidateStatusBadge({ status }: { status: CandidateStatus }) {
  const styles: Record<CandidateStatus, string> = {
    New: 'bg-accent-muted text-accent',
    Screening: 'bg-accent-muted text-accent',
    Interviewing: 'bg-[var(--warning-muted)] text-[var(--warning)]',
    'Offer Extended': 'bg-[var(--success-muted)] text-[var(--success)]',
    Hired: 'bg-[var(--success-muted)] text-[var(--success)]',
    Rejected: 'bg-[var(--destructive-muted)] text-[var(--destructive)]',
    Withdrawn: 'bg-muted text-foreground-muted',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}

function CandidateTable({
  candidates,
  showPromote,
  onPromote,
  promotingId,
}: {
  candidates: Candidate[]
  showPromote?: boolean
  onPromote?: (id: string) => void
  promotingId?: string | null
}) {
  if (candidates.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Name</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Function</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Target Account</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Source</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Date Added</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Days in Pipeline</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Status</th>
            {showPromote && (
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {candidates.map((c) => (
            <tr key={c.id} className="transition-colors hover:bg-raised">
              <td className="px-5 py-4 text-sm font-medium text-foreground">
                {c.first_name} {c.last_name}
              </td>
              <td className="px-5 py-4 text-sm text-foreground-muted">
                {c.function}
              </td>
              <td className="px-5 py-4 text-sm text-foreground-muted">
                {c.target_account?.name ?? '--'}
              </td>
              <td className="px-5 py-4 text-sm text-foreground-muted">
                {c.source ?? '--'}
              </td>
              <td className="px-5 py-4 text-sm text-foreground-muted">
                {c.date_added ? formatShortDate(c.date_added) : '--'}
              </td>
              <td className="px-5 py-4 text-sm text-foreground-muted">
                {c.days_in_pipeline != null ? `${c.days_in_pipeline}d` : '--'}
              </td>
              <td className="px-5 py-4">
                <CandidateStatusBadge status={c.status} />
              </td>
              {showPromote && (
                <td className="px-5 py-4">
                  {!c.promoted_to_consultant_id && onPromote && (
                    <button
                      onClick={() => onPromote(c.id)}
                      disabled={promotingId === c.id}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-background hover:bg-accent-hover transition-colors disabled:opacity-50"
                    >
                      {promotingId === c.id ? 'Promoting...' : 'Promote'}
                    </button>
                  )}
                  {c.promoted_to_consultant_id && (
                    <span className="text-xs text-foreground-muted">Promoted</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CandidatesList() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [promotingId, setPromotingId] = useState<string | null>(null)

  const fetchCandidates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/crm/candidates')
      if (!res.ok) throw new Error('Failed to load candidates')
      const data = await res.json()
      setCandidates(data.candidates ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load candidates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

  const handlePromote = async (candidateId: string) => {
    setPromotingId(candidateId)
    try {
      const res = await fetch(`/api/admin/crm/candidates/${candidateId}/promote`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to promote candidate')
      }
      // Refetch the list after successful promotion
      await fetchCandidates()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to promote candidate')
    } finally {
      setPromotingId(null)
    }
  }

  // Group candidates into sections
  const activePipeline = candidates.filter((c) =>
    ['Screening', 'Interviewing', 'Offer Extended'].includes(c.status)
  )
  const hired = candidates.filter((c) => c.status === 'Hired')
  const closed = candidates.filter((c) => ['Rejected', 'Withdrawn'].includes(c.status))

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
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && candidates.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-card">
          <svg className="mx-auto size-12 text-foreground-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-foreground">No candidates yet</h3>
          <p className="mt-1 text-sm text-foreground-muted">
            Add candidates to start building your hiring pipeline.
          </p>
        </div>
      )}

      {/* Sections */}
      {!loading && !error && candidates.length > 0 && (
        <div className="space-y-10">
          {/* Active Pipeline */}
          {activePipeline.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                Active Pipeline
                <span className="ml-2 text-sm font-normal text-foreground-muted">({activePipeline.length})</span>
              </h2>
              <CandidateTable candidates={activePipeline} />
            </div>
          )}

          {/* Hired */}
          {hired.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                Hired
                <span className="ml-2 text-sm font-normal text-foreground-muted">({hired.length})</span>
              </h2>
              <CandidateTable
                candidates={hired}
                showPromote
                onPromote={handlePromote}
                promotingId={promotingId}
              />
            </div>
          )}

          {/* Closed */}
          {closed.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                Closed
                <span className="ml-2 text-sm font-normal text-foreground-muted">({closed.length})</span>
              </h2>
              <CandidateTable candidates={closed} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
