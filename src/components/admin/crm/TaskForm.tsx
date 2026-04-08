'use client'

import { useState, useEffect } from 'react'
import { CompanyCombobox } from './CompanyCombobox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface EditableTask {
  id: string
  subject: string
  company_id: string | null
  opportunity_id: string | null
  description: string | null
  due_date: string | null
  priority: number | null
  status: string | null
  assignees?: { user_id: string; full_name: string }[]
}

interface TaskFormProps {
  task?: EditableTask
  defaultCompanyId?: string
  defaultOpportunityId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

type FormErrors = {
  subject?: string
  general?: string
}

interface AssignableUser {
  id: string
  full_name: string
}

interface OpportunityOption {
  id: string
  title: string
}

export function TaskForm({
  task,
  defaultCompanyId,
  defaultOpportunityId,
  open,
  onOpenChange,
  onSaved,
}: TaskFormProps) {
  const isEdit = Boolean(task)

  const [subject, setSubject] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [opportunityId, setOpportunityId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<number>(2)
  const [status, setStatus] = useState('Not Started')
  const [description, setDescription] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])

  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  // Assignable users
  const [users, setUsers] = useState<AssignableUser[]>([])
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch('/api/admin/crm/tasks/assignees')
        if (res.ok) {
          const data = await res.json()
          setUsers(data.users ?? [])
        }
      } catch { /* ignore */ }
    }
    if (open) fetchUsers()
  }, [open])

  // Opportunities filtered by company
  const [opportunities, setOpportunities] = useState<OpportunityOption[]>([])
  useEffect(() => {
    async function fetchOpps() {
      if (!companyId) {
        setOpportunities([])
        return
      }
      try {
        const res = await fetch(`/api/admin/crm/opportunities?company_id=${companyId}`)
        if (res.ok) {
          const data = await res.json()
          setOpportunities(
            (data.opportunities ?? []).map((o: { id: string; title: string }) => ({
              id: o.id,
              title: o.title,
            }))
          )
        }
      } catch {
        setOpportunities([])
      }
    }
    fetchOpps()
  }, [companyId])

  // Reset form when dialog opens — populate from task if editing
  useEffect(() => {
    if (open) {
      if (task) {
        setSubject(task.subject)
        setCompanyId(task.company_id ?? '')
        setOpportunityId(task.opportunity_id ?? '')
        setDueDate(task.due_date?.split('T')[0] ?? '')
        setPriority(task.priority ?? 2)
        setStatus(task.status ?? 'Not Started')
        setDescription(task.description ?? '')
        setAssigneeIds(task.assignees?.map((a) => a.user_id) ?? [])
      } else {
        setSubject('')
        setCompanyId(defaultCompanyId ?? '')
        setOpportunityId(defaultOpportunityId ?? '')
        setDueDate('')
        setPriority(2)
        setStatus('Not Started')
        setDescription('')
        setAssigneeIds([])
      }
      setErrors({})
    }
  }, [open, task, defaultCompanyId, defaultOpportunityId])

  function validate(): boolean {
    const newErrors: FormErrors = {}
    if (!subject.trim()) newErrors.subject = 'Subject is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function toggleAssignee(userId: string) {
    setAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setErrors({})

    const payload = {
      subject: subject.trim(),
      company_id: companyId || '',
      contact_id: '',
      opportunity_id: opportunityId || '',
      description: description.trim() || '',
      due_date: dueDate || '',
      priority,
      status,
      assignee_ids: assigneeIds,
    }

    try {
      const url = isEdit
        ? `/api/admin/crm/tasks/${task!.id}`
        : '/api/admin/crm/tasks'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Failed to ${isEdit ? 'update' : 'create'} task`)
      }

      onSaved()
      onOpenChange(false)
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="task-form">
          {errors.general && (
            <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive-muted)] p-3 text-sm text-[var(--destructive)]">
              {errors.general}
            </div>
          )}

          {/* Subject */}
          <div>
            <label htmlFor="task-subject" className="block text-sm font-medium text-foreground">
              Subject <span className="text-[var(--destructive)]">*</span>
            </label>
            <input
              id="task-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="Follow up with client on proposal"
              data-testid="task-subject-input"
            />
            {errors.subject && <p className="mt-1 text-xs text-[var(--destructive)]">{errors.subject}</p>}
          </div>

          {/* Company */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Company
            </label>
            <CompanyCombobox
              value={companyId}
              onChange={(id) => {
                setCompanyId(id)
                setOpportunityId('')
              }}
              placeholder="Search or create company..."
              allowNone
              noneLabel="None"
              data-testid="task-company-select"
            />
          </div>

          {/* Opportunity */}
          {companyId && opportunities.length > 0 && (
            <div>
              <label htmlFor="task-opportunity" className="block text-sm font-medium text-foreground">
                Opportunity
              </label>
              <select
                id="task-opportunity"
                value={opportunityId}
                onChange={(e) => setOpportunityId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                data-testid="task-opportunity-select"
              >
                <option value="">None</option>
                {opportunities.map((o) => (
                  <option key={o.id} value={o.id}>{o.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Due Date */}
          <div>
            <label htmlFor="task-due-date" className="block text-sm font-medium text-foreground">
              Due Date
            </label>
            <input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              data-testid="task-due-date-input"
            />
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-priority" className="block text-sm font-medium text-foreground">
                Priority
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                data-testid="task-priority-select"
              >
                <option value={1}>High</option>
                <option value={2}>Normal</option>
              </select>
            </div>
            <div>
              <label htmlFor="task-status" className="block text-sm font-medium text-foreground">
                Status
              </label>
              <select
                id="task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                data-testid="task-status-select"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
          </div>

          {/* Assignees */}
          {users.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Assignees
              </label>
              <div className="max-h-32 overflow-y-auto space-y-1 rounded-lg border border-border bg-muted p-2">
                {users.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 rounded px-2 py-1 cursor-pointer hover:bg-raised transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={assigneeIds.includes(user.id)}
                      onChange={() => toggleAssignee(user.id)}
                      className="size-3.5 rounded border-border text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-foreground">{user.full_name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label htmlFor="task-description" className="block text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
              placeholder="Additional details..."
              data-testid="task-description-input"
            />
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg bg-muted border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-raised transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow disabled:opacity-50"
              data-testid="task-submit-button"
            >
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
