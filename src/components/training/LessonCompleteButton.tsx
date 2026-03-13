'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface LessonCompleteButtonProps {
  lessonId: string
  courseSlug: string
  basePath: string
  isCompleted: boolean
  hasQuiz: boolean
  quizPassed: boolean
}

export default function LessonCompleteButton({
  lessonId,
  courseSlug,
  basePath,
  isCompleted,
  hasQuiz,
  quizPassed,
}: LessonCompleteButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [courseComplete, setCourseComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(isCompleted)

  async function handleComplete() {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/training/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data.error ?? 'Failed to mark lesson as complete')
        return
      }

      const data = await response.json()
      setCompleted(true)

      if (data.courseCompleted) {
        setCourseComplete(true)
      } else if (data.nextLessonSlug) {
        router.push(`${basePath}/${courseSlug}/${data.nextLessonSlug}`)
      }

      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Already completed
  if (completed) {
    return (
      <div data-testid="lesson-complete-button">
        {courseComplete && (
          <p className="mb-2 text-sm font-medium text-accent">
            Course Complete!
          </p>
        )}
        <button
          disabled
          className="inline-flex items-center gap-2 rounded-lg bg-success/10 px-4 py-2.5
            text-sm font-medium text-success cursor-default"
        >
          <CheckIcon />
          Lesson Completed
        </button>
      </div>
    )
  }

  // Has quiz but not passed
  if (hasQuiz && !quizPassed) {
    return (
      <div data-testid="lesson-complete-button">
        <button
          disabled
          className="inline-flex items-center gap-2 rounded-lg bg-muted border border-border
            px-4 py-2.5 text-sm font-medium text-foreground-muted cursor-not-allowed"
        >
          Complete Quiz First
        </button>
      </div>
    )
  }

  // Ready to complete
  return (
    <div data-testid="lesson-complete-button">
      {error && (
        <p className="mb-2 text-sm text-destructive">{error}</p>
      )}
      <button
        onClick={handleComplete}
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded-lg bg-accent text-background
          px-4 py-2.5 text-sm font-medium hover:bg-accent-hover
          focus:shadow-accent-glow focus:outline-none
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors"
      >
        {isLoading ? (
          <>
            <LoadingSpinner />
            Saving...
          </>
        ) : (
          'Mark as Complete'
        )}
      </button>
    </div>
  )
}

// -- Inline SVG icons --

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function LoadingSpinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="opacity-25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="opacity-75"
      />
    </svg>
  )
}
