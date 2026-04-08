'use client'

import { useState, useEffect, useCallback } from 'react'
import { ACTION_STATUSES } from '@/lib/crm/constants'
import { formatRelativeDate, formatShortDate } from '@/lib/crm/format'
import type { Task } from '@/lib/crm/types'
import { TaskForm } from './TaskForm'

type Tab = 'my' | 'overdue' | 'all'

const TAB_LABELS: Record<Tab, string> = {
  my: 'My Tasks',
  overdue: 'Overdue',
  all: 'All',
}

const TAB_EMPTY: Record<Tab, string> = {
  my: 'No tasks assigned to you',
  overdue: 'No overdue tasks',
  all: 'No tasks yet',
}

function PriorityBadge({ priority }: { priority: number | null }) {
  if (priority === 1) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--destructive-muted)] text-[var(--destructive)]">
        High
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-foreground-muted">
      Normal
    </span>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const styles: Record<string, string> = {
    'Not Started': 'bg-accent-muted text-accent',
    'In Progress': 'bg-[var(--warning-muted)] text-[var(--warning)]',
    'Completed': 'bg-[var(--success-muted)] text-[var(--success)]',
    'On Hold': 'bg-muted text-foreground-muted',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status ?? ''] ?? 'bg-muted text-foreground-muted'}`}>
      {status ?? '--'}
    </span>
  )
}

export function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('my')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('tab', activeTab)
      if (statusFilter) params.set('status', statusFilter)
      if (priorityFilter) params.set('priority', priorityFilter)

      const res = await fetch(`/api/admin/crm/tasks?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load tasks')
      const data = await res.json()
      setTasks(data.tasks ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [activeTab, statusFilter, priorityFilter])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  async function handleToggleComplete(task: Task) {
    const isCompleting = task.status !== 'Completed'
    try {
      const res = await fetch(`/api/admin/crm/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isCompleting
            ? { status: 'Completed', completed: true }
            : { status: 'Not Started', completed: false }
        ),
      })
      if (!res.ok) throw new Error('Failed to update task')
      fetchTasks()
    } catch {
      /* ignore */
    }
  }

  function getRowBgClass(task: Task): string {
    if (task.status === 'Completed') return ''
    if (!task.due_date) return ''
    const todayStr = new Date().toISOString().split('T')[0]
    const dueDate = task.due_date.split('T')[0]
    if (dueDate < todayStr) return 'bg-[var(--destructive-muted)]'
    if (dueDate === todayStr) return 'bg-[var(--warning-muted)]'
    return ''
  }

  return (
    <div data-testid="tasks-view">
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {(['my', 'overdue', 'all'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-accent text-background shadow-accent-glow'
                : 'bg-muted border border-border text-foreground hover:bg-raised'
            }`}
            data-testid={`tab-${tab}`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={() => setShowTaskForm(true)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
          data-testid="new-task-button"
        >
          New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          data-testid="task-status-filter"
        >
          <option value="">All Statuses</option>
          {ACTION_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          data-testid="task-priority-filter"
        >
          <option value="">All Priorities</option>
          <option value="1">High</option>
          <option value="2">Normal</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-foreground-muted" data-testid="tasks-error">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && tasks.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-card" data-testid="tasks-empty-state">
          <svg className="mx-auto size-12 text-foreground-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-foreground">{TAB_EMPTY[activeTab]}</h3>
          <p className="mt-1 text-sm text-foreground-muted">
            Create a new task to get started.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setShowTaskForm(true)}
              className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
              data-testid="empty-new-task-button"
            >
              New Task
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && tasks.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
              <table className="w-full" data-testid="tasks-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-3 text-left w-10"></th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Subject</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Company</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Due Date</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Priority</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Assignees</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tasks.map((task) => (
                    <tr
                      key={task.id}
                      className={`transition-colors hover:bg-raised ${getRowBgClass(task)}`}
                      data-testid={`task-row-${task.id}`}
                    >
                      <td className="px-3 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={task.status === 'Completed'}
                          onChange={() => handleToggleComplete(task)}
                          className="size-4 rounded border-border text-accent focus:ring-accent cursor-pointer"
                          data-testid={`task-checkbox-${task.id}`}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setEditingTask(task)}
                          className={`text-sm font-medium text-left hover:text-accent transition-colors ${task.status === 'Completed' ? 'text-foreground-muted line-through' : 'text-foreground'}`}
                        >
                          {task.subject}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground-muted">
                        {(task.company as { name: string } | null)?.name ?? '--'}
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground-muted">
                        {task.due_date ? formatShortDate(task.due_date) : '--'}
                        {task.days_overdue && task.days_overdue > 0 && (
                          <span className="ml-1 text-xs text-[var(--destructive)]">
                            ({task.days_overdue}d overdue)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground-muted">
                        {task.assignees && task.assignees.length > 0
                          ? task.assignees.map((a) => a.full_name).join(', ')
                          : '--'}
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground-muted">
                        {formatRelativeDate(task.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`rounded-xl border border-border bg-surface p-4 shadow-card ${getRowBgClass(task)}`}
                data-testid={`task-card-${task.id}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={task.status === 'Completed'}
                    onChange={() => handleToggleComplete(task)}
                    className="mt-0.5 size-4 rounded border-border text-accent focus:ring-accent cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => setEditingTask(task)}
                      className={`text-sm font-medium text-left hover:text-accent transition-colors ${task.status === 'Completed' ? 'text-foreground-muted line-through' : 'text-foreground'}`}
                    >
                      {task.subject}
                    </button>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} />
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-foreground-muted">
                      {(task.company as { name: string } | null)?.name && (
                        <span>{(task.company as { name: string }).name}</span>
                      )}
                      {task.due_date && <span>Due: {formatShortDate(task.due_date)}</span>}
                      <span>Created {formatRelativeDate(task.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* New Task Dialog */}
      <TaskForm
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        onSaved={() => {
          setShowTaskForm(false)
          fetchTasks()
        }}
      />

      {/* Edit Task Dialog */}
      {editingTask && (
        <TaskForm
          task={{
            id: editingTask.id,
            subject: editingTask.subject,
            company_id: (editingTask.company as { id: string } | null)?.id ?? null,
            opportunity_id: (editingTask.opportunity as { id: string } | null)?.id ?? null,
            description: editingTask.description,
            due_date: editingTask.due_date,
            priority: editingTask.priority,
            status: editingTask.status,
            assignees: editingTask.assignees,
          }}
          open={true}
          onOpenChange={(open) => { if (!open) setEditingTask(null) }}
          onSaved={() => {
            setEditingTask(null)
            fetchTasks()
          }}
        />
      )}
    </div>
  )
}
