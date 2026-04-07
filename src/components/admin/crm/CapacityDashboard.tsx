'use client'

import { useState, useEffect } from 'react'

interface CapacityData {
  total_active: number
  placed: number
  bench: number
  rolling_off_30d: number
  rolling_off_60d: number
  open_roles: number
  overdue_roles: number
  active_candidates: number
}

interface StatCardProps {
  label: string
  value: number
  borderClass?: string
}

function StatCard({ label, value, borderClass }: StatCardProps) {
  return (
    <div className={`rounded-xl border bg-surface p-5 shadow-card ${borderClass || 'border-border'}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
    </div>
  )
}

export function CapacityDashboard() {
  const [capacity, setCapacity] = useState<CapacityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCapacity() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/crm/consultants/capacity')
        if (!res.ok) throw new Error('Failed to load capacity data')
        const data = await res.json()
        setCapacity(data.capacity ?? null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load capacity data')
      } finally {
        setLoading(false)
      }
    }
    fetchCapacity()
  }, [])

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-foreground-muted">
        {error}
      </div>
    )
  }

  if (loading || !capacity) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-7 w-12 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total Active" value={capacity.total_active} />
      <StatCard label="Currently Placed" value={capacity.placed} />
      <StatCard
        label="On Bench"
        value={capacity.bench}
        borderClass={capacity.bench > 0 ? 'border-[var(--warning)]' : 'border-border'}
      />
      <StatCard
        label="Rolling Off (30d)"
        value={capacity.rolling_off_30d}
        borderClass={capacity.rolling_off_30d > 0 ? 'border-[var(--warning)]' : 'border-border'}
      />
      <StatCard label="Rolling Off (60d)" value={capacity.rolling_off_60d} />
      <StatCard label="Open Roles" value={capacity.open_roles} />
      <StatCard
        label="Overdue Roles"
        value={capacity.overdue_roles}
        borderClass={capacity.overdue_roles > 0 ? 'border-[var(--destructive)]' : 'border-border'}
      />
      <StatCard label="Active Candidates" value={capacity.active_candidates} />
    </div>
  )
}
