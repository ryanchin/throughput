'use client'

import { useState } from 'react'
import type { Contact } from '@/lib/crm/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface ContactFormProps {
  companyId: string
  contact?: Contact
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

type FormErrors = {
  name?: string
  email?: string
  general?: string
}

export function ContactForm({ companyId, contact, open, onOpenChange, onSaved }: ContactFormProps) {
  const isEdit = Boolean(contact)

  const [name, setName] = useState(contact?.name ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [title, setTitle] = useState(contact?.title ?? '')
  const [linkedinUrl, setLinkedinUrl] = useState(contact?.linkedin_url ?? '')
  const [isPrimary, setIsPrimary] = useState(contact?.is_primary ?? false)

  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function validate(): boolean {
    const newErrors: FormErrors = {}
    if (!name.trim()) newErrors.name = 'Name is required'
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email address'
    }
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
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      title: title.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      is_primary: isPrimary,
    }

    try {
      const url = isEdit
        ? `/api/admin/crm/contacts/${contact!.id}`
        : '/api/admin/crm/contacts'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to save contact')
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
          <DialogTitle>{isEdit ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="contact-form">
          {errors.general && (
            <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive-muted)] p-3 text-sm text-[var(--destructive)]">
              {errors.general}
            </div>
          )}

          <div>
            <label htmlFor="contact-name" className="block text-sm font-medium text-foreground">
              Name <span className="text-[var(--destructive)]">*</span>
            </label>
            <input
              id="contact-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="Jane Smith"
              data-testid="contact-name-input"
            />
            {errors.name && <p className="mt-1 text-xs text-[var(--destructive)]">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="contact-email" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="jane@example.com"
              data-testid="contact-email-input"
            />
            {errors.email && <p className="mt-1 text-xs text-[var(--destructive)]">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="contact-phone" className="block text-sm font-medium text-foreground">
              Phone
            </label>
            <input
              id="contact-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="+1 555-123-4567"
              data-testid="contact-phone-input"
            />
          </div>

          <div>
            <label htmlFor="contact-title" className="block text-sm font-medium text-foreground">
              Title
            </label>
            <input
              id="contact-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="VP of Engineering"
              data-testid="contact-title-input"
            />
          </div>

          <div>
            <label htmlFor="contact-linkedin" className="block text-sm font-medium text-foreground">
              LinkedIn URL
            </label>
            <input
              id="contact-linkedin"
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="https://linkedin.com/in/janesmith"
              data-testid="contact-linkedin-input"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="contact-primary"
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="size-4 rounded border-border bg-muted text-accent focus:ring-accent"
              data-testid="contact-primary-checkbox"
            />
            <label htmlFor="contact-primary" className="text-sm text-foreground">
              Primary contact
            </label>
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
              data-testid="contact-submit-button"
            >
              {submitting ? 'Saving...' : isEdit ? 'Update' : 'Add Contact'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
