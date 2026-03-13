'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

type QuestionType = 'multiple_choice' | 'true_false' | 'open_ended'

interface Question {
  id: string
  question_text: string
  question_type: QuestionType
  options: Array<{ text: string }> | null
  max_points: number
  order_index: number
}

interface QuizResults {
  attempt: { id: string; score: number; passed: boolean; attempt_number: number }
  responses: Array<{
    questionId: string
    questionText: string
    questionType: string
    userAnswer: string
    isCorrect: boolean
    pointsEarned: number
    maxPoints: number
    correctAnswer: string | null
    llmFeedback: {
      score: number
      feedback: string
      strengths: string[]
      improvements: string[]
    } | null
  }>
  quizTitle: string
  passingScore: number
}

interface QuizPlayerProps {
  quizId: string
  quizTitle: string
  questions: Question[]
  passingScore: number
  courseSlug: string
  lessonSlug: string
  basePath: string
  onResults: (results: QuizResults) => void
}

export default function QuizPlayer({
  quizId,
  quizTitle,
  questions,
  passingScore,
  courseSlug,
  lessonSlug,
  basePath,
  onResults,
}: QuizPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentQuestion = questions[currentIndex]
  const currentAnswer = answers.get(currentQuestion.id) ?? ''
  const isFirst = currentIndex === 0
  const isLast = currentIndex === questions.length - 1
  const hasOpenEnded = questions.some((q) => q.question_type === 'open_ended')

  // Warn before leaving if answers exist
  useEffect(() => {
    if (answers.size === 0) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [answers.size])

  const setAnswer = useCallback(
    (value: string) => {
      setAnswers((prev) => {
        const next = new Map(prev)
        next.set(currentQuestion.id, value)
        return next
      })
    },
    [currentQuestion.id]
  )

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        quizId,
        answers: questions.map((q) => ({
          questionId: q.id,
          answer: answers.get(q.id) ?? '',
        })),
      }

      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `Submission failed (${res.status})`)
      }

      const data: QuizResults = await res.json()
      onResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div data-testid="quiz-player" className="relative max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{quizTitle}</h1>
        <p className="text-sm text-foreground-muted">
          Passing score: {passingScore}%
        </p>
      </div>

      {/* Progress */}
      <div className="bg-surface border border-border rounded-xl shadow-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span data-testid="quiz-progress" className="text-sm text-foreground-muted">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="text-sm font-medium text-accent">
            {Math.round(((currentIndex + 1) / questions.length) * 100)}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="bg-surface border border-border rounded-xl shadow-card p-6 space-y-6">
        <p className="text-lg font-medium text-foreground">
          {currentQuestion.question_text}
        </p>

        {/* MC options */}
        {currentQuestion.question_type === 'multiple_choice' &&
          currentQuestion.options && (
            <div className="space-y-3" role="radiogroup">
              {currentQuestion.options.map((opt, idx) => (
                <label
                  key={idx}
                  data-testid={`mc-option-${idx}`}
                  className={cn(
                    'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all',
                    currentAnswer === opt.text
                      ? 'border-accent bg-accent-muted'
                      : 'border-border bg-muted hover:border-foreground-muted'
                  )}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value={opt.text}
                    checked={currentAnswer === opt.text}
                    onChange={() => setAnswer(opt.text)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center',
                      currentAnswer === opt.text
                        ? 'border-accent'
                        : 'border-foreground-muted'
                    )}
                  >
                    {currentAnswer === opt.text && (
                      <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                    )}
                  </span>
                  <span className="text-foreground">{opt.text}</span>
                </label>
              ))}
            </div>
          )}

        {/* True/False */}
        {currentQuestion.question_type === 'true_false' && (
          <div className="flex gap-4">
            <button
              data-testid="tf-true"
              type="button"
              onClick={() => setAnswer('True')}
              className={cn(
                'flex-1 py-4 rounded-lg text-lg font-medium border transition-all',
                currentAnswer === 'True'
                  ? 'bg-accent text-background border-accent'
                  : 'bg-muted text-foreground border-border hover:border-foreground-muted'
              )}
            >
              True
            </button>
            <button
              data-testid="tf-false"
              type="button"
              onClick={() => setAnswer('False')}
              className={cn(
                'flex-1 py-4 rounded-lg text-lg font-medium border transition-all',
                currentAnswer === 'False'
                  ? 'bg-accent text-background border-accent'
                  : 'bg-muted text-foreground border-border hover:border-foreground-muted'
              )}
            >
              False
            </button>
          </div>
        )}

        {/* Open ended */}
        {currentQuestion.question_type === 'open_ended' && (
          <div className="space-y-2">
            <textarea
              data-testid="open-ended-textarea"
              value={currentAnswer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your response..."
              rows={6}
              className="w-full rounded-lg border border-border bg-muted p-4 text-foreground
                placeholder:text-foreground-subtle resize-y focus:outline-none focus:border-accent
                transition-colors"
            />
            <p
              className={cn(
                'text-sm',
                currentAnswer.length >= 50
                  ? 'text-accent'
                  : 'text-foreground-muted'
              )}
            >
              {currentAnswer.length} / 50 minimum characters
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-destructive-muted border border-destructive/30 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {!isFirst ? (
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => i - 1)}
            className="rounded-lg bg-muted border border-border text-foreground px-4 py-2.5
              text-sm font-medium hover:bg-raised transition-colors"
          >
            Back
          </button>
        ) : (
          <div />
        )}

        {!isLast ? (
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => i + 1)}
            disabled={!currentAnswer}
            className="rounded-lg bg-accent text-background px-4 py-2.5 text-sm font-medium
              hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!currentAnswer || submitting}
            className="rounded-lg bg-accent text-background px-6 py-2.5 text-sm font-medium
              hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Submit Quiz
          </button>
        )}
      </div>

      {/* Grading overlay */}
      {submitting && (
        <div
          data-testid="quiz-grading-overlay"
          className="absolute inset-0 flex flex-col items-center justify-center
            bg-background/80 backdrop-blur-sm rounded-xl z-10"
        >
          {/* Spinner */}
          <svg
            className="animate-spin h-10 w-10 text-accent mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-lg font-medium text-foreground">
            {hasOpenEnded
              ? 'Your responses are being reviewed by AI...'
              : 'Scoring your quiz...'}
          </p>
        </div>
      )}
    </div>
  )
}
