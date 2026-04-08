'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/crm/format'
import type { CrmStats } from '@/lib/crm/types'

interface TaskStats {
  overdue_count: number
  due_today_count: number
  my_tasks_count: number
}

export function PipelineStats() {
  const [stats, setStats] = useState<CrmStats | null>(null)
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null)
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

  useEffect(() => {
    async function fetchTaskStats() {
      try {
        const res = await fetch('/api/admin/crm/tasks/stats')
        if (res.ok) {
          const data = await res.json()
          setTaskStats(data)
        }
      } catch { /* ignore */ }
    }
    fetchTaskStats()
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
    {
      label: 'Overdue Tasks',
      value: taskStats ? String(taskStats.overdue_count) : '--',
      testId: 'stat-overdue-tasks',
      highlight: (taskStats?.overdue_count ?? 0) > 0,
    },
    {
      label: 'Due Today',
      value: taskStats ? String(taskStats.due_today_count) : '--',
      testId: 'stat-due-today',
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" data-testid="pipeline-stats">
      {cards.map((card) => (
        <div
          key={card.testId}
          className={`rounded-xl border bg-surface p-5 shadow-card ${
            (card as { highlight?: boolean }).highlight
              ? 'border-[var(--destructive)]'
              : 'border-border'
          }`}
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
