'use client'

import { useState, useEffect } from 'react'
import { STAGES, STAGE_LABELS } from '@/lib/crm/constants'
import type { Company, Contact, Opportunity } from '@/lib/crm/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface OpportunityFormProps {
  opportunity?: Opportunity
  /** Pre-select a company (e.g., from company detail page) */
  defaultCompanyId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

type FormErrors = {
  title?: string
  company_id?: string
  value?: string
  general?: string
}

export function OpportunityForm({
  opportunity,
  defaultCompanyId,
  open,
  onOpenChange,
  onSaved,
}: OpportunityFormProps) {
  const isEdit = Boolean(opportunity)

  const [companyId, setCompanyId] = useState(opportunity?.company_id ?? defaultCompanyId ?? '')
  const [contactId, setContactId] = useState(opportunity?.contact_id ?? '')
  const [title, setTitle] = useState(opportunity?.title ?? '')
  const [value, setValue] = useState(opportunity?.value?.toString() ?? '')
  const [stage, setStage] = useState(opportunity?.stage ?? 'lead')
  const [expectedCloseDate, setExpectedCloseDate] = useState(
    opportunity?.expected_close_date?.split('T')[0] ?? ''
  )
  const [notes, setNotes] = useState(opportunity?.notes ?? '')

  const [companies, setCompanies] = useState<Pick<Company, 'id' | 'name'>[]>([])
  const [contacts, setContacts] = useState<Pick<Contact, 'id' | 'name'>[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  // Fetch companies for select
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

  // Fetch contacts for selected company
  useEffect(() => {
    async function fetchContacts() {
      if (!companyId) {
        setContacts([])
        return
      }
      try {
        const res = await fetch(`/api/admin/crm/contacts?company_id=${companyId}`)
        if (res.ok) {
          const data = await res.json()
          setContacts((data.contacts ?? data).map((c: Contact) => ({ id: c.id, name: c.name })))
        }
      } catch { /* ignore */ }
    }
    fetchContacts()
  }, [companyId])

  function validate(): boolean {
    const newErrors: FormErrors = {}
    if (!title.trim()) newErrors.title = 'Deal title is required'
    if (!companyId) newErrors.company_id = 'Company is required'
    if (value && isNaN(Number(value))) newErrors.value = 'Value must be a number'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setErrors({})

    const payload = {
      company_id: companyId,
      contact_id: contactId || null,
      title: title.trim(),
      value: value ? Number(value) : 0,
      stage,
      expected_close_date: expectedCloseDate || null,
      notes: notes.trim() || null,
    }

    try {
      const url = isEdit
        ? `/api/admin/crm/opportunities/${opportunity!.id}`
        : '/api/admin/crm/opportunities'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to save opportunity')
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
          <DialogTitle>{isEdit ? 'Edit Deal' : 'New Deal'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="opportunity-form">
          {errors.general && (
            <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive-muted)] p-3 text-sm text-[var(--destructive)]">
              {errors.general}
            </div>
          )}

          {/* Company */}
          <div>
            <label htmlFor="opp-company" className="block text-sm font-medium text-foreground">
              Company <span className="text-[var(--destructive)]">*</span>
            </label>
            <select
              id="opp-company"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              data-testid="opp-company-select"
            >
              <option value="">Select company...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.company_id && <p className="mt-1 text-xs text-[var(--destructive)]">{errors.company_id}</p>}
          </div>

          {/* Contact */}
          <div>
            <label htmlFor="opp-contact" className="block text-sm font-medium text-foreground">
              Contact
            </label>
            <select
              id="opp-contact"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              data-testid="opp-contact-select"
              disabled={!companyId}
            >
              <option value="">None</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="opp-title" className="block text-sm font-medium text-foreground">
              Deal Title <span className="text-[var(--destructive)]">*</span>
            </label>
            <input
              id="opp-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="Enterprise license deal"
              data-testid="opp-title-input"
            />
            {errors.title && <p className="mt-1 text-xs text-[var(--destructive)]">{errors.title}</p>}
          </div>

          {/* Value */}
          <div>
            <label htmlFor="opp-value" className="block text-sm font-medium text-foreground">
              Value ($)
            </label>
            <input
              id="opp-value"
              type="number"
              min="0"
              step="1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="50000"
              data-testid="opp-value-input"
            />
            {errors.value && <p className="mt-1 text-xs text-[var(--destructive)]">{errors.value}</p>}
          </div>

          {/* Stage */}
          <div>
            <label htmlFor="opp-stage" className="block text-sm font-medium text-foreground">
              Stage
            </label>
            <select
              id="opp-stage"
              value={stage}
              onChange={(e) => setStage(e.target.value as typeof stage)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              data-testid="opp-stage-select"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Expected Close Date */}
          <div>
            <label htmlFor="opp-close-date" className="block text-sm font-medium text-foreground">
              Expected Close Date
            </label>
            <input
              id="opp-close-date"
              type="date"
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              data-testid="opp-close-date-input"
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="opp-notes" className="block text-sm font-medium text-foreground">
              Notes
            </label>
            <textarea
              id="opp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
              placeholder="Notes about this deal..."
              data-testid="opp-notes-input"
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
              data-testid="opp-submit-button"
            >
              {submitting ? 'Saving...' : isEdit ? 'Update Deal' : 'Create Deal'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
