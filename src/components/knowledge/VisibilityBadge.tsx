import type { Visibility } from '@/lib/supabase/database.types'

interface VisibilityBadgeProps {
  visibility: Visibility
}

export function VisibilityBadge({ visibility }: VisibilityBadgeProps) {
  if (visibility === 'public') {
    return (
      <span className="inline-flex items-center rounded-full bg-success-muted px-2 py-0.5 text-xs font-medium text-success">
        Public
      </span>
    )
  }

  if (visibility === 'internal') {
    return (
      <span className="inline-flex items-center rounded-full bg-accent-muted px-2 py-0.5 text-xs font-medium text-accent">
        Internal
      </span>
    )
  }

  if (visibility.startsWith('group:')) {
    const groupName = visibility.slice(6)
    return (
      <span className="inline-flex items-center rounded-full bg-secondary-muted px-2 py-0.5 text-xs font-medium text-secondary">
        {groupName}
      </span>
    )
  }

  return null
}
