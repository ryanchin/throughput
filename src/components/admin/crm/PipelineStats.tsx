'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/crm/format'
import type { CrmStats } from '@/lib/crm/types'

export function PipelineStats() {
  const [stats, setStats] = useState<CrmStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/crm/stats')
        if (!res.ok) throw new Error('Failed to load stats')
        const data = await res.json()
        setStats(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const cards = [
    {
      label: 'Pipeline Value',
      value: stats ? formatCurrency(stats.pipeline_value) : '--',
      testId: 'stat-pipeline-value',
    },
    {
      label: 'Weighted Pipeline',
      value: stats ? formatCurrency(stats.weighted_pipeline) : '--',
      testId: 'stat-weighted-pipeline',
    },
    {
      label: 'Active Deals',
      value: stats ? String(stats.active_deals) : '--',
      testId: 'stat-active-deals',
    },
    {
      label: 'Won This Month',
      value: stats
        ? `${stats.won_this_month} (${formatCurrency(stats.won_value_this_month)})`
        : '--',
      testId: 'stat-won-this-month',
    },
  ]

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-sm text-foreground-muted" data-testid="stats-error">
        {error}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="pipeline-stats">
      {cards.map((card) => (
        <div
          key={card.testId}
          className="rounded-xl border border-border bg-surface p-5 shadow-card"
          data-testid={card.testId}
        >
          <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
            {card.label}
          </p>
          {loading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-muted" />
          ) : (
            <p className="mt-2 text-2xl font-bold text-foreground">{card.value}</p>
          )}
        </div>
      ))}
    </div>
  )
}
