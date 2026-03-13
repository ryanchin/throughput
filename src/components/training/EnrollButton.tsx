'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface EnrollButtonProps {
  courseId: string
  courseSlug: string
  firstLessonSlug: string | null
  basePath: string
  isEnrolled: boolean
  nextLessonSlug: string | null
}

export default function EnrollButton({
  courseId,
  courseSlug,
  firstLessonSlug,
  basePath,
  isEnrolled,
  nextLessonSlug,
}: EnrollButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleEnroll() {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/training/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data.error ?? 'Failed to enroll')
        return
      }

      // Navigate to first lesson after enrollment
      const targetSlug = firstLessonSlug
      if (targetSlug) {
        router.push(`${basePath}/${courseSlug}/${targetSlug}`)
      } else {
        router.refresh()
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleContinue() {
    const targetSlug = nextLessonSlug ?? firstLessonSlug
    if (targetSlug) {
      router.push(`${basePath}/${courseSlug}/${targetSlug}`)
    }
  }

  if (isEnrolled) {
    return (
      <div data-testid="enroll-button">
        <button
          onClick={handleContinue}
          className="inline-flex items-center gap-2 rounded-lg bg-accent text-background
            px-6 py-3 text-sm font-semibold hover:bg-accent-hover
            focus:shadow-accent-glow focus:outline-none transition-colors"
        >
          <PlayIcon />
          Continue Learning
        </button>
      </div>
    )
  }

  return (
    <div data-testid="enroll-button">
      {error && (
        <p className="mb-2 text-sm text-destructive">{error}</p>
      )}
      <button
        onClick={handleEnroll}
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded-lg bg-accent text-background
          px-6 py-3 text-sm font-semibold hover:bg-accent-hover
          shadow-accent-glow focus:outline-none
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors"
      >
        {isLoading ? (
          <>
            <LoadingSpinner />
            Enrolling...
          </>
        ) : (
          <>
            <RocketIcon />
            Start Course
          </>
        )}
      </button>
    </div>
  )
}

// -- Inline SVG icons --

function PlayIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function RocketIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
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
