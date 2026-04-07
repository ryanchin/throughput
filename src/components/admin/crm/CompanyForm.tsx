'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  COMPANY_SIZES,
  COMPANY_STATUSES,
  COMPANY_STATUS_LABELS,
} from '@/lib/crm/constants'
import type { Company } from '@/lib/crm/types'

interface CompanyFormProps {
  company?: Company
}

type FormErrors = {
  name?: string
  website?: string
  general?: string
}

export function CompanyForm({ company }: CompanyFormProps) {
  const router = useRouter()
  const isEdit = Boolean(company)

  const [name, setName] = useState(company?.name ?? '')
  const [website, setWebsite] = useState(company?.website ?? '')
  const [industry, setIndustry] = useState(company?.industry ?? '')
  const [companySize, setCompanySize] = useState(company?.company_size ?? '')
  const [status, setStatus] = useState(company?.status ?? 'prospect')
  const [notes, setNotes] = useState(company?.notes ?? '')
  const [tags, setTags] = useState(company?.tags?.join(', ') ?? '')

  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [enriching, setEnriching] = useState(false)

  function validate(): boolean {
    const newErrors: FormErrors = {}
    if (!name.trim()) newErrors.name = 'Company name is required'
    if (website && !/^https?:\/\/.+/.test(website)) {
      newErrors.website = 'Website must start with http:// or https://'
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
      name: name.trim(),
      website: website.trim() || null,
      industry: industry.trim() || null,
      company_size: companySize || null,
      status,
      notes: notes.trim() || null,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    }

    try {
      const url = isEdit
        ? `/api/admin/crm/companies/${company!.id}`
        : '/api/admin/crm/companies'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to save company')
      }

      const data = await res.json()
      router.push(`/admin/crm/companies/${data.id}`)
      router.refresh()
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEnrich() {
    if (!name.trim()) {
      setErrors({ name: 'Enter a company name before enriching' })
      return
    }

    setEnriching(true)
    try {
      const res = await fetch('/api/admin/crm/ai/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: name.trim(), website: website.trim() || null }),
      })

      if (!res.ok) throw new Error('Enrichment failed')

      const data = await res.json()
      if (data.industry) setIndustry(data.industry)
      if (data.company_size) setCompanySize(data.company_size)
      if (data.website) setWebsite(data.website)
      if (data.notes) setNotes((prev) => (prev ? `${prev}\n\n${data.notes}` : data.notes))
    } catch {
      setErrors({ general: 'AI enrichment failed. You can still save manually.' })
    } finally {
      setEnriching(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="company-form">
      {errors.general && (
        <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive-muted)] p-3 text-sm text-[var(--destructive)]" data-testid="form-error">
          {errors.general}
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-6 shadow-card space-y-5">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground">
            Company Name <span className="text-[var(--destructive)]">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="Acme Corp"
            data-testid="company-name-input"
          />
          {errors.name && <p className="mt-1 text-xs text-[var(--destructive)]">{errors.name}</p>}
        </div>

        {/* Website */}
        <div>
          <label htmlFor="website" className="block text-sm font-medium text-foreground">
            Website
          </label>
          <input
            id="website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="https://example.com"
            data-testid="company-website-input"
          />
          {errors.website && <p className="mt-1 text-xs text-[var(--destructive)]">{errors.website}</p>}
        </div>

        {/* Industry */}
        <div>
          <label htmlFor="industry" className="block text-sm font-medium text-foreground">
            Industry
          </label>
          <input
            id="industry"
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="Technology, Healthcare, etc."
            data-testid="company-industry-input"
          />
        </div>

        {/* Company Size */}
        <div>
          <label htmlFor="company-size" className="block text-sm font-medium text-foreground">
            Company Size
          </label>
          <select
            id="company-size"
            value={companySize}
            onChange={(e) => setCompanySize(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            data-testid="company-size-select"
          >
            <option value="">Select size...</option>
            {COMPANY_SIZES.map((size) => (
              <option key={size} value={size}>{size} employees</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-foreground">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            data-testid="company-status-select"
          >
            {COMPANY_STATUSES.map((s) => (
              <option key={s} value={s}>{COMPANY_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-foreground">
            Tags
          </label>
          <input
            id="tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="enterprise, healthcare, priority (comma-separated)"
            data-testid="company-tags-input"
          />
          <p className="mt-1 text-xs text-foreground-muted">Separate tags with commas</p>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-foreground">
            Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
            placeholder="Internal notes about this company..."
            data-testid="company-notes-input"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleEnrich}
          disabled={enriching || !name.trim()}
          className="rounded-lg bg-muted border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-raised transition-colors disabled:opacity-50"
          data-testid="enrich-button"
        >
          {enriching ? 'Enriching...' : 'Enrich with AI'}
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg bg-muted border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-raised transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow disabled:opacity-50"
            data-testid="company-submit-button"
          >
            {submitting ? 'Saving...' : isEdit ? 'Update Company' : 'Create Company'}
          </button>
        </div>
      </div>
    </form>
  )
}
