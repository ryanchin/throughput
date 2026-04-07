'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  STAGES,
  OPEN_STAGES,
  CLOSED_STAGES,
  STAGE_LABELS,
  STAGE_PROBABILITIES,
  type Stage,
} from '@/lib/crm/constants'
import { formatCurrency, getVelocityColor, velocityClasses } from '@/lib/crm/format'
import type { Opportunity } from '@/lib/crm/types'
import { CloseReasonModal } from './CloseReasonModal'
import { OpportunityForm } from './OpportunityForm'

interface OpportunityWithMeta extends Opportunity {
  last_activity_date?: string | null
}

export function OpportunityKanban() {
  const [opportunities, setOpportunities] = useState<OpportunityWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')

  // New deal form
  const [showNewDeal, setShowNewDeal] = useState(false)

  // Close reason modal
  const [closeModal, setCloseModal] = useState<{
    opportunityId: string
    stage: 'closed_won' | 'closed_lost'
  } | null>(null)

  // Stage change dropdown
  const [changingStage, setChangingStage] = useState<string | null>(null)

  const fetchOpportunities = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/crm/opportunities')
      if (!res.ok) throw new Error('Failed to load pipeline')
      const data = await res.json()
      setOpportunities(data.opportunities ?? data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pipeline')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOpportunities()
  }, [fetchOpportunities])

  async function handleStageChange(opportunityId: string, newStage: Stage) {
    // If closing, show reason modal
    if (newStage === 'closed_won' || newStage === 'closed_lost') {
      setCloseModal({ opportunityId, stage: newStage })
      return
    }

    await updateStage(opportunityId, newStage, null)
  }

  async function updateStage(opportunityId: string, stage: Stage, closeReason: string | null) {
    try {
      const res = await fetch(`/api/admin/crm/opportunities/${opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, close_reason: closeReason }),
      })
      if (!res.ok) throw new Error('Failed to update stage')

      // Update local state
      setOpportunities((prev) =>
        prev.map((opp) =>
          opp.id === opportunityId ? { ...opp, stage, close_reason: closeReason } : opp
        )
      )
    } catch {
      // Refresh on error to reset state
      fetchOpportunities()
    }
    setChangingStage(null)
  }

  function handleCloseConfirm(reason: string) {
    if (!closeModal) return
    updateStage(closeModal.opportunityId, closeModal.stage, reason)
    setCloseModal(null)
  }

  function getOpportunitiesByStage(stage: Stage): OpportunityWithMeta[] {
    return opportunities.filter((o) => o.stage === stage)
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-foreground-muted" data-testid="pipeline-error">
        {error}
      </div>
    )
  }

  return (
    <div data-testid="opportunity-kanban">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('kanban')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'kanban'
                ? 'bg-accent text-background'
                : 'bg-muted border border-border text-foreground hover:bg-raised'
            }`}
            data-testid="view-kanban"
          >
            Kanban
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-accent text-background'
                : 'bg-muted border border-border text-foreground hover:bg-raised'
            }`}
            data-testid="view-list"
          >
            List
          </button>
        </div>
        <button
          onClick={() => setShowNewDeal(true)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
          data-testid="new-deal-button"
        >
          New Deal
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {STAGES.map((stage) => (
            <div key={stage} className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <div className="h-4 w-24 animate-pulse rounded bg-muted mb-4" />
              <div className="space-y-3">
                <div className="h-20 animate-pulse rounded bg-muted" />
                <div className="h-20 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Kanban View */}
      {!loading && viewMode === 'kanban' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6 overflow-x-auto" data-testid="kanban-board">
          {STAGES.map((stage) => {
            const stageOpps = getOpportunitiesByStage(stage)
            const stageValue = stageOpps.reduce((sum, o) => sum + o.value, 0)

            return (
              <div
                key={stage}
                className="min-w-[220px] rounded-xl border border-border bg-surface p-3 shadow-card"
                data-testid={`kanban-column-${stage}`}
              >
                {/* Column header */}
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                      {STAGE_LABELS[stage]}
                    </h3>
                    <p className="mt-0.5 text-xs text-foreground-muted">
                      {stageOpps.length} deals
                      {stageValue > 0 ? ` | ${formatCurrency(stageValue)}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-foreground-muted">
                    {STAGE_PROBABILITIES[stage]}%
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {stageOpps.length === 0 && (
                    <p className="py-4 text-center text-xs text-foreground-muted">No deals</p>
                  )}
                  {stageOpps.map((opp) => (
                    <OpportunityCard
                      key={opp.id}
                      opportunity={opp}
                      onStageChange={handleStageChange}
                      changingStage={changingStage}
                      onToggleStageDropdown={setChangingStage}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* List View */}
      {!loading && viewMode === 'list' && (
        <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden" data-testid="pipeline-list">
          {opportunities.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-foreground-muted">No deals in pipeline yet.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Deal</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Company</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Stage</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground-muted">Value</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-foreground-muted">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {opportunities.map((opp) => (
                  <tr key={opp.id} className="transition-colors hover:bg-raised">
                    <td className="px-5 py-4 text-sm font-medium text-foreground">{opp.title}</td>
                    <td className="px-5 py-4 text-sm text-foreground-muted">
                      {opp.company ? (
                        <Link href={`/admin/crm/companies/${opp.company.id}`} className="hover:text-accent transition-colors">
                          {opp.company.name}
                        </Link>
                      ) : '--'}
                    </td>
                    <td className="px-5 py-4">
                      <StageBadge stage={opp.stage} />
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-foreground">
                      {formatCurrency(opp.value)}
                    </td>
                    <td className="px-5 py-4 text-center text-sm text-foreground-muted">
                      {opp.ai_score != null ? `${opp.ai_score}%` : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* New Deal Modal */}
      <OpportunityForm
        open={showNewDeal}
        onOpenChange={setShowNewDeal}
        onSaved={() => {
          setShowNewDeal(false)
          fetchOpportunities()
        }}
      />

      {/* Close Reason Modal */}
      {closeModal && (
        <CloseReasonModal
          stage={closeModal.stage}
          open={true}
          onOpenChange={() => setCloseModal(null)}
          onConfirm={handleCloseConfirm}
        />
      )}
    </div>
  )
}

function OpportunityCard({
  opportunity,
  onStageChange,
  changingStage,
  onToggleStageDropdown,
}: {
  opportunity: OpportunityWithMeta
  onStageChange: (id: string, stage: Stage) => void
  changingStage: string | null
  onToggleStageDropdown: (id: string | null) => void
}) {
  const velocityColor = getVelocityColor(opportunity.last_activity_date ?? opportunity.updated_at)

  return (
    <div
      className="rounded-lg border border-border bg-raised p-3 transition-colors hover:border-accent/30"
      data-testid={`opp-card-${opportunity.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{opportunity.title}</p>
          {opportunity.company && (
            <Link
              href={`/admin/crm/companies/${opportunity.company.id}`}
              className="text-xs text-foreground-muted hover:text-accent transition-colors"
            >
              {opportunity.company.name}
            </Link>
          )}
        </div>
        <div className={`mt-1 size-2 shrink-0 rounded-full ${velocityClasses[velocityColor]}`} title={`Velocity: ${velocityColor}`} />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {formatCurrency(opportunity.value)}
        </span>
        {opportunity.ai_score != null && (
          <span className="text-xs text-foreground-muted">{opportunity.ai_score}%</span>
        )}
      </div>

      {/* Stage change dropdown */}
      <div className="mt-2 relative">
        <button
          onClick={() =>
            onToggleStageDropdown(changingStage === opportunity.id ? null : opportunity.id)
          }
          className="w-full rounded border border-border bg-muted px-2 py-1 text-xs text-foreground-muted hover:bg-raised transition-colors text-left"
          data-testid={`opp-stage-trigger-${opportunity.id}`}
        >
          Move to...
        </button>
        {changingStage === opportunity.id && (
          <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-lg border border-border bg-raised shadow-lg">
            {STAGES.filter((s) => s !== opportunity.stage).map((s) => (
              <button
                key={s}
                onClick={() => onStageChange(opportunity.id, s)}
                className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg"
                data-testid={`stage-option-${s}`}
              >
                {STAGE_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StageBadge({ stage }: { stage: Stage }) {
  const styles: Record<Stage, string> = {
    lead: 'bg-accent-muted text-accent',
    qualified: 'bg-[var(--secondary-muted)] text-[var(--secondary)]',
    proposal: 'bg-[var(--warning-muted)] text-[var(--warning)]',
    negotiation: 'bg-gold-muted text-gold',
    closed_won: 'bg-[var(--success-muted)] text-[var(--success)]',
    closed_lost: 'bg-[var(--destructive-muted)] text-[var(--destructive)]',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[stage]}`}>
      {STAGE_LABELS[stage]}
    </span>
  )
}
