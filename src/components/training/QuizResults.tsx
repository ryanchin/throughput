'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

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

interface QuizResultsProps {
  results: QuizResults
  courseSlug: string
  lessonSlug: string
  basePath: string
  onRetake: () => void
}

export default function QuizResultsComponent({
  results,
  courseSlug,
  lessonSlug,
  basePath,
  onRetake,
}: QuizResultsProps) {
  const { attempt, responses, quizTitle, passingScore } = results
  const passed = attempt.passed
  const score = Math.round(attempt.score)

  const totalPoints = responses.reduce((sum, r) => sum + r.maxPoints, 0)
  const earnedPoints = responses.reduce((sum, r) => sum + r.pointsEarned, 0)

  return (
    <div data-testid="quiz-results" className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">{quizTitle}</h1>
        <p className="text-sm text-foreground-muted">
          Attempt #{attempt.attempt_number} &middot; Passing score: {passingScore}%
        </p>
      </div>

      {/* Score badge */}
      <div className="bg-surface border border-border rounded-xl shadow-card p-8 flex flex-col items-center gap-4">
        <div
          data-testid="quiz-score-badge"
          className={cn(
            'w-28 h-28 rounded-full flex flex-col items-center justify-center border-4',
            passed
              ? 'border-success bg-success-muted'
              : 'border-destructive bg-destructive-muted'
          )}
        >
          <span
            className={cn(
              'text-3xl font-bold',
              passed ? 'text-success' : 'text-destructive'
            )}
          >
            {score}
          </span>
          <span
            className={cn(
              'text-xs',
              passed ? 'text-success' : 'text-destructive'
            )}
          >
            / 100
          </span>
        </div>

        <p
          className={cn(
            'text-xl font-semibold',
            passed ? 'text-success' : 'text-destructive'
          )}
        >
          {passed ? 'Passed!' : 'Not Passed'}
        </p>

        <p className="text-sm text-foreground-muted">
          {earnedPoints} / {totalPoints} points earned
        </p>
      </div>

      {/* Per-question breakdown */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Question Breakdown</h2>

        {responses.map((response, index) => (
          <div
            key={response.questionId}
            data-testid={`quiz-result-item-${index}`}
            className="bg-surface border border-border rounded-xl shadow-card p-5 space-y-3"
          >
            {/* Question header */}
            <div className="flex items-start justify-between gap-3">
              <p className="text-foreground font-medium">
                <span className="text-foreground-muted mr-2">Q{index + 1}.</span>
                {response.questionText}
              </p>
              <span
                className={cn(
                  'flex-shrink-0 text-sm font-medium px-2 py-0.5 rounded',
                  response.isCorrect
                    ? 'bg-success-muted text-success'
                    : 'bg-destructive-muted text-destructive'
                )}
              >
                {response.pointsEarned} / {response.maxPoints}
              </span>
            </div>

            {/* User answer */}
            <div className="flex items-start gap-2">
              {response.questionType !== 'open_ended' ? (
                response.isCorrect ? (
                  <CheckIcon className="flex-shrink-0 mt-0.5 text-success" />
                ) : (
                  <XIcon className="flex-shrink-0 mt-0.5 text-destructive" />
                )
              ) : null}
              <div className="space-y-1">
                <p className="text-sm text-foreground-muted">Your answer:</p>
                <p className="text-sm text-foreground">{response.userAnswer}</p>
              </div>
            </div>

            {/* Correct answer (MC/TF only, if wrong) */}
            {!response.isCorrect &&
              response.correctAnswer &&
              response.questionType !== 'open_ended' && (
                <div className="flex items-start gap-2 pl-6">
                  <div className="space-y-1">
                    <p className="text-sm text-foreground-muted">Correct answer:</p>
                    <p className="text-sm text-success">{response.correctAnswer}</p>
                  </div>
                </div>
              )}

            {/* LLM feedback (open ended) */}
            {response.llmFeedback && (
              <div className="mt-3 rounded-lg border border-border bg-muted p-4 space-y-3">
                {/* Score */}
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded',
                      response.isCorrect
                        ? 'bg-success-muted text-success'
                        : 'bg-warning-muted text-warning'
                    )}
                  >
                    AI Score: {response.llmFeedback.score} / {response.maxPoints}
                  </span>
                </div>

                {/* Feedback narrative */}
                <p className="text-sm text-foreground">
                  {response.llmFeedback.feedback}
                </p>

                {/* Strengths */}
                {response.llmFeedback.strengths.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-success">Strengths</p>
                    <ul className="space-y-1">
                      {response.llmFeedback.strengths.map((s, i) => (
                        <li
                          key={i}
                          className="text-sm text-foreground flex items-start gap-2"
                        >
                          <span className="text-success mt-1 flex-shrink-0">
                            <BulletIcon />
                          </span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Areas for improvement */}
                {response.llmFeedback.improvements.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-warning">
                      Areas for Improvement
                    </p>
                    <ul className="space-y-1">
                      {response.llmFeedback.improvements.map((imp, i) => (
                        <li
                          key={i}
                          className="text-sm text-foreground flex items-start gap-2"
                        >
                          <span className="text-warning mt-1 flex-shrink-0">
                            <BulletIcon />
                          </span>
                          {imp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onRetake}
          className="rounded-lg bg-muted border border-border text-foreground px-4 py-2.5
            text-sm font-medium hover:bg-raised transition-colors"
        >
          Retake Quiz
        </button>

        <Link
          href={`${basePath}/${courseSlug}/${lessonSlug}`}
          className="rounded-lg bg-muted border border-border text-foreground px-4 py-2.5
            text-sm font-medium hover:bg-raised transition-colors"
        >
          Back to Lesson
        </Link>

        {passed && (
          <Link
            href={`${basePath}/${courseSlug}`}
            className="rounded-lg bg-accent text-background px-4 py-2.5
              text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            Next Lesson
          </Link>
        )}
      </div>
    </div>
  )
}

// -- Inline SVG icons --

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function BulletIcon() {
  return (
    <svg
      width="6"
      height="6"
      viewBox="0 0 6 6"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="3" cy="3" r="3" />
    </svg>
  )
}
