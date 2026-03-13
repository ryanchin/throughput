'use client'

import Link from 'next/link'
import { formatDuration } from '@/lib/training/progress'
import { cn } from '@/lib/utils'

interface CourseCardProps {
  course: {
    id: string
    title: string
    slug: string
    description: string | null
    zone: 'training' | 'sales'
    cover_image_url: string | null
    lesson_count: number
    total_duration_minutes: number
    completed_lesson_count: number
    enrollment: { id: string; enrolled_at: string; completed_at: string | null } | null
  }
  basePath: string
}

export default function CourseCard({ course, basePath }: CourseCardProps) {
  const {
    title,
    slug,
    description,
    zone,
    cover_image_url,
    lesson_count,
    total_duration_minutes,
    completed_lesson_count,
    enrollment,
  } = course

  const isEnrolled = !!enrollment
  const isCompleted = !!enrollment?.completed_at
  const progressPercent =
    isEnrolled && lesson_count > 0
      ? Math.round((completed_lesson_count / lesson_count) * 100)
      : 0

  return (
    <Link
      href={`${basePath}/${slug}`}
      data-testid="course-card"
      data-course-slug={slug}
      className="group block bg-surface border border-border rounded-xl shadow-card
        transition-all hover:border-accent/30 hover:shadow-accent-glow"
    >
      {/* Cover image or gradient placeholder */}
      <div className="relative h-40 rounded-t-xl overflow-hidden">
        {cover_image_url ? (
          <img
            src={cover_image_url}
            alt={`${title} cover`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-brand opacity-20" />
        )}

        {/* Zone badge */}
        <span
          className={cn(
            'absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-xs font-medium',
            zone === 'training'
              ? 'bg-accent-muted text-accent'
              : 'bg-secondary-muted text-secondary'
          )}
        >
          {zone === 'training' ? 'Training' : 'Sales'}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <h3 className="text-lg font-semibold text-foreground group-hover:text-accent transition-colors line-clamp-1">
          {title}
        </h3>

        {description && (
          <p className="text-sm text-foreground-muted line-clamp-2">{description}</p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-foreground-muted">
          <span className="flex items-center gap-1">
            <BookIcon />
            {lesson_count} {lesson_count === 1 ? 'lesson' : 'lessons'}
          </span>
          <span className="flex items-center gap-1">
            <ClockIcon />
            {formatDuration(total_duration_minutes)}
          </span>
        </div>

        {/* Progress bar (enrolled, not completed) */}
        {isEnrolled && !isCompleted && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground-muted">
                {completed_lesson_count}/{lesson_count} lessons
              </span>
              <span className="text-accent font-medium">{progressPercent}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Action button */}
        <div className="pt-1">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
              <CheckIcon />
              Completed
            </span>
          ) : isEnrolled ? (
            <span className="inline-flex items-center rounded-lg bg-accent text-background px-3 py-1.5 text-sm font-medium group-hover:bg-accent-hover transition-colors">
              Continue
            </span>
          ) : (
            <span className="inline-flex items-center rounded-lg bg-accent text-background px-3 py-1.5 text-sm font-medium group-hover:bg-accent-hover shadow-accent-glow transition-colors">
              Start Course
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// -- Inline SVG icons (small, no extra dependency) --

function BookIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
