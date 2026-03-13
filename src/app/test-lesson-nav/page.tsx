'use client'

import LessonNav from '@/components/training/LessonNav'
import LessonCompleteButton from '@/components/training/LessonCompleteButton'

const MOCK_LESSONS = [
  { id: 'l1', title: 'Introduction', slug: 'introduction', order_index: 0 },
  { id: 'l2', title: 'Core Concepts', slug: 'core-concepts', order_index: 1 },
  {
    id: 'l3',
    title: 'Advanced Topics',
    slug: 'advanced-topics',
    order_index: 2,
  },
  { id: 'l4', title: 'Final Review', slug: 'final-review', order_index: 3 },
]

const MOCK_PROGRESS = [
  { lesson_id: 'l1', completed_at: '2026-03-10T00:00:00Z' },
]

const MOCK_QUIZ_INFO = [{ lessonId: 'l3', passed: false }]

export default function TestLessonNav() {
  return (
    <div
      className="min-h-screen bg-background p-8"
      data-testid="test-lesson-nav"
    >
      <div className="flex gap-8">
        {/* Sequential mode */}
        <div className="w-64" data-testid="sequential-nav">
          <h2 className="text-foreground mb-4 font-bold">Sequential Mode</h2>
          <LessonNav
            lessons={MOCK_LESSONS}
            lessonProgress={MOCK_PROGRESS}
            quizInfo={MOCK_QUIZ_INFO}
            currentLessonSlug="core-concepts"
            courseSlug="test-course"
            basePath="/training"
            navigationMode="sequential"
          />
        </div>

        {/* Free mode */}
        <div className="w-64" data-testid="free-nav">
          <h2 className="text-foreground mb-4 font-bold">Free Mode</h2>
          <LessonNav
            lessons={MOCK_LESSONS}
            lessonProgress={MOCK_PROGRESS}
            quizInfo={MOCK_QUIZ_INFO}
            currentLessonSlug="core-concepts"
            courseSlug="test-course"
            basePath="/training"
            navigationMode="free"
          />
        </div>
      </div>

      {/* Lesson complete buttons */}
      <div className="mt-8 space-y-4" data-testid="complete-buttons">
        <div data-testid="completed-button">
          <LessonCompleteButton
            lessonId="l1"
            courseSlug="test-course"
            basePath="/training"
            isCompleted={true}
            hasQuiz={false}
            quizPassed={false}
          />
        </div>
        <div data-testid="quiz-gate-button">
          <LessonCompleteButton
            lessonId="l3"
            courseSlug="test-course"
            basePath="/training"
            isCompleted={false}
            hasQuiz={true}
            quizPassed={false}
          />
        </div>
        <div data-testid="available-button">
          <LessonCompleteButton
            lessonId="l2"
            courseSlug="test-course"
            basePath="/training"
            isCompleted={false}
            hasQuiz={false}
            quizPassed={false}
          />
        </div>
      </div>
    </div>
  )
}
