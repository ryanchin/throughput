'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import LessonViewer from '@/components/editor/LessonViewer'
import type { JSONContent } from '@tiptap/react'
import type { ContentPage } from '@/lib/training/content-splitter'

interface SectionPaginatorProps {
  pages: ContentPage[]
  quizUrl?: string
  hasQuiz: boolean
  hasPassedQuiz: boolean
  completeButton: React.ReactNode
  onPageChange?: (pageIndex: number) => void
}

export function SectionPaginator({
  pages,
  quizUrl,
  hasQuiz,
  hasPassedQuiz,
  completeButton,
  onPageChange,
}: SectionPaginatorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const contentRef = useRef<HTMLDivElement>(null)
  const [transitioning, setTransitioning] = useState(false)

  const totalPages = pages.length

  // Derive current page from URL — single source of truth
  const urlPageParam = searchParams.get('page')
  const currentPage = Math.max(0, Math.min(
    (urlPageParam ? parseInt(urlPageParam, 10) - 1 : 0),
    totalPages - 1
  ))

  const isFirstPage = currentPage === 0
  const isLastContentPage = currentPage === totalPages - 1
  const page = pages[currentPage]

  // Notify parent when page changes
  useEffect(() => {
    onPageChange?.(currentPage)
  }, [currentPage, onPageChange])

  const goToPage = useCallback((index: number) => {
    if (index < 0 || index >= totalPages) return
    setTransitioning(true)
    // Brief fade-out, then update URL (which updates currentPage via searchParams)
    setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', String(index + 1))
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      setTransitioning(false)
      contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 75)
  }, [totalPages, searchParams, router, pathname])

  const goNext = useCallback(() => {
    if (isLastContentPage && hasQuiz && !hasPassedQuiz && quizUrl) {
      router.push(quizUrl)
      return
    }
    goToPage(currentPage + 1)
  }, [currentPage, isLastContentPage, hasQuiz, hasPassedQuiz, quizUrl, router, goToPage])

  const goPrev = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage])

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if ((e.target as HTMLElement)?.isContentEditable) return

      if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev])

  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

  // Single page — no paginator
  if (totalPages <= 1 && !hasQuiz) {
    return (
      <div>
        {page?.content && <LessonViewer content={page.content as JSONContent} />}
        <div className="mt-8 pt-6 border-t border-border">
          {completeButton}
        </div>
      </div>
    )
  }

  return (
    <div ref={contentRef}>
      {/* Progress bar */}
      <div
        className="h-0.5 bg-muted rounded-full w-full mb-6"
        role="progressbar"
        aria-valuenow={currentPage + 1}
        aria-valuemin={1}
        aria-valuemax={totalPages}
        aria-label={`Page ${currentPage + 1} of ${totalPages}`}
      >
        <div
          className="h-0.5 bg-accent rounded-full transition-all duration-300"
          style={{ width: `${((currentPage + 1) / totalPages) * 100}%` }}
        />
      </div>

      {/* Page content with transition */}
      <div
        className={prefersReducedMotion ? '' : 'transition-opacity duration-150 ease-in-out'}
        style={{ opacity: transitioning ? 0 : 1 }}
        aria-live="polite"
      >
        {page?.content && <LessonViewer content={page.content as JSONContent} />}
      </div>

      {/* Pagination bar */}
      <nav
        className="flex items-center justify-between pt-8 mt-8 border-t border-border"
        role="navigation"
        aria-label="Lesson page navigation"
      >
        <div className="w-32">
          {!isFirstPage && (
            <button
              onClick={goPrev}
              className="border border-border bg-background text-foreground rounded-lg px-4 py-2 hover:border-accent/30 hover:text-accent transition-colors text-sm"
              aria-label="Previous page"
            >
              ← Previous
            </button>
          )}
        </div>

        <span className="text-sm text-foreground-muted">
          Page {currentPage + 1} of {totalPages}
        </span>

        <div className="w-32 flex justify-end">
          {isLastContentPage ? (
            hasQuiz && !hasPassedQuiz && quizUrl ? (
              <button
                onClick={() => router.push(quizUrl)}
                className="bg-accent text-background rounded-lg px-4 py-2 hover:bg-accent-hover transition-colors text-sm font-medium"
                aria-label="Take quiz"
              >
                Take Quiz →
              </button>
            ) : (
              <div>{completeButton}</div>
            )
          ) : (
            <button
              onClick={goNext}
              className="bg-accent text-background rounded-lg px-4 py-2 hover:bg-accent-hover transition-colors text-sm font-medium"
              aria-label={`Next page: ${pages[currentPage + 1]?.title ?? 'next'}`}
            >
              Next →
            </button>
          )}
        </div>
      </nav>
    </div>
  )
}
