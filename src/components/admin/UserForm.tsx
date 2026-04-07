'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface UserFormData {
  id?: string
  email: string
  full_name: string
  role: string
}

interface UserFormProps {
  user?: UserFormData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

type FormErrors = {
  email?: string
  full_name?: string
  role?: string
  general?: string
}

const ROLES = [
  { value: 'employee', label: 'Employee' },
  { value: 'sales', label: 'Sales' },
  { value: 'admin', label: 'Admin' },
]

export function UserForm({ user, open, onOpenChange, onSaved }: UserFormProps) {
  const isEdit = Boolean(user?.id)

  const [email, setEmail] = useState(user?.email ?? '')
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [role, setRole] = useState(user?.role ?? 'employee')

  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  // Reset form when user prop changes
  useEffect(() => {
    if (open) {
      setEmail(user?.email ?? '')
      setFullName(user?.full_name ?? '')
      setRole(user?.role ?? 'employee')
      setErrors({})
    }
  }, [open, user])

  function validate(): boolean {
    const newErrors: FormErrors = {}
    if (!fullName.trim()) newErrors.full_name = 'Full name is required'
    if (!email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email address'
    }
    if (!role) newErrors.role = 'Role is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setErrors({})

    const payload = {
      email: email.trim(),
      full_name: fullName.trim(),
      role,
    }

    try {
      const url = isEdit
        ? `/api/admin/users/${user!.id}`
        : '/api/admin/users'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Failed to ${isEdit ? 'update' : 'create'} user`)
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
          <DialogTitle>{isEdit ? 'Edit User' : 'Create User'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="user-form">
          {errors.general && (
            <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive-muted)] p-3 text-sm text-[var(--destructive)]">
              {errors.general}
            </div>
          )}

          <div>
            <label htmlFor="user-full-name" className="block text-sm font-medium text-foreground">
              Full Name <span className="text-[var(--destructive)]">*</span>
            </label>
            <input
              id="user-full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="Jane Smith"
              data-testid="user-fullname-input"
            />
            {errors.full_name && <p className="mt-1 text-xs text-[var(--destructive)]">{errors.full_name}</p>}
          </div>

          <div>
            <label htmlFor="user-email" className="block text-sm font-medium text-foreground">
              Email <span className="text-[var(--destructive)]">*</span>
            </label>
            <input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="jane@example.com"
              disabled={isEdit}
              data-testid="user-email-input"
            />
            {isEdit && (
              <p className="mt-1 text-xs text-foreground-muted">Email cannot be changed after creation</p>
            )}
            {errors.email && <p className="mt-1 text-xs text-[var(--destructive)]">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="user-role" className="block text-sm font-medium text-foreground">
              Role <span className="text-[var(--destructive)]">*</span>
            </label>
            <select
              id="user-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              data-testid="user-role-select"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {errors.role && <p className="mt-1 text-xs text-[var(--destructive)]">{errors.role}</p>}
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
              data-testid="user-submit-button"
            >
              {submitting ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
