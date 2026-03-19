import { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getLessonData } from '@/lib/training/data'
import { calculateProgress } from '@/lib/training/progress'
import { splitContentIntoPages, extractPageTitles } from '@/lib/training/content-splitter'
import LessonNav from '@/components/training/LessonNav'
import LessonCompleteButton from '@/components/training/LessonCompleteButton'
import { PaginatedLesson } from './PaginatedLesson'
import type { JSONContent } from '@tiptap/react'

export default async function TrainingLessonPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>
}) {
  const { courseSlug, lessonSlug } = await params
  const data = await getLessonData(courseSlug, lessonSlug, 'training')

  if (!data) {
    const { getProfile } = await import('@/lib/auth/getProfile')
    const profile = await getProfile()
    if (!profile) redirect('/login')
    notFound()
  }

  const {
    course,
    lesson,
    lessons,
    completedLessonIds,
    isCurrentLessonCompleted,
    hasQuiz,
    hasPassedQuiz,
  } = data

  const completedSet = new Set(completedLessonIds)
  const totalLessons = lessons.length
  const completedCount = completedLessonIds.length
  const progress = calculateProgress(completedCount, totalLessons)
  const currentIndex = lessons.findIndex((l) => l.slug === lessonSlug)
  const lessonNumber = currentIndex + 1

  // Split content into pages at ## heading boundaries
  const pages = splitContentIntoPages(lesson.content as JSONContent | null)
  const pageTitles = extractPageTitles(lesson.content as JSONContent | null)

  // Build props for LessonNav
  const lessonProgress = lessons.map((l) => ({
    lesson_id: l.id,
    completed_at: completedSet.has(l.id) ? 'completed' : null,
  }))

  const quizInfo = lessons
    .filter((l) => l.hasQuiz)
    .map((l) => ({
      lessonId: l.id,
      passed: l.id === lesson.id ? hasPassedQuiz : false,
    }))

  const quizUrl = hasQuiz ? `/training/${courseSlug}/${lessonSlug}/quiz` : undefined

  return (
    <div data-testid="lesson-page" className="flex gap-0 lg:gap-8">
      {/* Left sidebar - lesson navigation */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-24 space-y-4">
          <Link
            href={`/training/${courseSlug}`}
            className="flex items-center gap-2 text-sm text-foreground-muted hover:text-accent transition-colors"
          >
            <BackIcon />
            {course.title}
          </Link>
          <div className="bg-surface border border-border rounded-xl shadow-card p-3">
            <LessonNav
              lessons={lessons}
              lessonProgress={lessonProgress}
              quizInfo={quizInfo}
              currentLessonSlug={lessonSlug}
              courseSlug={courseSlug}
              basePath="/training"
              navigationMode={course.navigation_mode}
              currentLessonPageTitles={pageTitles}
              currentLessonHasQuiz={hasQuiz}
            />
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Course progress bar */}
        <div className="bg-surface border border-border rounded-xl shadow-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-foreground-muted">
              Module {lessonNumber} of {totalLessons}
            </span>
            <span className="text-sm font-medium text-accent">{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Module title */}
        <h1 className="text-3xl font-bold text-foreground">{lesson.title}</h1>

        {/* Paginated content */}
        {lesson.content ? (
          <Suspense fallback={<div className="h-40 bg-muted rounded-lg animate-pulse" />}>
            <PaginatedLesson
              pages={pages}
              quizUrl={quizUrl}
              hasQuiz={hasQuiz}
              hasPassedQuiz={hasPassedQuiz}
              completeButton={
                <LessonCompleteButton
                  lessonId={lesson.id}
                  courseSlug={courseSlug}
                  basePath="/training"
                  isCompleted={isCurrentLessonCompleted}
                  hasQuiz={hasQuiz}
                  quizPassed={hasPassedQuiz}
                />
              }
            />
          </Suspense>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="text-foreground-muted">This lesson has no content yet.</p>
          </div>
        )}

        {/* Mobile lesson navigation */}
        <div className="lg:hidden mt-8">
          <details className="bg-surface border border-border rounded-xl shadow-card">
            <summary className="px-4 py-3 text-sm font-medium text-foreground cursor-pointer">
              Course Navigation
            </summary>
            <div className="px-3 pb-3">
              <LessonNav
                lessons={lessons}
                lessonProgress={lessonProgress}
                quizInfo={quizInfo}
                currentLessonSlug={lessonSlug}
                courseSlug={courseSlug}
                basePath="/training"
                navigationMode={course.navigation_mode}
                currentLessonPageTitles={pageTitles}
                currentLessonHasQuiz={hasQuiz}
              />
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}
