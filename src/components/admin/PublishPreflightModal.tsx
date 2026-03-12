'use client'

import { useState, useEffect } from 'react'

interface UnpublishedLesson {
  id: string
  title: string
  status: string
}

interface PreflightData {
  totalLessons: number
  publishedLessons: number
  unpublishedLessons: UnpublishedLesson[]
  canPublish: boolean
}

interface PublishPreflightModalProps {
  courseId: string
  courseTitle: string
  isOpen: boolean
  onClose: () => void
  onPublish: (publishAll: boolean) => Promise<void>
}

export function PublishPreflightModal({
  courseId,
  courseTitle,
  isOpen,
  onClose,
  onPublish,
}: PublishPreflightModalProps) {
  const [preflight, setPreflight] = useState<PreflightData | null>(null)
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setPreflight(null)
      return
    }

    setLoading(true)
    fetch(`/api/admin/content/preflight?contentType=course&contentId=${courseId}`)
      .then(res => res.json())
      .then(data => setPreflight(data))
      .catch(() => setPreflight(null))
      .finally(() => setLoading(false))
  }, [isOpen, courseId])

  if (!isOpen) return null

  async function handlePublish(publishAll: boolean) {
    setPublishing(true)
    try {
      await onPublish(publishAll)
      onClose()
    } catch {
      alert('Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="preflight-modal">
      <div className="w-full max-w-lg rounded-xl border border-border bg-raised p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">
          Publish &quot;{courseTitle}&quot;
        </h2>

        {loading && (
          <p className="mt-4 text-sm text-foreground-muted">Checking publish readiness...</p>
        )}

        {preflight && (
          <div className="mt-4 space-y-4">
            {/* Summary */}
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-sm text-foreground">
                <span className="font-medium text-success">{preflight.publishedLessons}</span>
                {' / '}
                <span className="font-medium">{preflight.totalLessons}</span>
                {' lessons are published'}
              </p>
            </div>

            {/* Unpublished lessons warning */}
            {preflight.unpublishedLessons.length > 0 && (
              <div className="rounded-lg border border-[var(--warning)] border-opacity-30 bg-[var(--warning-muted)] p-3">
                <p className="mb-2 text-sm font-medium text-warning">
                  {preflight.unpublishedLessons.length} unpublished lesson(s):
                </p>
                <ul className="space-y-1">
                  {preflight.unpublishedLessons.map(lesson => (
                    <li key={lesson.id} className="text-sm text-foreground-muted">
                      • {lesson.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Can't publish */}
            {!preflight.canPublish && (
              <p className="text-sm text-destructive">
                Cannot publish: at least one lesson must be published first.
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-raised"
          >
            Cancel
          </button>
          {preflight?.unpublishedLessons && preflight.unpublishedLessons.length > 0 && preflight.canPublish && (
            <button
              onClick={() => handlePublish(true)}
              disabled={publishing}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover disabled:opacity-50"
              data-testid="publish-all-button"
            >
              {publishing ? 'Publishing...' : 'Publish All Lessons & Course'}
            </button>
          )}
          {preflight?.canPublish && preflight?.unpublishedLessons?.length === 0 && (
            <button
              onClick={() => handlePublish(false)}
              disabled={publishing}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover disabled:opacity-50"
              data-testid="publish-course-button"
            >
              {publishing ? 'Publishing...' : 'Publish Course'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
