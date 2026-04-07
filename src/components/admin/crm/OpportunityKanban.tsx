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
import { CreateRolesModal } from './CreateRolesModal'

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
    stage: '7a. Closed Won' | '7b. Closed Lost'
  } | null>(null)

  // Stage change dropdown
  const [changingStage, setChangingStage] = useState<string | null>(null)

  // Create roles modal — shown after Closed Won
  const [createRolesFor, setCreateRolesFor] = useState<{
    dealId: string
    dealTitle: string
    accountId: string | null
    accountName: string | null
  } | null>(null)

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
    if (newStage === '7a. Closed Won' || newStage === '7b. Closed Lost') {
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

      // If Closed Won, prompt to create roles for the Resources team
      if (stage === '7a. Closed Won') {
        const opp = opportunities.find((o) => o.id === opportunityId)
        if (opp) {
          setCreateRolesFor({
            dealId: opportunityId,
            dealTitle: opp.title,
            accountId: opp.company?.id ?? null,
            accountName: opp.company?.name ?? null,
          })
        }
      }
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
        <div className="overflow-x-auto pb-4 -mx-4 px-4">
          <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
            {OPEN_STAGES.map((stage) => (
              <div key={stage} className="w-[280px] shrink-0 rounded-xl border border-border bg-surface p-4 shadow-card">
                <div className="h-4 w-24 animate-pulse rounded bg-muted mb-4" />
                <div className="space-y-3">
                  <div className="h-24 animate-pulse rounded bg-muted" />
                  <div className="h-24 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kanban View */}
      {!loading && viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-4 -mx-4 px-4">
          <div className="flex gap-4" style={{ minWidth: 'max-content' }} data-testid="kanban-board">
            {STAGES.map((stage) => {
              const stageOpps = getOpportunitiesByStage(stage)
              const stageValue = stageOpps.reduce((sum, o) => sum + o.value, 0)

              return (
                <div
                  key={stage}
                  className="w-[280px] shrink-0 rounded-xl border border-border bg-surface p-3 shadow-card"
                  data-testid={`kanban-column-${stage}`}
                >
                  {/* Column header */}
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                        {STAGE_LABELS[stage]}
                      </h3>
                      <p className="mt-0.5 text-xs text-foreground-muted">
                        {stageOpps.length} deal{stageOpps.length !== 1 ? 's' : ''}
                        {stageValue > 0 ? ` · ${formatCurrency(stageValue)}` : ''}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground-muted">
                      {Math.round(STAGE_PROBABILITIES[stage] * 100)}%
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
                    <td className="px-5 py-4 text-sm font-medium text-foreground">
                      <Link
                        href={`/admin/crm/opportunities/${opp.id}`}
                        className="hover:text-accent transition-colors"
                      >
                        {opp.title}
                      </Link>
                    </td>
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

      {/* Create Roles Modal — shown after Closed Won */}
      {createRolesFor && (
        <CreateRolesModal
          open={true}
          onOpenChange={() => setCreateRolesFor(null)}
          dealTitle={createRolesFor.dealTitle}
          dealId={createRolesFor.dealId}
          accountId={createRolesFor.accountId}
          accountName={createRolesFor.accountName}
          onCreated={(count) => {
            setCreateRolesFor(null)
            // Could show a toast here — for now the roles appear in Resources
            console.log(`Created ${count} role(s) for deal`)
          }}
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
      {/* Company name — top line */}
      <div className="flex items-center justify-between gap-2">
        {opportunity.company ? (
          <Link
            href={`/admin/crm/companies/${opportunity.company.id}`}
            className="text-xs font-medium text-accent hover:text-accent-hover transition-colors truncate"
          >
            {opportunity.company.name}
          </Link>
        ) : (
          <span className="text-xs text-foreground-muted">No company</span>
        )}
        <div className={`size-2 shrink-0 rounded-full ${velocityClasses[velocityColor]}`} title={`Velocity: ${velocityColor}`} />
      </div>

      {/* Deal title */}
      <Link
        href={`/admin/crm/opportunities/${opportunity.id}`}
        className="mt-1 block text-sm font-medium text-foreground hover:text-accent transition-colors"
      >
        {opportunity.title}
      </Link>

      {/* Value */}
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {formatCurrency(opportunity.value)}
        </span>
        {opportunity.ai_score != null && (
          <span className="text-xs text-foreground-muted">Score: {opportunity.ai_score}%</span>
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
          <div className="absolute left-0 top-full z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-raised shadow-lg">
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
