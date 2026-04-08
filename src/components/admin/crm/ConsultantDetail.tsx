'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatShortDate, formatCurrency } from '@/lib/crm/format'
import type { ConsultantStatus, AssignmentStatus } from '@/lib/crm/constants'
import { TaskForm } from './TaskForm'

interface Assignment {
  id: string
  account: { id: string; name: string } | null
  deal: { id: string; title: string } | null
  start_date: string | null
  expected_end_date: string | null
  actual_end_date: string | null
  bill_rate: number | null
  status: AssignmentStatus
  end_reason: string | null
}

interface ConsultantData {
  id: string
  function: string
  seniority: string | null
  skills: string[]
  status: ConsultantStatus
  start_date: string | null
  expected_end_date: string | null
  location: string | null
  notes: string | null
  hire_date: string | null
  promoted_from_candidate_id?: string | null
  user: { id: string; full_name: string; email: string }
  account: { id: string; name: string } | null
  current_assignment: Assignment | null
  assignments: Assignment[]
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

function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  const styles: Record<AssignmentStatus, string> = {
    Active: 'bg-[var(--success-muted)] text-[var(--success)]',
    Planned: 'bg-accent-muted text-accent',
    Completed: 'bg-muted text-foreground-muted',
    Cancelled: 'bg-[var(--destructive-muted)] text-[var(--destructive)]',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}

function computeDuration(startDate: string | null, endDate: string | null): string {
  if (!startDate) return '--'
  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : new Date()
  const diffMs = end.getTime() - start.getTime()
  const diffMonths = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44))
  if (diffMonths < 1) return '< 1mo'
  return `${diffMonths}mo`
}

export function ConsultantDetail({ consultant }: { consultant: ConsultantData }) {
  const c = consultant
  const [showTaskForm, setShowTaskForm] = useState(false)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{c.user.full_name}</h1>
            <p className="mt-1 text-sm text-foreground-muted">
              {c.function}
              {c.seniority ? ` · ${c.seniority}` : ''}
              {c.location ? ` · ${c.location}` : ''}
            </p>
          </div>
          <ConsultantStatusBadge status={c.status} />
        </div>
        <button
          onClick={() => setShowTaskForm(true)}
          className="rounded-lg bg-muted border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-raised transition-colors"
          data-testid="add-followup-button"
        >
          <span className="flex items-center gap-1">
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Follow-up
          </span>
        </button>
      </div>

      {/* Promoted from candidate banner */}
      {c.promoted_from_candidate_id && (
        <div className="mt-4 rounded-lg border border-accent-muted bg-accent-muted/50 px-4 py-2 text-sm text-accent">
          Promoted from candidate pipeline
        </div>
      )}

      {/* Skills */}
      {c.skills && c.skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1">
          {c.skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center rounded-full bg-accent-muted px-2 py-0.5 text-xs text-accent"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Current Placement */}
      {c.status === 'Active - Placed' && c.current_assignment && (
        <div className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Current Placement</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Account</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {c.current_assignment.account ? (
                  <Link
                    href={`/admin/crm/companies/${c.current_assignment.account.id}`}
                    className="hover:text-accent transition-colors"
                  >
                    {c.current_assignment.account.name}
                  </Link>
                ) : (
                  '--'
                )}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Deal</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {c.current_assignment.deal?.title ?? '--'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Start Date</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {c.current_assignment.start_date ? formatShortDate(c.current_assignment.start_date) : '--'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Expected End</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {c.current_assignment.expected_end_date ? formatShortDate(c.current_assignment.expected_end_date) : '--'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Bill Rate</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {c.current_assignment.bill_rate != null ? formatCurrency(c.current_assignment.bill_rate) : '--'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Assignment History */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Assignment History</h2>
        {c.assignments.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center shadow-card">
            <p className="text-sm text-foreground-muted">No assignment history.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Account</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Deal</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Start Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">End Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Duration</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Bill Rate</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">End Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {c.assignments.map((a) => {
                  const endDate = a.actual_end_date ?? a.expected_end_date
                  return (
                    <tr key={a.id} className="transition-colors hover:bg-raised">
                      <td className="px-5 py-4 text-sm text-foreground">
                        {a.account ? (
                          <Link
                            href={`/admin/crm/companies/${a.account.id}`}
                            className="text-sm font-medium text-foreground hover:text-accent transition-colors"
                          >
                            {a.account.name}
                          </Link>
                        ) : (
                          '--'
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground-muted">
                        {a.deal?.title ?? '--'}
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground-muted">
                        {a.start_date ? formatShortDate(a.start_date) : '--'}
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground-muted">
                        {endDate ? formatShortDate(endDate) : '--'}
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground-muted">
                        {computeDuration(a.start_date, endDate)}
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground-muted">
                        {a.bill_rate != null ? formatCurrency(a.bill_rate) : '--'}
                      </td>
                      <td className="px-5 py-4">
                        <AssignmentStatusBadge status={a.status} />
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground-muted">
                        {a.end_reason ?? '--'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notes */}
      {c.notes && (
        <div className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-2">Notes</h2>
          <p className="text-sm text-foreground-muted whitespace-pre-wrap">{c.notes}</p>
        </div>
      )}

      {/* Task Follow-up Form */}
      <TaskForm
        defaultCompanyId={c.account?.id}
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        onSaved={() => setShowTaskForm(false)}
      />
    </div>
  )
}
