'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { SectionPaginator } from '@/components/training/SectionPaginator'
import LessonNav from '@/components/training/LessonNav'
import type { ContentPage } from '@/lib/training/content-splitter'

interface PaginatedLessonProps {
  pages: ContentPage[]
  initialPage?: number
  quizUrl?: string
  hasQuiz: boolean
  hasPassedQuiz: boolean
  completeButton: React.ReactNode
  courseTitle: string
  courseSlug: string
  basePath: string
  lessonNavProps: {
    lessons: Array<{ id: string; title: string; slug: string; order_index: number }>
    lessonProgress: Array<{ lesson_id: string; completed_at: string | null }>
    quizInfo: Array<{ lessonId: string; passed: boolean }>
    currentLessonSlug: string
    courseSlug: string
    basePath: string
    navigationMode: 'sequential' | 'free'
    currentLessonPageTitles: string[]
    currentLessonHasQuiz: boolean
  }
}

export function PaginatedLesson({
  lessonNavProps,
  courseTitle,
  courseSlug,
  basePath,
  ...paginatorProps
}: PaginatedLessonProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(paginatorProps.initialPage ?? 0)

  const handlePageChange = useCallback((index: number) => {
    setCurrentPageIndex(index)
  }, [])

  const handleTocPageClick = useCallback((pageIndex: number) => {
    setCurrentPageIndex(pageIndex)
  }, [])

  return (
    <div className="flex gap-0 lg:gap-8">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-24 space-y-4">
          <Link
            href={`${basePath}/${courseSlug}`}
            className="flex items-center gap-2 text-sm text-foreground-muted hover:text-accent transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {courseTitle}
          </Link>
          <div className="bg-surface border border-border rounded-xl shadow-card p-3">
            <LessonNav
              {...lessonNavProps}
              currentPageIndex={currentPageIndex}
              onPageClick={handleTocPageClick}
            />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <SectionPaginator
          {...paginatorProps}
          currentPageOverride={currentPageIndex}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  )
}
