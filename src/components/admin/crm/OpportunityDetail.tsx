'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  STAGE_LABELS,
  STAGE_PROBABILITIES,
  type Stage,
} from '@/lib/crm/constants'
import { formatCurrency, formatRelativeDate, formatShortDate } from '@/lib/crm/format'
import type { Opportunity } from '@/lib/crm/types'
import { OpportunityForm } from './OpportunityForm'

interface OpportunityDetailProps {
  opportunity: Opportunity
  userRole: string
}

function StageBadge({ stage }: { stage: Stage }) {
  const styles: Record<Stage, string> = {
    '1. Inquiry': 'bg-accent-muted text-accent',
    '2. Investigation & Analysis': 'bg-accent-muted text-accent',
    '3. Qualification': 'bg-[var(--secondary-muted)] text-[var(--secondary)]',
    '4. Proposal Creation': 'bg-[var(--warning-muted)] text-[var(--warning)]',
    '5. Proposal Presentation': 'bg-[var(--warning-muted)] text-[var(--warning)]',
    '6. Negotiation/ Review': 'bg-gold-muted text-gold',
    '7a. Closed Won': 'bg-[var(--success-muted)] text-[var(--success)]',
    '7b. Closed Lost': 'bg-[var(--destructive-muted)] text-[var(--destructive)]',
    '7c. Shelf': 'bg-[var(--foreground-muted)]/10 text-[var(--foreground-muted)]',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[stage]}`}>
      {STAGE_LABELS[stage]}
    </span>
  )
}

export function OpportunityDetail({ opportunity, userRole }: OpportunityDetailProps) {
  const router = useRouter()
  const [showEditForm, setShowEditForm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete "${opportunity.title}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/crm/opportunities/${opportunity.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.push('/admin/crm')
      router.refresh()
    } catch {
      alert('Failed to delete opportunity')
    } finally {
      setDeleting(false)
    }
  }

  const probability = opportunity.probability ?? STAGE_PROBABILITIES[opportunity.stage]
  const weightedValue = opportunity.value * (probability ?? 0)

  return (
    <div data-testid="opportunity-detail">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">{opportunity.title}</h1>
            <StageBadge stage={opportunity.stage} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-foreground-muted">
            {opportunity.company && (
              <Link
                href={`/admin/crm/companies/${opportunity.company.id}`}
                className="text-accent hover:text-accent-hover transition-colors"
              >
                {opportunity.company.name}
              </Link>
            )}
            <span>{formatCurrency(opportunity.value)}</span>
            {opportunity.expected_close_date && (
              <span>Expected close: {formatShortDate(opportunity.expected_close_date)}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowEditForm(true)}
            className="rounded-lg bg-muted border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-raised transition-colors"
            data-testid="edit-opportunity-button"
          >
            Edit
          </button>
          {userRole === 'admin' && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-[var(--destructive-muted)] border border-[var(--destructive)] px-4 py-2 text-sm font-medium text-[var(--destructive)] hover:bg-[var(--destructive)]/20 transition-colors disabled:opacity-50"
              data-testid="delete-opportunity-button"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      {/* Detail Cards */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Deal Info */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted mb-4">
            Deal Info
          </h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-foreground-muted">Stage</dt>
              <dd><StageBadge stage={opportunity.stage} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-foreground-muted">Value</dt>
              <dd className="text-sm font-semibold text-foreground">{formatCurrency(opportunity.value)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-foreground-muted">Probability</dt>
              <dd className="text-sm text-foreground">
                {probability != null ? `${Math.round(probability * 100)}%` : '--'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-foreground-muted">Weighted Value</dt>
              <dd className="text-sm text-foreground">{formatCurrency(weightedValue)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-foreground-muted">Company</dt>
              <dd className="text-sm">
                {opportunity.company ? (
                  <Link
                    href={`/admin/crm/companies/${opportunity.company.id}`}
                    className="text-accent hover:text-accent-hover transition-colors"
                  >
                    {opportunity.company.name}
                  </Link>
                ) : (
                  <span className="text-foreground-muted">--</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-foreground-muted">Expected Close</dt>
              <dd className="text-sm text-foreground">
                {opportunity.expected_close_date ? formatShortDate(opportunity.expected_close_date) : '--'}
              </dd>
            </div>
            {opportunity.close_reason && (
              <div className="flex justify-between">
                <dt className="text-sm text-foreground-muted">Close Reason</dt>
                <dd className="text-sm text-foreground capitalize">{opportunity.close_reason}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* AI & Scoring */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted mb-4">
            AI Score & Details
          </h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-foreground-muted">AI Score</dt>
              <dd className="text-sm text-foreground">
                {opportunity.ai_score != null ? (
                  <span className={
                    opportunity.ai_score >= 70
                      ? 'text-[var(--success)]'
                      : opportunity.ai_score >= 40
                        ? 'text-[var(--warning)]'
                        : 'text-[var(--destructive)]'
                  }>
                    {opportunity.ai_score}%
                  </span>
                ) : '--'}
              </dd>
            </div>
            {opportunity.ai_score_explanation && (
              <div>
                <dt className="text-sm text-foreground-muted mb-1">AI Explanation</dt>
                <dd className="text-sm text-foreground whitespace-pre-wrap">
                  {opportunity.ai_score_explanation}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-sm text-foreground-muted">Created</dt>
              <dd className="text-sm text-foreground">{formatShortDate(opportunity.created_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-foreground-muted">Last Updated</dt>
              <dd className="text-sm text-foreground">{formatRelativeDate(opportunity.updated_at)}</dd>
            </div>
          </dl>
        </div>

        {/* Notes */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card lg:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted mb-4">
            Notes
          </h3>
          {opportunity.notes ? (
            <p className="text-sm text-foreground whitespace-pre-wrap">{opportunity.notes}</p>
          ) : (
            <p className="text-sm text-foreground-muted">No notes yet.</p>
          )}
        </div>
      </div>

      {/* Back link */}
      <div className="mt-8">
        <Link
          href="/admin/crm"
          className="text-sm text-foreground-muted hover:text-accent transition-colors"
        >
          &larr; Back to Pipeline
        </Link>
      </div>

      {/* Edit Modal */}
      <OpportunityForm
        opportunity={opportunity}
        open={showEditForm}
        onOpenChange={setShowEditForm}
        onSaved={() => {
          setShowEditForm(false)
          router.refresh()
        }}
      />
    </div>
  )
}
