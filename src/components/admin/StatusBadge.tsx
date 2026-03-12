import type { ContentStatus } from '@/lib/admin/content-validation'

interface StatusBadgeProps {
  status: ContentStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (status === 'published') {
    return (
      <span
        className="inline-flex items-center rounded-full bg-[var(--success-muted)] px-2.5 py-0.5 text-xs font-medium text-success"
        data-testid="status-badge-published"
      >
        PUBLISHED
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center rounded-full bg-[var(--warning-muted)] px-2.5 py-0.5 text-xs font-medium text-warning"
      data-testid="status-badge-draft"
    >
      DRAFT
    </span>
  )
}
