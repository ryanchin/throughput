'use client'

import { useState } from 'react'
import { ROLE_FUNCTIONS, type RoleFunction } from '@/lib/crm/constants'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface RoleEntry {
  name: string
  function: RoleFunction | ''
}

interface CreateRolesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dealTitle: string
  dealId: string
  accountId: string | null
  accountName: string | null
  onCreated: (count: number) => void
}

export function CreateRolesModal({
  open,
  onOpenChange,
  dealTitle,
  dealId,
  accountId,
  accountName,
  onCreated,
}: CreateRolesModalProps) {
  const [roles, setRoles] = useState<RoleEntry[]>([
    { name: '', function: '' },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addRow() {
    setRoles((prev) => [...prev, { name: '', function: '' }])
  }

  function removeRow(index: number) {
    setRoles((prev) => prev.filter((_, i) => i !== index))
  }

  function updateRow(index: number, field: keyof RoleEntry, value: string) {
    setRoles((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    )
  }

  async function handleSubmit() {
    const validRoles = roles.filter((r) => r.name.trim())
    if (validRoles.length === 0) {
      setError('Add at least one role with a name')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/crm/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roles: validRoles.map((r) => ({
            name: r.name.trim(),
            account_id: accountId,
            deal_id: dealId,
            function: r.function || null,
            status: 'Open',
          })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create roles')
      }

      onCreated(validRoles.length)
      onOpenChange(false)
      setRoles([{ name: '', function: '' }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create roles')
    } finally {
      setSubmitting(false)
    }
  }

  function handleSkip() {
    onOpenChange(false)
    setRoles([{ name: '', function: '' }])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Open Roles for This Deal</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{dealTitle}</span>
            {accountName && (
              <span className="text-foreground-muted"> at {accountName}</span>
            )}
            {' '}just closed won. Add the roles that need to be filled so the Resources team can start matching consultants.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {roles.map((role, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={role.name}
                onChange={(e) => updateRow(i, 'name', e.target.value)}
                placeholder="Role name (e.g. Senior PgM)"
                className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <select
                value={role.function}
                onChange={(e) => updateRow(i, 'function', e.target.value)}
                className="w-[140px] rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">Function</option>
                {ROLE_FUNCTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              {roles.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="shrink-0 rounded p-1 text-foreground-muted hover:text-[var(--destructive)] transition-colors"
                  title="Remove"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="w-full rounded-lg border border-dashed border-border px-3 py-2 text-sm text-foreground-muted hover:border-accent hover:text-accent transition-colors"
        >
          + Add another role
        </button>

        {error && (
          <p className="text-sm text-[var(--destructive)]">{error}</p>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-lg bg-muted border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-raised transition-colors"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Roles'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
