'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  COMPANY_STATUS_LABELS,
  STAGE_LABELS,
  ACTIVITY_TYPE_LABELS,
  type CompanyStatus,
  type Stage,
  type ActivityType,
} from '@/lib/crm/constants'
import { formatCurrency, formatRelativeDate, formatShortDate, getVelocityColor, velocityClasses } from '@/lib/crm/format'
import type { Company, Contact, Opportunity, Activity } from '@/lib/crm/types'
import { ContactForm } from './ContactForm'
import { OpportunityForm } from './OpportunityForm'
import { ActivityForm } from './ActivityForm'

interface CompanyDetailProps {
  company: Company
  userRole: string
}

function CompanyStatusBadge({ status }: { status: CompanyStatus }) {
  const styles: Record<CompanyStatus, string> = {
    prospect: 'bg-accent-muted text-accent',
    active: 'bg-[var(--success-muted)] text-[var(--success)]',
    churned: 'bg-[var(--destructive-muted)] text-[var(--destructive)]',
    partner: 'bg-[var(--secondary-muted)] text-[var(--secondary)]',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {COMPANY_STATUS_LABELS[status]}
    </span>
  )
}

function StageBadge({ stage }: { stage: Stage }) {
  const styles: Record<Stage, string> = {
    lead: 'bg-accent-muted text-accent',
    qualified: 'bg-[var(--secondary-muted)] text-[var(--secondary)]',
    proposal: 'bg-[var(--warning-muted)] text-[var(--warning)]',
    negotiation: 'bg-gold-muted text-gold',
    closed_won: 'bg-[var(--success-muted)] text-[var(--success)]',
    closed_lost: 'bg-[var(--destructive-muted)] text-[var(--destructive)]',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[stage]}`}>
      {STAGE_LABELS[stage]}
    </span>
  )
}

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  call: 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z',
  email: 'M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75',
  meeting: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
  note: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  task: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
}

export function CompanyDetail({ company, userRole }: CompanyDetailProps) {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // Modal states
  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | undefined>()
  const [showOppForm, setShowOppForm] = useState(false)
  const [showActivityForm, setShowActivityForm] = useState(false)

  const [deleting, setDeleting] = useState(false)

  const fetchRelated = useCallback(async () => {
    setLoadingData(true)
    try {
      const [contactsRes, oppsRes, activitiesRes] = await Promise.all([
        fetch(`/api/admin/crm/contacts?company_id=${company.id}`),
        fetch(`/api/admin/crm/opportunities?company_id=${company.id}`),
        fetch(`/api/admin/crm/activities?company_id=${company.id}`),
      ])

      if (contactsRes.ok) {
        const data = await contactsRes.json()
        setContacts(data.contacts ?? data)
      }
      if (oppsRes.ok) {
        const data = await oppsRes.json()
        setOpportunities(data.opportunities ?? data)
      }
      if (activitiesRes.ok) {
        const data = await activitiesRes.json()
        setActivities(data.activities ?? data)
      }
    } catch { /* ignore */ }
    setLoadingData(false)
  }, [company.id])

  useEffect(() => {
    fetchRelated()
  }, [fetchRelated])

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete "${company.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/crm/companies/${company.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.push('/admin/crm/companies')
      router.refresh()
    } catch {
      alert('Failed to delete company')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div data-testid="company-detail">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">{company.name}</h1>
            <CompanyStatusBadge status={company.status} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-foreground-muted">
            {company.industry && <span>{company.industry}</span>}
            {company.company_size && <span>{company.company_size} employees</span>}
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-hover transition-colors"
              >
                {company.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
          {company.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {company.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-foreground-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/admin/crm/companies/${company.id}/edit`}
            className="rounded-lg bg-muted border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-raised transition-colors"
            data-testid="edit-company-button"
          >
            Edit
          </Link>
          {userRole === 'admin' && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-[var(--destructive-muted)] border border-[var(--destructive)] px-4 py-2 text-sm font-medium text-[var(--destructive)] hover:bg-[var(--destructive)]/20 transition-colors disabled:opacity-50"
              data-testid="delete-company-button"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8">
        <Tabs defaultValue="overview">
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts">
              Contacts {contacts.length > 0 && `(${contacts.length})`}
            </TabsTrigger>
            <TabsTrigger value="opportunities">
              Opportunities {opportunities.length > 0 && `(${opportunities.length})`}
            </TabsTrigger>
            <TabsTrigger value="activities">
              Activities {activities.length > 0 && `(${activities.length})`}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {/* Company Info */}
              <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted mb-4">
                  Company Info
                </h3>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-sm text-foreground-muted">Status</dt>
                    <dd><CompanyStatusBadge status={company.status} /></dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-foreground-muted">Industry</dt>
                    <dd className="text-sm text-foreground">{company.industry ?? '--'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-foreground-muted">Size</dt>
                    <dd className="text-sm text-foreground">{company.company_size ?? '--'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-foreground-muted">Created</dt>
                    <dd className="text-sm text-foreground">{formatShortDate(company.created_at)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-foreground-muted">AI Enriched</dt>
                    <dd className="text-sm text-foreground">{company.ai_enriched ? 'Yes' : 'No'}</dd>
                  </div>
                </dl>
              </div>

              {/* Notes */}
              <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted mb-4">
                  Notes
                </h3>
                {company.notes ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap">{company.notes}</p>
                ) : (
                  <p className="text-sm text-foreground-muted">No notes yet.</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts">
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Contacts</h3>
                <button
                  onClick={() => {
                    setEditingContact(undefined)
                    setShowContactForm(true)
                  }}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
                  data-testid="add-contact-button"
                >
                  Add Contact
                </button>
              </div>

              {loadingData ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : contacts.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface p-8 text-center shadow-card">
                  <p className="text-sm text-foreground-muted">No contacts yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="rounded-xl border border-border bg-surface p-4 shadow-card flex items-center justify-between"
                      data-testid={`contact-row-${contact.id}`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{contact.name}</span>
                          {contact.is_primary && (
                            <span className="rounded-full bg-accent-muted px-2 py-0.5 text-xs font-medium text-accent">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-foreground-muted">
                          {contact.title && <span>{contact.title}</span>}
                          {contact.email && <span>{contact.email}</span>}
                          {contact.phone && <span>{contact.phone}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setEditingContact(contact)
                          setShowContactForm(true)
                        }}
                        className="rounded-lg bg-muted border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-raised transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Opportunities Tab */}
          <TabsContent value="opportunities">
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Opportunities</h3>
                <button
                  onClick={() => setShowOppForm(true)}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
                  data-testid="add-opportunity-button"
                >
                  New Deal
                </button>
              </div>

              {loadingData ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : opportunities.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface p-8 text-center shadow-card">
                  <p className="text-sm text-foreground-muted">No deals yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {opportunities.map((opp) => (
                    <div
                      key={opp.id}
                      className="rounded-xl border border-border bg-surface p-4 shadow-card"
                      data-testid={`opp-row-${opp.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-foreground">{opp.title}</span>
                          <StageBadge stage={opp.stage} />
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          {formatCurrency(opp.value)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-foreground-muted">
                        {opp.expected_close_date && (
                          <span>Close: {formatShortDate(opp.expected_close_date)}</span>
                        )}
                        {opp.ai_score != null && <span>Score: {opp.ai_score}%</span>}
                        <span>Updated {formatRelativeDate(opp.updated_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Activities Tab */}
          <TabsContent value="activities">
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Activities</h3>
                <button
                  onClick={() => setShowActivityForm(true)}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
                  data-testid="add-activity-button"
                >
                  Log Activity
                </button>
              </div>

              {loadingData ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface p-8 text-center shadow-card">
                  <p className="text-sm text-foreground-muted">No activities yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map((act) => (
                    <div
                      key={act.id}
                      className="flex gap-3 rounded-xl border border-border bg-surface p-4 shadow-card"
                      data-testid={`activity-row-${act.id}`}
                    >
                      <div className="shrink-0 mt-0.5">
                        <svg className="size-5 text-foreground-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d={ACTIVITY_ICONS[act.type as ActivityType] ?? ACTIVITY_ICONS.note} />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{act.subject}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground-muted">
                            {ACTIVITY_TYPE_LABELS[act.type as ActivityType] ?? act.type}
                          </span>
                        </div>
                        {act.description && (
                          <p className="mt-1 text-xs text-foreground-muted line-clamp-2">
                            {act.description}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-foreground-muted">
                          {formatRelativeDate(act.activity_date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <ContactForm
        companyId={company.id}
        contact={editingContact}
        open={showContactForm}
        onOpenChange={setShowContactForm}
        onSaved={fetchRelated}
      />

      <OpportunityForm
        defaultCompanyId={company.id}
        open={showOppForm}
        onOpenChange={setShowOppForm}
        onSaved={() => {
          setShowOppForm(false)
          fetchRelated()
        }}
      />

      <ActivityForm
        defaultCompanyId={company.id}
        open={showActivityForm}
        onOpenChange={setShowActivityForm}
        onSaved={() => {
          setShowActivityForm(false)
          fetchRelated()
        }}
      />
    </div>
  )
}
