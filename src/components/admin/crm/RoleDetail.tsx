'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatShortDate } from '@/lib/crm/format'
import type { RoleStatus, CandidateStatus } from '@/lib/crm/constants'

interface RoleData {
  id: string
  name: string
  function: string | null
  status: string
  priority: number | null
  target_fill_date: string | null
  role_stage: string | null
  blocker: string | null
  description: string | null
  notes: string | null
  account: { id: string; name: string } | null
  deal: { id: string; title: string } | null
}

interface Candidate {
  id: string
  first_name: string
  last_name: string
  function: string
  seniority: string | null
  skills: string[]
  status: CandidateStatus
  source: string | null
  date_added: string
  promoted_to_consultant_id: string | null
}

interface BenchConsultant {
  id: string
  function: string
  seniority: string | null
  skills: string[]
  user: { id: string; full_name: string }
}

interface UnassignedCandidate {
  id: string
  first_name: string
  last_name: string
  function: string
  status: CandidateStatus
}

function RoleStatusBadge({ status }: { status: string }) {
  const styles: Record<RoleStatus, string> = {
    Open: 'bg-accent-muted text-accent',
    Filled: 'bg-[var(--success-muted)] text-[var(--success)]',
    'Filled- External': 'bg-[var(--success-muted)] text-[var(--success)]',
    Fulfilled: 'bg-[var(--success-muted)] text-[var(--success)]',
    Cancelled: 'bg-[var(--destructive-muted)] text-[var(--destructive)]',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status as RoleStatus] ?? 'bg-muted text-foreground-muted'}`}>
      {status}
    </span>
  )
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

export function RoleDetail({
  role,
  candidates,
  matchingBench,
}: {
  role: RoleData
  candidates: Candidate[]
  matchingBench: BenchConsultant[]
}) {
  const router = useRouter()
  const [staffingId, setStaffingId] = useState<string | null>(null)
  const [assignCandidateId, setAssignCandidateId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [unassignedCandidates, setUnassignedCandidates] = useState<UnassignedCandidate[]>([])

  // Fetch candidates not already assigned to this role
  const fetchUnassigned = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/crm/candidates?limit=200')
      if (!res.ok) return
      const data = await res.json()
      const allCandidates = data.candidates ?? []
      const assignedIds = new Set(candidates.map((c) => c.id))
      const filtered = allCandidates.filter(
        (c: UnassignedCandidate) => !assignedIds.has(c.id) && !['Rejected', 'Withdrawn'].includes(c.status)
      )
      setUnassignedCandidates(filtered)
    } catch {
      // ignore
    }
  }, [candidates])

  useEffect(() => {
    fetchUnassigned()
  }, [fetchUnassigned])

  const handleStaff = async (candidateId: string) => {
    setStaffingId(candidateId)
    try {
      const res = await fetch(`/api/admin/crm/roles/${role.id}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_id: candidateId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to staff role')
      }
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to staff role')
    } finally {
      setStaffingId(null)
    }
  }

  const handleAssign = async () => {
    if (!assignCandidateId) return
    setAssigning(true)
    try {
      const res = await fetch(`/api/admin/crm/roles/${role.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_id: assignCandidateId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to assign candidate')
      }
      setAssignCandidateId('')
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to assign candidate')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{role.name}</h1>
            <p className="mt-1 text-sm text-foreground-muted">
              {role.function ?? 'No function'}
              {role.account ? ` \u00B7 ${role.account.name}` : ''}
            </p>
          </div>
          <RoleStatusBadge status={role.status} />
        </div>
      </div>

      {/* Role Info */}
      <div className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-card">
        <h2 className="text-lg font-semibold text-foreground mb-4">Role Info</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Account</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {role.account ? (
                <Link
                  href={`/admin/crm/companies/${role.account.id}`}
                  className="hover:text-accent transition-colors"
                >
                  {role.account.name}
                </Link>
              ) : (
                '--'
              )}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Deal</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {role.deal ? (
                <Link
                  href={`/admin/crm/opportunities/${role.deal.id}`}
                  className="hover:text-accent transition-colors"
                >
                  {role.deal.title}
                </Link>
              ) : (
                '--'
              )}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Function</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {role.function ?? '--'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Status</p>
            <p className="mt-1">
              <RoleStatusBadge status={role.status} />
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Priority</p>
            <p className="mt-1">
              {role.priority != null ? (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  role.priority === 1
                    ? 'bg-[var(--destructive-muted)] text-[var(--destructive)]'
                    : 'bg-[var(--warning-muted)] text-[var(--warning)]'
                }`}>
                  P{role.priority}
                </span>
              ) : (
                <span className="text-sm font-medium text-foreground">--</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Target Fill Date</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {role.target_fill_date ? formatShortDate(role.target_fill_date) : '--'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Role Stage</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {role.role_stage ?? '--'}
            </p>
          </div>
          {role.blocker && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Blocker</p>
              <p className="mt-1 text-sm font-medium text-[var(--destructive)]">
                {role.blocker}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {role.description && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-2">Description</h2>
          <p className="text-sm text-foreground-muted whitespace-pre-wrap">{role.description}</p>
        </div>
      )}

      {/* Candidates for this Role */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Candidates for this Role
          <span className="ml-2 text-sm font-normal text-foreground-muted">({candidates.length})</span>
        </h2>
        {candidates.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center shadow-card">
            <p className="text-sm text-foreground-muted">No candidates assigned to this role yet.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Function</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Seniority</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Skills</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Source</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Date Added</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Actions</th>
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
                      {c.seniority ?? '--'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {c.skills.length > 0 ? c.skills.map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center rounded-full bg-accent-muted px-2 py-0.5 text-xs text-accent"
                          >
                            {skill}
                          </span>
                        )) : (
                          <span className="text-sm text-foreground-muted">--</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <CandidateStatusBadge status={c.status} />
                    </td>
                    <td className="px-5 py-4 text-sm text-foreground-muted">
                      {c.source ?? '--'}
                    </td>
                    <td className="px-5 py-4 text-sm text-foreground-muted">
                      {c.date_added ? formatShortDate(c.date_added) : '--'}
                    </td>
                    <td className="px-5 py-4">
                      {c.status === 'Hired' && !c.promoted_to_consultant_id && (
                        <button
                          onClick={() => handleStaff(c.id)}
                          disabled={staffingId === c.id}
                          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-background hover:bg-accent-hover transition-colors disabled:opacity-50"
                        >
                          {staffingId === c.id ? 'Staffing...' : 'Staff This Role'}
                        </button>
                      )}
                      {c.status === 'Hired' && c.promoted_to_consultant_id && (
                        <span className="text-xs text-foreground-muted">Promoted</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Candidate */}
      {role.status === 'Open' && unassignedCandidates.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Assign Candidate to Role</h2>
          <div className="flex items-center gap-3">
            <select
              value={assignCandidateId}
              onChange={(e) => setAssignCandidateId(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Select a candidate...</option>
              {unassignedCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} ({c.function} - {c.status})
                </option>
              ))}
            </select>
            <button
              onClick={handleAssign}
              disabled={!assignCandidateId || assigning}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {assigning ? 'Assigning...' : 'Assign to Role'}
            </button>
          </div>
        </div>
      )}

      {/* Matching Bench Consultants */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Matching Bench Consultants
          <span className="ml-2 text-sm font-normal text-foreground-muted">({matchingBench.length})</span>
        </h2>
        {matchingBench.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center shadow-card">
            <p className="text-sm text-foreground-muted">
              {role.function
                ? `No bench consultants matching ${role.function} function.`
                : 'Set a function on this role to see matching bench consultants.'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Seniority</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Skills</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {matchingBench.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-raised">
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/crm/resources/${c.id}`}
                        className="text-sm font-medium text-foreground hover:text-accent transition-colors"
                      >
                        {c.user.full_name}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-sm text-foreground-muted">
                      {c.seniority ?? '--'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {c.skills.length > 0 ? c.skills.map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center rounded-full bg-accent-muted px-2 py-0.5 text-xs text-accent"
                          >
                            {skill}
                          </span>
                        )) : (
                          <span className="text-sm text-foreground-muted">--</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notes */}
      {role.notes && (
        <div className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-2">Notes</h2>
          <p className="text-sm text-foreground-muted whitespace-pre-wrap">{role.notes}</p>
        </div>
      )}
    </div>
  )
}
