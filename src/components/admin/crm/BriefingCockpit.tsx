'use client'

import { useState, useEffect, useCallback } from 'react'
import { OPEN_STAGES, STAGE_LABELS, type Stage } from '@/lib/crm/constants'
import { formatCurrency, formatShortDate } from '@/lib/crm/format'
import { TaskForm } from './TaskForm'

// ============================================================
// Types
// ============================================================

interface BriefingData {
  pipeline: PipelineDeal[]
  roles: BriefingRole[]
  bench: BenchConsultant[]
  rolloffs: RolloffAssignment[]
  candidates: BriefingCandidate[]
  summary: SummaryStats
}

interface PipelineDeal {
  id: string
  title: string
  company_id: string
  stage: string
  value: number | null
  probability: number | null
  expected_close_date: string | null
  company: { id: string; name: string } | null
  days_since_activity: number
  is_stale: boolean
}

interface BriefingRole {
  id: string
  name: string
  function: string | null
  account: { id: string; name: string } | null
  candidate_count: number
  days_open: number
}

interface BenchConsultant {
  id: string
  function: string | null
  seniority: string | null
  skills: string[]
  user: { id: string; full_name: string } | null
  days_on_bench: number | null
  last_account: string | null
}

interface RolloffAssignment {
  id: string
  expected_end_date: string
  consultant: { user: { full_name: string }; function: string | null; seniority: string | null }
  account: { id: string; name: string }
  days_until_rolloff: number
}

interface BriefingCandidate {
  id: string
  first_name: string
  last_name: string
  function: string | null
  status: string
  target_account: { id: string; name: string } | null
  days_in_pipeline: number | null
}

interface SummaryStats {
  total_active_consultants: number
  total_placed: number
  total_bench: number
  rolling_off_30d: number
  rolling_off_60d: number
  total_pipeline_value: number
  open_roles: number
  active_candidates: number
}

interface AIHealth {
  assessment: string | null
  risk: 'low' | 'medium' | 'high' | null
  loading: boolean
}

interface CandidateOption {
  id: string
  first_name: string
  last_name: string
  function: string | null
  status: string
}

// ============================================================
// Sub-components
// ============================================================

function SummaryCards({ summary }: { summary: SummaryStats }) {
  const cards = [
    { label: 'Pipeline Value', value: formatCurrency(summary.total_pipeline_value) },
    { label: 'Active Consultants', value: String(summary.total_active_consultants) },
    { label: 'Placed', value: String(summary.total_placed) },
    { label: 'On Bench', value: String(summary.total_bench) },
    { label: 'Rolling Off (30d)', value: String(summary.rolling_off_30d), highlight: summary.rolling_off_30d > 0 },
    { label: 'Open Roles', value: String(summary.open_roles) },
    { label: 'Active Candidates', value: String(summary.active_candidates) },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7 mb-8 print:grid-cols-7" data-testid="summary-cards">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border bg-surface p-4 shadow-card ${
            card.highlight ? 'border-[var(--warning)]' : 'border-border'
          }`}
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-foreground-muted">{card.label}</p>
          <p className="mt-1 text-xl font-bold text-foreground">{card.value}</p>
        </div>
      ))}
    </div>
  )
}

function RiskBadge({ risk }: { risk: string | null }) {
  if (!risk) return null
  const styles: Record<string, string> = {
    low: 'bg-[var(--success-muted)] text-[var(--success)]',
    medium: 'bg-[var(--warning-muted)] text-[var(--warning)]',
    high: 'bg-[var(--destructive-muted)] text-[var(--destructive)]',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles[risk] ?? 'bg-muted text-foreground-muted'}`}>
      {risk.toUpperCase()}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'Screening': 'bg-accent-muted text-accent',
    'Interviewing': 'bg-[var(--warning-muted)] text-[var(--warning)]',
    'Offer Extended': 'bg-[var(--success-muted)] text-[var(--success)]',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-muted text-foreground-muted'}`}>
      {status}
    </span>
  )
}

function ShimmerLine() {
  return <div className="h-4 w-32 animate-pulse rounded bg-muted" />
}

