'use client'

import { useState, useEffect } from 'react'
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS } from '@/lib/crm/constants'
import type { Company, Activity } from '@/lib/crm/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface ActivityFormProps {
  activity?: Activity
  defaultCompanyId?: string
  defaultContactId?: string
  defaultOpportunityId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

type FormErrors = {
  subject?: string
  general?: string
}

export function ActivityForm({
  activity,
  defaultCompanyId,
  defaultContactId,
  defaultOpportunityId,
  open,
  onOpenChange,
  onSaved,
}: ActivityFormProps) {
  const isEdit = Boolean(activity)

  const [companyId, setCompanyId] = useState(activity?.company_id ?? defaultCompanyId ?? '')
  const [contactId, setContactId] = useState(activity?.contact_id ?? defaultContactId ?? '')
  const [opportunityId, setOpportunityId] = useState(
    activity?.opportunity_id ?? defaultOpportunityId ?? ''
  )
  const [type, setType] = useState(activity?.type ?? 'note')
  const [subject, setSubject] = useState(activity?.subject ?? '')
  const [description, setDescription] = useState(activity?.description ?? '')
  const [activityDate, setActivityDate] = useState(
    activity?.activity_date?.split('T')[0] ?? new Date().toISOString().split('T')[0]
  )

  const [companies, setCompanies] = useState<Pick<Company, 'id' | 'name'>[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function fetchCompanies() {
      try {
        const res = await fetch('/api/admin/crm/companies?limit=100')
        if (res.ok) {
          const data = await res.json()
          setCompanies((data.companies ?? data).map((c: Company) => ({ id: c.id, name: c.name })))
        }
      } catch { /* ignore */ }
    }
    if (open) fetchCompanies()
  }, [open])

  function validate(): boolean {
    const newErrors: FormErrors = {}
    if (!subject.trim()) newErrors.subject = 'Subject is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setErrors({})

    const payload = {
      company_id: companyId || null,
      contact_id: contactId || null,
      opportunity_id: opportunityId || null,
      type,
      subject: subject.trim(),
      description: description.trim() || null,
      activity_date: activityDate,
    }

    try {
      const url = isEdit
        ? `/api/admin/crm/activities/${activity!.id}`
        : '/api/admin/crm/activities'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to save activity')
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
          <DialogTitle>{isEdit ? 'Edit Activity' : 'Log Activity'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="activity-form">
          {errors.general && (
            <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive-muted)] p-3 text-sm text-[var(--destructive)]">
              {errors.general}
            </div>
          )}

          {/* Type */}
          <div>
            <label htmlFor="activity-type" className="block text-sm font-medium text-foreground">
              Type
            </label>
            <select
              id="activity-type"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              data-testid="activity-type-select"
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label htmlFor="activity-subject" className="block text-sm font-medium text-foreground">
              Subject <span className="text-[var(--destructive)]">*</span>
            </label>
            <input
              id="activity-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="Follow-up call with VP"
              data-testid="activity-subject-input"
            />
            {errors.subject && <p className="mt-1 text-xs text-[var(--destructive)]">{errors.subject}</p>}
          </div>

          {/* Company */}
          <div>
            <label htmlFor="activity-company" className="block text-sm font-medium text-foreground">
              Company
            </label>
            <select
              id="activity-company"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              data-testid="activity-company-select"
            >
              <option value="">None</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label htmlFor="activity-date" className="block text-sm font-medium text-foreground">
              Date
            </label>
            <input
              id="activity-date"
              type="date"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              data-testid="activity-date-input"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="activity-description" className="block text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              id="activity-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
              placeholder="Details about this activity..."
              data-testid="activity-description-input"
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
              data-testid="activity-submit-button"
            >
              {submitting ? 'Saving...' : isEdit ? 'Update' : 'Log Activity'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
