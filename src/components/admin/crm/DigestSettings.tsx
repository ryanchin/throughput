'use client'

import { useState, useEffect } from 'react'

interface DigestPreferences {
  user_id: string
  enabled: boolean
  send_time: string
  timezone: string
  updated_at: string
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
] as const

const TIMEZONE_LABELS: Record<string, string> = {
  'America/New_York': 'Eastern (ET)',
  'America/Chicago': 'Central (CT)',
  'America/Denver': 'Mountain (MT)',
  'America/Los_Angeles': 'Pacific (PT)',
  'America/Phoenix': 'Arizona (MST)',
  'America/Anchorage': 'Alaska (AKT)',
  'Pacific/Honolulu': 'Hawaii (HST)',
  'UTC': 'UTC',
}

const SEND_TIMES = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0')
  const label = i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`
  return { value: `${hour}:00`, label }
})

export function DigestSettings() {
  const [prefs, setPrefs] = useState<DigestPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Form state
  const [enabled, setEnabled] = useState(true)
  const [sendTime, setSendTime] = useState('08:00')
  const [timezone, setTimezone] = useState('America/Los_Angeles')

  useEffect(() => {
    async function fetchPrefs() {
      try {
        const res = await fetch('/api/admin/crm/digest/preferences')
        if (!res.ok) throw new Error('Failed to load preferences')
        const data = await res.json()
        const p = data.preferences
        setPrefs(p)
        setEnabled(p.enabled)
        setSendTime(p.send_time)
        setTimezone(p.timezone)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preferences')
      } finally {
        setLoading(false)
      }
    }
    fetchPrefs()
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const res = await fetch('/api/admin/crm/digest/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, send_time: sendTime, timezone }),
      })
      if (!res.ok) throw new Error('Failed to save preferences')
      const data = await res.json()
      setPrefs(data.preferences)
      setSuccessMessage('Preferences saved successfully.')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
        <div className="space-y-4">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-card" data-testid="digest-settings">
      {error && (
        <div className="mb-4 rounded-lg border border-[var(--destructive)] bg-[var(--destructive-muted)] px-4 py-3 text-sm text-[var(--destructive)]" data-testid="digest-error">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 rounded-lg border border-[var(--success)] bg-[var(--success-muted)] px-4 py-3 text-sm text-[var(--success)]" data-testid="digest-success">
          {successMessage}
        </div>
      )}

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Daily Digest Email</h3>
          <p className="text-xs text-foreground-muted mt-1">
            Receive a daily email with stale deals, overdue tasks, and upcoming rolloffs.
          </p>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-accent' : 'bg-muted border border-border'
          }`}
          data-testid="digest-toggle"
          aria-label={enabled ? 'Disable digest' : 'Enable digest'}
        >
          <span
            className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <>
          {/* Send Time */}
          <div className="mb-4">
            <label htmlFor="send-time" className="block text-sm font-medium text-foreground mb-1.5">
              Send Time
            </label>
            <select
              id="send-time"
              value={sendTime}
              onChange={(e) => setSendTime(e.target.value)}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              data-testid="digest-send-time"
            >
              {SEND_TIMES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Timezone */}
          <div className="mb-6">
            <label htmlFor="timezone" className="block text-sm font-medium text-foreground mb-1.5">
              Timezone
            </label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              data-testid="digest-timezone"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{TIMEZONE_LABELS[tz]}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow disabled:opacity-50"
        data-testid="digest-save"
      >
        {saving ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  )
}
