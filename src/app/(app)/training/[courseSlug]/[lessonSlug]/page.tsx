import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getLessonData } from '@/lib/training/data'
import { calculateProgress } from '@/lib/training/progress'
import { splitContentIntoPages, extractPageTitles } from '@/lib/training/content-splitter'
import LessonCompleteButton from '@/components/training/LessonCompleteButton'
import { PaginatedLesson } from './PaginatedLesson'
import type { JSONContent } from '@tiptap/react'

export default async function TrainingLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { courseSlug, lessonSlug } = await params
  const sp = await searchParams
  const initialPage = Math.max(0, parseInt(typeof sp.page === 'string' ? sp.page : '1', 10) - 1)

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

  const pages = splitContentIntoPages(lesson.content as JSONContent | null)
  const pageTitles = extractPageTitles(lesson.content as JSONContent | null)

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
    <div data-testid="lesson-page">
      {/* Course progress bar */}
      <div className="bg-surface border border-border rounded-xl shadow-card p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-foreground-muted">Module {lessonNumber} of {totalLessons}</span>
          <span className="text-sm font-medium text-accent">{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Module title */}
      <h1 className="text-3xl font-bold text-foreground mb-6">{lesson.title}</h1>

      {/* Sidebar + paginated content (client component for shared page state) */}
      {lesson.content ? (
        <PaginatedLesson
          pages={pages}
          initialPage={initialPage}
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
          lessonNavProps={{
            lessons,
            lessonProgress,
            quizInfo,
            currentLessonSlug: lessonSlug,
            courseSlug,
            basePath: '/training',
            navigationMode: course.navigation_mode,
            currentLessonPageTitles: pageTitles,
            currentLessonHasQuiz: hasQuiz,
          }}
          courseTitle={course.title}
          courseSlug={courseSlug}
          basePath="/training"
        />
      ) : (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-foreground-muted">This lesson has no content yet.</p>
        </div>
      )}

      {/* Mobile lesson navigation */}
      <div className="lg:hidden mt-8">
        <details className="bg-surface border border-border rounded-xl shadow-card">
          <summary className="px-4 py-3 text-sm font-medium text-foreground cursor-pointer">Course Navigation</summary>
          <div className="px-3 pb-3">
            {/* Mobile nav is static — no page tracking needed */}
          </div>
        </details>
      </div>
    </div>
  )
}
