'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { isLessonAccessible } from '@/lib/training/progress'

interface LessonNavProps {
  lessons: Array<{
    id: string
    title: string
    slug: string
    order_index: number
  }>
  lessonProgress: Array<{
    lesson_id: string
    completed_at: string | null
  }>
  quizInfo: Array<{
    lessonId: string
    passed: boolean
  }>
  currentLessonSlug: string
  courseSlug: string
  basePath: string
  navigationMode: 'sequential' | 'free'
  /** Page titles for the currently active lesson (from extractPageTitles). */
  currentLessonPageTitles?: string[]
  /** Whether the current lesson has a quiz. */
  currentLessonHasQuiz?: boolean
}

export default function LessonNav({
  lessons,
  lessonProgress,
  quizInfo,
  currentLessonSlug,
  courseSlug,
  basePath,
  navigationMode,
  currentLessonPageTitles = [],
  currentLessonHasQuiz = false,
}: LessonNavProps) {
  const completedLessonIds = lessonProgress
    .filter((p) => p.completed_at !== null)
    .map((p) => p.lesson_id)

  const completedSet = new Set(completedLessonIds)
  const lessonIds = lessons.map((l) => l.id)
  const quizMap = new Map(quizInfo.map((q) => [q.lessonId, q.passed]))

  return (
    <nav data-testid="lesson-nav" aria-label="Lesson navigation">
      <ul className="space-y-0.5" role="list">
        {lessons.map((lesson, index) => {
          const isCurrent = lesson.slug === currentLessonSlug
          const isCompleted = completedSet.has(lesson.id)
          const accessible = isLessonAccessible(
            index,
            completedLessonIds,
            lessonIds,
            navigationMode
          )
          const lessonHasQuiz = quizMap.has(lesson.id)

          const content = (
            <div
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isCurrent && 'bg-accent-muted text-foreground font-semibold',
                !isCurrent && accessible && 'text-foreground-muted hover:bg-muted hover:text-foreground',
                !isCurrent && !accessible && 'text-foreground-subtle cursor-not-allowed'
              )}
            >
              <span className="flex-shrink-0 w-5 flex items-center justify-center">
                {isCompleted ? (
                  <CheckCircleIcon />
                ) : isCurrent ? (
                  <CurrentDotIcon />
                ) : accessible ? (
                  <EmptyCircleIcon />
                ) : (
                  <LockIcon />
                )}
              </span>

              <span className="flex-1 min-w-0">
                <span className="text-foreground-subtle text-xs mr-1.5">
                  {index + 1}.
                </span>
                <span className="break-words">{lesson.title}</span>
              </span>

              {lessonHasQuiz && (
                <span
                  className={cn(
                    'flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                    quizMap.get(lesson.id)
                      ? 'bg-success/10 text-success'
                      : 'bg-warning/10 text-warning'
                  )}
                >
                  Quiz
                </span>
              )}
            </div>
          )

          return (
            <li key={lesson.id} data-testid={`lesson-nav-item-${lesson.slug}`}>
              {accessible && !isCurrent ? (
                <Link href={`${basePath}/${courseSlug}/${lesson.slug}`}>
                  {content}
                </Link>
              ) : (
                content
              )}

              {/* Page-level TOC for the active module */}
              {isCurrent && currentLessonPageTitles.length > 1 && (
                <ul className="ml-8 mt-1 mb-2 space-y-0.5 border-l border-border pl-3 overflow-hidden" role="list">
                  {currentLessonPageTitles.map((pageTitle, pageIndex) => (
                    <li key={pageIndex}>
                      <PageTocItem
                        title={pageTitle}
                        pageIndex={pageIndex}
                        basePath={basePath}
                        courseSlug={courseSlug}
                        lessonSlug={lesson.slug}
                      />
                    </li>
                  ))}
                  {currentLessonHasQuiz && (
                    <li>
                      <Link
                        href={`${basePath}/${courseSlug}/${lesson.slug}/quiz`}
                        className="flex items-center gap-1.5 py-1 text-xs text-foreground-muted hover:text-accent transition-colors"
                      >
                        <span>📝</span>
                        <span>Quiz</span>
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Individual page item in the TOC — uses client-side navigation via query param. */
function PageTocItem({
  title,
  pageIndex,
  basePath,
  courseSlug,
  lessonSlug,
}: {
  title: string
  pageIndex: number
  basePath: string
  courseSlug: string
  lessonSlug: string
}) {
  return (
    <Link
      href={`${basePath}/${courseSlug}/${lessonSlug}?page=${pageIndex + 1}`}
      className="block py-1 text-xs text-foreground-muted hover:text-accent transition-colors break-words"
      data-testid={`page-toc-item-${pageIndex}`}
    >
      {title}
    </Link>
  )
}

// -- Inline SVG icons --

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function CurrentDotIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="5" fill="var(--accent)" />
    </svg>
  )
}

function EmptyCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
