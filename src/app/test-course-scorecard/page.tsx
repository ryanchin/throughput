'use client'

import { useState } from 'react'
import CourseScorecard from '@/components/training/CourseScorecard'

/**
 * Test page for CourseScorecard E2E tests.
 * Renders the scorecard with mock data, bypassing auth.
 */
export default function TestCourseScorecardPage() {
  const [scenario, setScenario] = useState<'passed' | 'failed'>('passed')

  const passedBreakdown = [
    { quizTitle: 'Quiz 1: Foundations', lessonTitle: 'Lesson 1: Introduction', score: 40, maxScore: 50, percentage: 80, passed: true },
    { quizTitle: 'Quiz 2: Deep Dive', lessonTitle: 'Lesson 2: Core Concepts', score: 45, maxScore: 50, percentage: 90, passed: true },
    { quizTitle: 'Quiz 3: Applied', lessonTitle: 'Lesson 3: Practice', score: 38, maxScore: 50, percentage: 76, passed: true },
  ]

  const failedBreakdown = [
    { quizTitle: 'Quiz 1: Foundations', lessonTitle: 'Lesson 1: Introduction', score: 25, maxScore: 50, percentage: 50, passed: false },
    { quizTitle: 'Quiz 2: Deep Dive', lessonTitle: 'Lesson 2: Core Concepts', score: 30, maxScore: 50, percentage: 60, passed: false },
  ]

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      {/* Scenario toggle */}
      <div className="flex gap-2 justify-center mb-8" data-testid="scenario-toggle">
        <button
          onClick={() => setScenario('passed')}
          className={`px-4 py-2 rounded text-sm ${scenario === 'passed' ? 'bg-accent text-background' : 'bg-muted text-foreground'}`}
          data-testid="btn-passed"
        >
          Passed Scenario
        </button>
        <button
          onClick={() => setScenario('failed')}
          className={`px-4 py-2 rounded text-sm ${scenario === 'failed' ? 'bg-accent text-background' : 'bg-muted text-foreground'}`}
          data-testid="btn-failed"
        >
          Failed Scenario
        </button>
      </div>

      {scenario === 'passed' ? (
        <CourseScorecard
          courseTitle="AAVA Foundations Course"
          courseSlug="aava-foundations"
          finalScore={82}
          passingScore={70}
          passed={true}
          completedAt="2026-03-12T15:30:00Z"
          breakdown={passedBreakdown}
          zone="training"
        />
      ) : (
        <CourseScorecard
          courseTitle="AAVA Foundations Course"
          courseSlug="aava-foundations"
          finalScore={55}
          passingScore={70}
          passed={false}
          completedAt="2026-03-12T15:30:00Z"
          breakdown={failedBreakdown}
          zone="training"
        />
      )}
    </div>
  )
}
