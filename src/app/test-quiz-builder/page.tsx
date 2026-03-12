'use client'

import { useState } from 'react'
import { QuizBuilder } from '@/components/admin/QuizBuilder'
import { QuizPreview } from '@/components/admin/QuizPreview'
import type { Database, Json } from '@/lib/supabase/database.types'

type Quiz = Database['public']['Tables']['quizzes']['Row']
type Question = Database['public']['Tables']['questions']['Row']

/**
 * Test-only quiz builder page outside the (app) route group.
 * Bypasses auth middleware for E2E testing of quiz builder flows.
 * This page should not be deployed to production.
 */

const MOCK_QUIZ: Quiz = {
  id: '00000000-0000-0000-0000-000000000201',
  lesson_id: '00000000-0000-0000-0000-000000000101',
  title: 'Test Quiz',
  passing_score: 70,
  instructions: null,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-12T00:00:00Z',
}

const MOCK_MC_QUESTION: Question = {
  id: '00000000-0000-0000-0000-000000000301',
  quiz_id: '00000000-0000-0000-0000-000000000201',
  question_type: 'multiple_choice',
  question_text: 'What is 2+2?',
  options: [
    { text: '3', is_correct: false },
    { text: '4', is_correct: true },
    { text: '5', is_correct: false },
  ] as unknown as Json,
  correct_answer: '4',
  rubric: null,
  max_points: 10,
  order_index: 0,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-12T00:00:00Z',
}

const MOCK_TF_QUESTION: Question = {
  id: '00000000-0000-0000-0000-000000000302',
  quiz_id: '00000000-0000-0000-0000-000000000201',
  question_type: 'true_false',
  question_text: 'The sky is blue.',
  options: null,
  correct_answer: 'true',
  rubric: null,
  max_points: 5,
  order_index: 1,
  created_at: '2026-03-02T00:00:00Z',
  updated_at: '2026-03-12T00:00:00Z',
}

const MOCK_OE_QUESTION: Question = {
  id: '00000000-0000-0000-0000-000000000303',
  quiz_id: '00000000-0000-0000-0000-000000000201',
  question_type: 'open_ended',
  question_text: 'Explain the water cycle.',
  options: null,
  correct_answer: null,
  rubric: 'Should mention evaporation, condensation, and precipitation.',
  max_points: 20,
  order_index: 2,
  created_at: '2026-03-03T00:00:00Z',
  updated_at: '2026-03-12T00:00:00Z',
}

type View = 'empty' | 'with-quiz' | 'preview'

export default function TestQuizBuilderPage() {
  const [view, setView] = useState<View>('empty')

  const allQuestions = [MOCK_MC_QUESTION, MOCK_TF_QUESTION, MOCK_OE_QUESTION]

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-lg space-y-8">
        {/* View switcher for testing different states */}
        <div className="flex gap-2 border-b border-border pb-4">
          <button
            onClick={() => setView('empty')}
            className={`rounded-md px-3 py-1.5 text-sm ${
              view === 'empty'
                ? 'bg-accent text-background'
                : 'bg-muted text-foreground'
            }`}
            data-testid="view-empty"
          >
            No Quiz
          </button>
          <button
            onClick={() => setView('with-quiz')}
            className={`rounded-md px-3 py-1.5 text-sm ${
              view === 'with-quiz'
                ? 'bg-accent text-background'
                : 'bg-muted text-foreground'
            }`}
            data-testid="view-with-quiz"
          >
            With Quiz
          </button>
          <button
            onClick={() => setView('preview')}
            className={`rounded-md px-3 py-1.5 text-sm ${
              view === 'preview'
                ? 'bg-accent text-background'
                : 'bg-muted text-foreground'
            }`}
            data-testid="view-preview"
          >
            Preview
          </button>
        </div>

        {/* Render the appropriate view */}
        {view === 'empty' && (
          <QuizBuilder
            courseId="00000000-0000-0000-0000-000000000099"
            lessonId="00000000-0000-0000-0000-000000000101"
            initialQuiz={null}
            initialQuestions={[]}
          />
        )}

        {view === 'with-quiz' && (
          <QuizBuilder
            courseId="00000000-0000-0000-0000-000000000099"
            lessonId="00000000-0000-0000-0000-000000000101"
            initialQuiz={MOCK_QUIZ}
            initialQuestions={allQuestions}
          />
        )}

        {view === 'preview' && (
          <QuizPreview
            quiz={MOCK_QUIZ}
            questions={allQuestions}
            onClose={() => setView('with-quiz')}
          />
        )}
      </div>
    </div>
  )
}
