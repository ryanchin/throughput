'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CourseActionsProps {
  courseId: string
  courseTitle: string
}

export function CourseActions({ courseId, courseTitle }: CourseActionsProps) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to delete course')
        return
      }

      router.refresh()
    } catch {
      alert('Failed to delete course. Please try again.')
    } finally {
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <a
          href={`/admin/courses/${courseId}`}
          className="rounded-md px-2.5 py-1.5 text-sm font-medium text-accent hover:bg-accent-muted transition-colors"
          data-testid={`edit-course-${courseId}`}
        >
          Edit
        </a>
        <button
          onClick={() => setShowConfirm(true)}
          className="rounded-md px-2.5 py-1.5 text-sm font-medium text-[var(--destructive)] hover:bg-[var(--destructive-muted)] transition-colors"
          data-testid={`delete-course-${courseId}`}
        >
          Delete
        </button>
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          data-testid="delete-confirm-dialog"
        >
          <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-card">
            <h3 className="text-lg font-semibold text-foreground">
              Delete Course
            </h3>
            <p className="mt-2 text-sm text-foreground-muted">
              Are you sure you want to delete{' '}
              <span className="font-medium text-foreground">{courseTitle}</span>?
              This will permanently remove the course and all its lessons. This action cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-raised transition-colors disabled:opacity-50"
                data-testid="delete-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-lg bg-[var(--destructive)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                data-testid="delete-confirm"
              >
                {isDeleting ? 'Deleting...' : 'Delete Course'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
