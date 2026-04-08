'use client'

import { useState, useEffect } from 'react'

interface Suggestion {
  subject: string
  due_days: number
  priority: number
}

interface AiTaskSuggestionsProps {
  activityId: string
  onDismiss: () => void
  onTaskCreated: () => void
}

export function AiTaskSuggestions({ activityId, onDismiss, onTaskCreated }: AiTaskSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingIdx, setCreatingIdx] = useState<number | null>(null)

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const res = await fetch('/api/admin/crm/ai/suggest-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activity_id: activityId }),
        })
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data.suggestions ?? [])
        }
      } catch {
        /* non-critical */
      } finally {
        setLoading(false)
      }
    }
    fetchSuggestions()
  }, [activityId])

  async function handleCreate(suggestion: Suggestion, index: number) {
    setCreatingIdx(index)
    try {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + suggestion.due_days)

      const res = await fetch('/api/admin/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: suggestion.subject,
          due_date: dueDate.toISOString().split('T')[0],
          priority: suggestion.priority,
          status: 'Not Started',
        }),
      })
      if (res.ok) {
        // Remove the created suggestion from the list
        setSuggestions((prev) => prev.filter((_, i) => i !== index))
        onTaskCreated()
      }
    } catch {
      /* ignore */
    } finally {
      setCreatingIdx(null)
    }
  }

  if (loading) {
    return (
      <div className="mt-4 rounded-xl border border-accent/30 bg-accent-muted/30 p-4" data-testid="ai-task-suggestions">
        <div className="flex items-center gap-2">
          <div className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-foreground-muted">Generating follow-up suggestions...</p>
        </div>
      </div>
    )
  }

  if (suggestions.length === 0) {
    return null
  }

  return (
    <div className="mt-4 rounded-xl border border-accent/30 bg-accent-muted/30 p-4" data-testid="ai-task-suggestions">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-foreground">AI suggested follow-ups:</p>
        <button
          onClick={onDismiss}
          className="text-xs text-foreground-muted hover:text-foreground transition-colors"
        >
          Dismiss
        </button>
      </div>
      <div className="space-y-2">
        {suggestions.map((suggestion, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"
            data-testid={`ai-suggestion-${idx}`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{suggestion.subject}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-foreground-muted">
                  in {suggestion.due_days} day{suggestion.due_days !== 1 ? 's' : ''}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    suggestion.priority === 1
                      ? 'bg-[var(--destructive-muted)] text-[var(--destructive)]'
                      : 'bg-muted text-foreground-muted'
                  }`}
                >
                  {suggestion.priority === 1 ? 'High' : 'Normal'}
                </span>
              </div>
            </div>
            <button
              onClick={() => handleCreate(suggestion, idx)}
              disabled={creatingIdx === idx}
              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-background hover:bg-accent-hover transition-colors disabled:opacity-50"
              data-testid={`create-suggestion-${idx}`}
            >
              {creatingIdx === idx ? 'Creating...' : 'Create'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
