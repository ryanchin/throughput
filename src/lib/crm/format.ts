/** Format a number as USD currency with commas */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/** Format a date as a relative string ("2 days ago") or short date ("Apr 6") */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Format a date as short date string ("Apr 6, 2024") */
export function formatShortDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Get velocity color class based on days since last activity */
export function getVelocityColor(lastActivityDate: string | null): 'green' | 'yellow' | 'red' {
  if (!lastActivityDate) return 'red'
  const days = Math.floor(
    (Date.now() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (days <= 7) return 'green'
  if (days <= 14) return 'yellow'
  return 'red'
}

/** Velocity dot CSS classes */
export const velocityClasses: Record<string, string> = {
  green: 'bg-[var(--success)]',
  yellow: 'bg-[var(--warning)]',
  red: 'bg-[var(--destructive)]',
}
