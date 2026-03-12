'use client'

import { useState } from 'react'
import { StatusBadge } from './StatusBadge'
import { PublishPreflightModal } from './PublishPreflightModal'
import type { ContentStatus } from '@/lib/admin/content-validation'

interface CourseCardProps {
  id: string
  title: string
  description: string | null
  zone: string
  status: ContentStatus
  slug: string
  updatedAt: string
}

export function CourseCard({ id, title, description, zone, status: initialStatus, slug, updatedAt }: CourseCardProps) {
  const [status, setStatus] = useState<ContentStatus>(initialStatus)
  const [showPreflight, setShowPreflight] = useState(false)

  async function handlePublish(publishAll: boolean) {
    if (publishAll) {
      // First publish all lessons
      const preflightRes = await fetch(`/api/admin/content/preflight?contentType=course&contentId=${id}`)
      const preflight = await preflightRes.json()

      for (const lesson of preflight.unpublishedLessons) {
        await fetch('/api/admin/content/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentType: 'lesson', contentId: lesson.id, status: 'published' }),
        })
      }
    }

    // Then publish the course
    const res = await fetch('/api/admin/content/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: 'course', contentId: id, status: 'published' }),
    })

    if (res.ok) {
      setStatus('published')
    } else {
      const err = await res.json()
      throw new Error(err.error)
    }
  }

  async function handleUnpublish() {
    const res = await fetch('/api/admin/content/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: 'course', contentId: id, status: 'draft' }),
    })

    if (res.ok) {
      setStatus('draft')
    }
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card" data-testid={`course-card-${slug}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              <StatusBadge status={status} />
            </div>
            {description && (
              <p className="mt-1 text-sm text-foreground-muted line-clamp-2">{description}</p>
            )}
            <div className="mt-3 flex items-center gap-3 text-xs text-foreground-subtle">
              <span className="rounded bg-[var(--background-muted)] px-2 py-0.5 capitalize">{zone}</span>
              <span>Updated {new Date(updatedAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="ml-4 flex items-center gap-2">
            {status === 'draft' ? (
              <button
                onClick={() => setShowPreflight(true)}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-background hover:bg-accent-hover"
                data-testid={`publish-button-${slug}`}
              >
                Publish
              </button>
            ) : (
              <button
                onClick={handleUnpublish}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground"
                data-testid={`unpublish-button-${slug}`}
              >
                Unpublish
              </button>
            )}
          </div>
        </div>
      </div>

      <PublishPreflightModal
        courseId={id}
        courseTitle={title}
        isOpen={showPreflight}
        onClose={() => setShowPreflight(false)}
        onPublish={handlePublish}
      />
    </>
  )
}
