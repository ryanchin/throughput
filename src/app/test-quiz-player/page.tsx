'use client'

import { useState } from 'react'
import QuizPlayer from '@/components/training/QuizPlayer'
import QuizResultsComponent from '@/components/training/QuizResults'

const MOCK_QUESTIONS = [
  {
    id: 'q1',
    question_text: 'What is the primary goal of sprint planning?',
    question_type: 'multiple_choice' as const,
    options: [
      { text: 'Define sprint backlog' },
      { text: 'Review past sprints' },
      { text: 'Deploy to production' },
    ],
    max_points: 10,
    order_index: 0,
  },
  {
    id: 'q2',
    question_text: 'Daily standups should be limited to 15 minutes.',
    question_type: 'true_false' as const,
    options: null,
    max_points: 5,
    order_index: 1,
  },
  {
    id: 'q3',
    question_text: 'Explain why retrospectives are important for team improvement.',
    question_type: 'open_ended' as const,
    options: null,
    max_points: 20,
    order_index: 2,
  },
]

const MOCK_RESULTS = {
  attempt: { id: 'attempt-1', score: 85, passed: true, attempt_number: 1 },
  responses: [
    {
      questionId: 'q1',
      questionText: MOCK_QUESTIONS[0].question_text,
      questionType: 'multiple_choice',
      userAnswer: 'Define sprint backlog',
      isCorrect: true,
      pointsEarned: 10,
      maxPoints: 10,
      correctAnswer: 'Define sprint backlog',
      llmFeedback: null,
    },
    {
      questionId: 'q2',
      questionText: MOCK_QUESTIONS[1].question_text,
      questionType: 'true_false',
      userAnswer: 'True',
      isCorrect: true,
      pointsEarned: 5,
      maxPoints: 5,
      correctAnswer: 'True',
      llmFeedback: null,
    },
    {
      questionId: 'q3',
      questionText: MOCK_QUESTIONS[2].question_text,
      questionType: 'open_ended',
      userAnswer: 'Retrospectives help teams reflect on what went well and what needs improvement. They create a safe space for honest discussion.',
      isCorrect: false,
      pointsEarned: 15,
      maxPoints: 20,
      correctAnswer: null,
      llmFeedback: {
        score: 15,
        feedback:
          'Good understanding of retrospectives. You covered the main purpose well but could elaborate more on specific techniques.',
        strengths: [
          'Clear explanation of purpose',
          'Good use of examples',
        ],
        improvements: [
          'Discuss specific retrospective formats',
          'Include metrics for measuring improvement',
        ],
      },
    },
  ],
  quizTitle: 'Sprint Planning Quiz',
  passingScore: 70,
}

const MOCK_RESULTS_FAILED = {
  attempt: { id: 'attempt-2', score: 45, passed: false, attempt_number: 2 },
  responses: [
    {
      questionId: 'q1',
      questionText: MOCK_QUESTIONS[0].question_text,
      questionType: 'multiple_choice',
      userAnswer: 'Deploy to production',
      isCorrect: false,
      pointsEarned: 0,
      maxPoints: 10,
      correctAnswer: 'Define sprint backlog',
      llmFeedback: null,
    },
    {
      questionId: 'q2',
      questionText: MOCK_QUESTIONS[1].question_text,
      questionType: 'true_false',
      userAnswer: 'False',
      isCorrect: false,
      pointsEarned: 0,
      maxPoints: 5,
      correctAnswer: 'True',
      llmFeedback: null,
    },
    {
      questionId: 'q3',
      questionText: MOCK_QUESTIONS[2].question_text,
      questionType: 'open_ended',
      userAnswer: 'They are helpful.',
      isCorrect: false,
      pointsEarned: 5,
      maxPoints: 20,
      correctAnswer: null,
      llmFeedback: {
        score: 5,
        feedback: 'The answer is too brief and lacks substance.',
        strengths: [],
        improvements: [
          'Provide more detail',
          'Explain why retrospectives matter',
        ],
      },
    },
  ],
  quizTitle: 'Sprint Planning Quiz',
  passingScore: 70,
}

export default function TestQuizPlayer() {
  const [mode, setMode] = useState<'player' | 'results-pass' | 'results-fail'>('player')
  const [dynamicResults, setDynamicResults] = useState(MOCK_RESULTS)

  return (
    <div className="min-h-screen bg-background p-4" data-testid="test-quiz-player">
      {/* Toggle between modes for testing */}
      <div className="mb-4 flex gap-2" data-testid="mode-toggle">
        <button
          onClick={() => setMode('player')}
          className={`px-3 py-1 rounded text-sm ${mode === 'player' ? 'bg-accent text-background' : 'bg-muted text-foreground'}`}
          data-testid="mode-player"
        >
          Player
        </button>
        <button
          onClick={() => setMode('results-pass')}
          className={`px-3 py-1 rounded text-sm ${mode === 'results-pass' ? 'bg-accent text-background' : 'bg-muted text-foreground'}`}
          data-testid="mode-results-pass"
        >
          Results (Pass)
        </button>
        <button
          onClick={() => setMode('results-fail')}
          className={`px-3 py-1 rounded text-sm ${mode === 'results-fail' ? 'bg-accent text-background' : 'bg-muted text-foreground'}`}
          data-testid="mode-results-fail"
        >
          Results (Fail)
        </button>
      </div>

      {mode === 'player' ? (
        <QuizPlayer
          quizId="test-quiz-id"
          quizTitle="Sprint Planning Quiz"
          questions={MOCK_QUESTIONS}
          passingScore={70}
          courseSlug="test-course"
          lessonSlug="test-lesson"
          basePath="/training"
          onResults={(r) => {
            setDynamicResults(r as typeof MOCK_RESULTS)
            setMode('results-pass')
          }}
        />
      ) : mode === 'results-pass' ? (
        <QuizResultsComponent
          results={dynamicResults}
          courseSlug="test-course"
          lessonSlug="test-lesson"
          lessonId="test-lesson-id"
          basePath="/training"
          nextLessonSlug="test-next-lesson"
          onRetake={() => setMode('player')}
        />
      ) : (
        <QuizResultsComponent
          results={MOCK_RESULTS_FAILED}
          courseSlug="test-course"
          lessonSlug="test-lesson"
          lessonId="test-lesson-id"
          basePath="/training"
          nextLessonSlug={null}
          onRetake={() => setMode('player')}
        />
      )}
    </div>
  )
}