function SectionCard({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface shadow-card" data-testid={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {count !== undefined && (
          <span className="text-sm font-medium text-accent">{count}</span>
        )}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export function BriefingCockpit() {
  const [data, setData] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // AI health assessments (keyed by opportunity ID)
  const [aiHealth, setAiHealth] = useState<Record<string, AIHealth>>({})

  // Stage change tracking
  const [changingStage, setChangingStage] = useState<string | null>(null)

  // Candidate assign
  const [assigningRole, setAssigningRole] = useState<string | null>(null)
  const [candidateOptions, setCandidateOptions] = useState<CandidateOption[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)

  // Task form
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskContext, setTaskContext] = useState<{
    company_id?: string
    opportunity_id?: string
  }>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/crm/briefing/data')
      if (!res.ok) throw new Error('Failed to load briefing data')
      const result = await res.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Fetch AI health for stale deals after data loads
  useEffect(() => {
    if (!data) return
    const staleDeals = data.pipeline.filter((d) => d.is_stale)
    for (const deal of staleDeals) {
      if (aiHealth[deal.id]) continue
      setAiHealth((prev) => ({ ...prev, [deal.id]: { assessment: null, risk: null, loading: true } }))
      fetchAiHealth(deal.id)
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAiHealth(opportunityId: string) {
    try {
      const res = await fetch('/api/admin/crm/briefing/ai-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity_id: opportunityId }),
      })
      const result = await res.json()
      setAiHealth((prev) => ({
        ...prev,
        [opportunityId]: { assessment: result.assessment, risk: result.risk, loading: false },
      }))
    } catch {
      setAiHealth((prev) => ({
        ...prev,
        [opportunityId]: { assessment: null, risk: null, loading: false },
      }))
    }
  }

  async function handleStageChange(opportunityId: string, newStage: string) {
    setChangingStage(opportunityId)
    try {
      const res = await fetch(`/api/admin/crm/opportunities/${opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })
      if (res.ok) {
        fetchData()
      }
    } catch {
      // Silently fail — data will refresh
    } finally {
      setChangingStage(null)
    }
  }

  async function handleAssignOpen(roleId: string) {
    setAssigningRole(roleId)
    setLoadingCandidates(true)
    try {
      const res = await fetch('/api/admin/crm/candidates?status=Screening&limit=50')
      if (res.ok) {
        const result = await res.json()
        setCandidateOptions(result.candidates ?? [])
      }
    } catch {
      setCandidateOptions([])
    } finally {
      setLoadingCandidates(false)
    }
  }

  async function handleAssignCandidate(roleId: string, candidateId: string) {
    try {
      await fetch(`/api/admin/crm/roles/${roleId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_id: candidateId }),
      })
      setAssigningRole(null)
      fetchData()
    } catch {
      // Silently fail
    }
  }

  function openTaskForm(companyId?: string, opportunityId?: string) {
    setTaskContext({ company_id: companyId, opportunity_id: opportunityId })
    setShowTaskForm(true)
  }

  // ---- Render ----

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-foreground-muted" data-testid="briefing-error">
        {error}
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <div className="h-3 w-16 animate-pulse rounded bg-muted mb-2" />
              <div className="h-6 w-12 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-6 shadow-card">
            <div className="h-5 w-32 animate-pulse rounded bg-muted mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="briefing-cockpit">
      {/* Print-only header */}
      <div className="hidden print:block print:mb-6">
        <h1 className="text-2xl font-bold">Daily Briefing</h1>
        <p className="text-sm text-gray-500">Generated on {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <SummaryCards summary={data.summary} />

      {/* Section 1: Pipeline */}
      <SectionCard title="Pipeline" count={data.pipeline.length}>
        {data.pipeline.length === 0 ? (
          <div className="p-6 text-center text-sm text-foreground-muted">No open deals in pipeline.</div>
        ) : (
          <table className="w-full" data-testid="pipeline-table">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Deal</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Company</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted print:hidden">Stage</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted hidden print:table-cell">Stage</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground-muted">Value</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground-muted">Days Stale</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">AI Health</th>
                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-foreground-muted print:hidden"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.pipeline.map((deal) => {
                const health = aiHealth[deal.id]
                return (
                  <tr
                    key={deal.id}
                    className={`transition-colors hover:bg-raised ${deal.is_stale ? 'bg-[var(--destructive-muted)]/30' : ''}`}
                    data-testid={`pipeline-row-${deal.id}`}
                  >
                    <td className="px-5 py-3">
                      <span className="text-sm font-medium text-foreground">{deal.title}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground-muted">
                      {deal.company?.name ?? '--'}
                    </td>
                    {/* Interactive stage dropdown (hidden in print) */}
                    <td className="px-5 py-3 print:hidden">
                      <select
                        value={deal.stage}
                        onChange={(e) => handleStageChange(deal.id, e.target.value)}
                        disabled={changingStage === deal.id}
                        className="rounded border border-border bg-muted px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                        data-testid={`stage-select-${deal.id}`}
                      >
                        {OPEN_STAGES.map((s) => (
                          <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    {/* Print-only stage text */}
                    <td className="px-5 py-3 text-sm text-foreground-muted hidden print:table-cell">
                      {STAGE_LABELS[deal.stage as Stage] ?? deal.stage}
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-foreground">
                      {deal.value != null ? formatCurrency(Number(deal.value)) : '--'}
                    </td>
                    <td className="px-5 py-3 text-right text-sm">
                      <span className={deal.days_since_activity > 14 ? 'text-[var(--destructive)] font-semibold' : deal.days_since_activity > 7 ? 'text-[var(--warning)]' : 'text-foreground-muted'}>
                        {deal.days_since_activity}d
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {health?.loading ? (
                        <ShimmerLine />
                      ) : health?.assessment ? (
                        <div className="flex items-center gap-2">
                          <RiskBadge risk={health.risk} />
                          <span className="text-xs text-foreground-muted truncate max-w-[200px]" title={health.assessment}>
                            {health.assessment}
                          </span>
                        </div>
                      ) : deal.is_stale ? (
                        <span className="text-xs text-foreground-muted">--</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-center print:hidden">
                      <button
                        onClick={() => openTaskForm(deal.company_id, deal.id)}
                        className="rounded bg-muted border border-border px-2 py-1 text-xs text-foreground-muted hover:text-accent hover:border-accent transition-colors"
                        title="Create task"
                      >
                        +
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Section 2: Open Roles */}
      <SectionCard title="Roles to Fill" count={data.roles.length}>
        {data.roles.length === 0 ? (
          <div className="p-6 text-center text-sm text-foreground-muted">No open roles.</div>
        ) : (
          <table className="w-full" data-testid="roles-table">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Account</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Function</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground-muted">Days Open</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground-muted">Candidates</th>
                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-foreground-muted print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.roles.map((role) => (
                <tr key={role.id} className="transition-colors hover:bg-raised" data-testid={`role-row-${role.id}`}>
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{role.name}</td>
                  <td className="px-5 py-3 text-sm text-foreground-muted">{role.account?.name ?? '--'}</td>
                  <td className="px-5 py-3 text-sm text-foreground-muted">{role.function ?? '--'}</td>
                  <td className="px-5 py-3 text-right text-sm text-foreground-muted">{role.days_open}d</td>
                  <td className="px-5 py-3 text-right text-sm text-foreground-muted">{role.candidate_count}</td>
                  <td className="px-5 py-3 text-center print:hidden">
                    <div className="relative inline-block">
                      {assigningRole === role.id ? (
                        <div className="absolute right-0 top-0 z-10 w-56 rounded-lg border border-border bg-raised p-2 shadow-lg">
                          {loadingCandidates ? (
                            <div className="px-3 py-2 text-xs text-foreground-muted">Loading candidates...</div>
                          ) : candidateOptions.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-foreground-muted">No candidates available</div>
                          ) : (
                            <>
                              {candidateOptions.slice(0, 10).map((c) => (
                                <button
                                  key={c.id}
                                  onClick={() => handleAssignCandidate(role.id, c.id)}
                                  className="w-full rounded px-3 py-1.5 text-left text-xs text-foreground hover:bg-muted transition-colors"
                                >
                                  {c.first_name} {c.last_name}
                                  {c.function && <span className="text-foreground-muted ml-1">({c.function})</span>}
                                </button>
                              ))}
                            </>
                          )}
                          <button
                            onClick={() => setAssigningRole(null)}
                            className="mt-1 w-full rounded px-3 py-1.5 text-xs text-foreground-muted hover:bg-muted text-center"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAssignOpen(role.id)}
                          className="rounded bg-accent/10 border border-accent/30 px-3 py-1 text-xs font-medium text-accent hover:bg-accent/20 transition-colors"
                          data-testid={`assign-btn-${role.id}`}
                        >
                          Assign
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Section 3: Bench */}
      <SectionCard title="On Bench" count={data.bench.length}>
        {data.bench.length === 0 ? (
          <div className="p-6 text-center text-sm text-foreground-muted">No consultants on bench.</div>
        ) : (
          <table className="w-full" data-testid="bench-table">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Function</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Seniority</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Skills</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground-muted">Days on Bench</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Last Account</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.bench.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-raised" data-testid={`bench-row-${c.id}`}>
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{c.user?.full_name ?? '--'}</td>
                  <td className="px-5 py-3 text-sm text-foreground-muted">{c.function ?? '--'}</td>
                  <td className="px-5 py-3 text-sm text-foreground-muted">{c.seniority ?? '--'}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(c.skills ?? []).slice(0, 5).map((skill) => (
                        <span key={skill} className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-accent-muted text-accent">
                          {skill}
                        </span>
                      ))}
                      {(c.skills ?? []).length > 5 && (
                        <span className="text-[10px] text-foreground-muted">+{c.skills.length - 5}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-sm">
                    <span className={c.days_on_bench != null && c.days_on_bench > 30 ? 'text-[var(--warning)] font-semibold' : 'text-foreground-muted'}>
                      {c.days_on_bench != null ? `${c.days_on_bench}d` : '--'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-foreground-muted">{c.last_account ?? '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Section 4: Rolloffs */}
      <SectionCard title="Rolling Off" count={data.rolloffs.length}>
        {data.rolloffs.length === 0 ? (
          <div className="p-6 text-center text-sm text-foreground-muted">No upcoming rolloffs.</div>
        ) : (
          <table className="w-full" data-testid="rolloffs-table">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Consultant</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Account</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Expected End</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground-muted">Days Until</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.rolloffs.map((r) => (
                <tr
                  key={r.id}
                  className={`transition-colors hover:bg-raised ${r.days_until_rolloff <= 30 ? 'bg-[var(--warning-muted)]/30' : ''}`}
                  data-testid={`rolloff-row-${r.id}`}
                >
                  <td className="px-5 py-3 text-sm font-medium text-foreground">
                    {r.consultant?.user?.full_name ?? '--'}
                  </td>
                  <td className="px-5 py-3 text-sm text-foreground-muted">{r.account?.name ?? '--'}</td>
                  <td className="px-5 py-3 text-sm text-foreground-muted">{formatShortDate(r.expected_end_date)}</td>
                  <td className="px-5 py-3 text-right text-sm">
                    <span className={r.days_until_rolloff <= 14 ? 'text-[var(--destructive)] font-semibold' : r.days_until_rolloff <= 30 ? 'text-[var(--warning)] font-semibold' : 'text-foreground-muted'}>
                      {r.days_until_rolloff}d
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Section 5: Active Candidates */}
      <SectionCard title="Candidate Pipeline" count={data.candidates.length}>
        {data.candidates.length === 0 ? (
          <div className="p-6 text-center text-sm text-foreground-muted">No active candidates.</div>
        ) : (
          <table className="w-full" data-testid="candidates-table">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Function</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Target Account</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground-muted">Days in Pipeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.candidates.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-raised" data-testid={`candidate-row-${c.id}`}>
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{c.first_name} {c.last_name}</td>
                  <td className="px-5 py-3 text-sm text-foreground-muted">{c.function ?? '--'}</td>
                  <td className="px-5 py-3 text-sm text-foreground-muted">{c.target_account?.name ?? '--'}</td>
                  <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-3 text-right text-sm text-foreground-muted">
                    {c.days_in_pipeline != null ? `${c.days_in_pipeline}d` : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Task Form Dialog */}
      <TaskForm
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        defaultCompanyId={taskContext.company_id}
        defaultOpportunityId={taskContext.opportunity_id}
        onSaved={() => {
          setShowTaskForm(false)
          setTaskContext({})
        }}
      />

      {/* Print styles */}
      <style>{`
        @media print {
          /* Remove app shell */
          [data-sidebar], nav, header, footer,
          .print\\:hidden, [class*="print:hidden"] {
            display: none !important;
          }
          /* White background for ink */
          body, html {
            background: white !important;
            color: black !important;
          }
          [data-testid="briefing-cockpit"] {
            color: black !important;
          }
          [data-testid="briefing-cockpit"] * {
            border-color: #ddd !important;
            color: black !important;
            background: white !important;
          }
          [data-testid="briefing-cockpit"] table {
            font-size: 11px !important;
          }
          /* Keep badges visible */
          [data-testid="briefing-cockpit"] span[class*="rounded-full"] {
            border: 1px solid #999 !important;
            padding: 1px 6px !important;
          }
          /* Remove interactive elements */
          select, button {
            display: none !important;
          }
          /* Add page break hints */
          [data-testid^="section-"] {
            page-break-inside: avoid;
          }
          /* Print footer */
          [data-testid="briefing-cockpit"]::after {
            content: "Generated on ${new Date().toLocaleDateString('en-US')}";
            display: block;
            text-align: center;
            font-size: 10px;
            color: #999;
            margin-top: 24px;
            padding-top: 12px;
            border-top: 1px solid #ddd;
          }
        }
      `}</style>
    </div>
  )
}
