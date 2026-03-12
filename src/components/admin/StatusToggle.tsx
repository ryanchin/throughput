'use client'

import { useState } from 'react'
import type { ContentStatus, ContentType } from '@/lib/admin/content-validation'

interface StatusToggleProps {
  contentType: ContentType
  contentId: string
  currentStatus: ContentStatus
  onStatusChange?: (newStatus: ContentStatus) => void
}

export function StatusToggle({ contentType, contentId, currentStatus, onStatusChange }: StatusToggleProps) {
  const [status, setStatus] = useState<ContentStatus>(currentStatus)
  const [loading, setLoading] = useState(false)
  const isPublished = status === 'published'

  async function handleToggle() {
    const newStatus: ContentStatus = isPublished ? 'draft' : 'published'
    setLoading(true)

    try {
      const res = await fetch('/api/admin/content/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType, contentId, status: newStatus }),
      })

      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to update status')
        return
      }

      setStatus(newStatus)
      onStatusChange?.(newStatus)
    } catch {
      alert('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background ${
        isPublished ? 'bg-success' : 'bg-[var(--background-muted)]'
      } ${loading ? 'opacity-50' : ''}`}
      role="switch"
      aria-checked={isPublished}
      data-testid={`status-toggle-${contentId}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
          isPublished ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
      <span className="sr-only">{isPublished ? 'Unpublish' : 'Publish'}</span>
    </button>
  )
}
