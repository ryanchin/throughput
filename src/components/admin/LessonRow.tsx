'use client'

import { StatusBadge } from './StatusBadge'
import { StatusToggle } from './StatusToggle'
import type { ContentStatus } from '@/lib/admin/content-validation'

interface LessonRowProps {
  id: string
  title: string
  status: ContentStatus
  orderIndex: number
  onStatusChange?: (newStatus: ContentStatus) => void
}

export function LessonRow({ id, title, status, orderIndex, onStatusChange }: LessonRowProps) {
  return (
    <div
      className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
      data-testid={`lesson-row-${id}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono text-foreground-subtle">{orderIndex + 1}</span>
        <span className="text-sm font-medium text-foreground">{title}</span>
        <StatusBadge status={status} />
      </div>
      <StatusToggle
        contentType="lesson"
        contentId={id}
        currentStatus={status}
        onStatusChange={onStatusChange}
      />
    </div>
  )
}
