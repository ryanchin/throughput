'use client'

import { useState, useEffect, useCallback } from 'react'

interface GenerationLog {
  id: string
  admin_id: string
  generation_type: string
  inputs: Record<string, unknown>
  output_summary: string | null
  model: string
  tokens_used: number | null
  duration_ms: number | null
  status: string
  error_message: string | null
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  course: 'Course',
  lesson: 'Lesson',
  certification: 'Certification',
}

const TYPE_COLORS: Record<string, string> = {
  course: 'bg-accent-muted text-accent',
  lesson: 'bg-secondary-muted text-secondary',
  certification: 'bg-gold-muted text-gold',
}

export function GenerationHistory() {
  const [logs, setLogs] = useState<GenerationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/generation-history')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setLogs(data.logs ?? [])
    } catch {
      setError('Failed to load generation history.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <div className="mx-auto size-6 animate-spin rounded-full border-2 border-foreground-muted border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-foreground-muted">{error}</p>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center" data-testid="gen-history-empty">
        <p className="text-foreground-muted">
          No generations yet. Generate your first course or certification to see history here.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden" data-testid="gen-history-table">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Type</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Summary</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Status</th>
            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground-muted">Duration</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {logs.map((log) => (
            <tr key={log.id} className="transition-colors hover:bg-raised">
              <td className="px-5 py-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  TYPE_COLORS[log.generation_type] ?? 'bg-muted text-foreground-muted'
                }`}>
                  {TYPE_LABELS[log.generation_type] ?? log.generation_type}
                </span>
              </td>
              <td className="px-5 py-3 text-sm text-foreground max-w-md truncate">
                {log.output_summary || summarizeInputs(log.inputs)}
              </td>
              <td className="px-5 py-3">
                {log.status === 'success' ? (
                  <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                    Success
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"
                    title={log.error_message ?? undefined}>
                    Error
                  </span>
                )}
              </td>
              <td className="px-5 py-3 text-sm text-foreground-muted text-right">
                {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '—'}
              </td>
              <td className="px-5 py-3 text-sm text-foreground-muted">
                {new Date(log.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function summarizeInputs(inputs: Record<string, unknown>): string {
  const parts: string[] = []
  if (inputs.title) parts.push(`"${inputs.title}"`)
  if (inputs.preset) parts.push(`${inputs.preset} preset`)
  if (inputs.fileName) parts.push(`+ ${inputs.fileName}`)
  if (Array.isArray(inputs.courseIds) && inputs.courseIds.length > 0) {
    parts.push(`+ ${inputs.courseIds.length} course(s)`)
  }
  return parts.join(' ') || 'AI generation'
}
