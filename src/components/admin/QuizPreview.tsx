'use client'

import { X } from 'lucide-react'
import { calculateTotalPoints } from '@/lib/quiz/calculator'
import type { Database, QuestionType } from '@/lib/supabase/database.types'

type Quiz = Database['public']['Tables']['quizzes']['Row']
type Question = Database['public']['Tables']['questions']['Row']

interface McOption {
  text: string
  is_correct: boolean
}

interface QuizPreviewProps {
  quiz: Quiz
  questions: Question[]
  onClose: () => void
}

function PreviewQuestionCard({ question, index }: { question: Question; index: number }) {
  const options: McOption[] =
    question.question_type === 'multiple_choice' && question.options
      ? (question.options as unknown as McOption[])
      : []

  return (
    <div
      className="rounded-lg border border-border bg-surface p-4 space-y-3"
      data-testid={`preview-question-${question.id}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground-muted">
          Question {index + 1}
        </span>
        <span className="text-xs text-foreground-muted">
          {question.max_points} {question.max_points === 1 ? 'point' : 'points'}
        </span>
      </div>

      {/* Question text */}
      <p className="text-sm font-medium text-foreground">
        {question.question_text || (
          <span className="italic text-foreground-subtle">
            (empty question text)
          </span>
        )}
      </p>

      {/* Answer area by type */}
      {question.question_type === 'multiple_choice' && (
        <div className="space-y-2">
          {options.map((opt, idx) => (
            <label
              key={idx}
              className="flex items-center gap-2 rounded-lg border border-border bg-background p-2.5 opacity-70 cursor-not-allowed"
            >
              <input
                type="radio"
                disabled
                name={`preview-mc-${question.id}`}
                className="h-4 w-4 accent-accent"
              />
              <span className="text-sm text-foreground">
                {opt.text || (
                  <span className="italic text-foreground-subtle">
                    (empty option)
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}

      {question.question_type === 'true_false' && (
        <div className="flex gap-4">
          <label className="flex items-center gap-2 opacity-70 cursor-not-allowed">
            <input
              type="radio"
              disabled
              name={`preview-tf-${question.id}`}
              className="h-4 w-4 accent-accent"
            />
            <span className="text-sm text-foreground">True</span>
          </label>
          <label className="flex items-center gap-2 opacity-70 cursor-not-allowed">
            <input
              type="radio"
              disabled
              name={`preview-tf-${question.id}`}
              className="h-4 w-4 accent-accent"
            />
            <span className="text-sm text-foreground">False</span>
          </label>
        </div>
      )}

      {question.question_type === 'open_ended' && (
        <textarea
          disabled
          rows={4}
          placeholder="Learner types their answer here..."
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-subtle opacity-70 cursor-not-allowed"
        />
      )}
    </div>
  )
}

export function QuizPreview({ quiz, questions, onClose }: QuizPreviewProps) {
  const totalPoints = calculateTotalPoints(questions)

  return (
    <div
      className="rounded-xl border border-border bg-surface p-4 space-y-4"
      data-testid="quiz-preview"
    >
      {/* Exit button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Quiz Preview</h3>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground-muted transition-colors hover:bg-raised hover:text-foreground"
          data-testid="exit-preview-button"
        >
          <X className="h-4 w-4" />
          Exit Preview
        </button>
      </div>

      {/* Preview banner */}
      <div
        className="rounded-lg border border-accent/20 bg-accent-muted p-3 text-sm text-accent"
        data-testid="preview-banner"
      >
        Preview Mode -- This is how learners will see this quiz
      </div>

      {/* Quiz title */}
      <h2 className="text-lg font-semibold text-foreground">
        {quiz.title || 'Untitled Quiz'}
      </h2>

      {/* Questions */}
      {questions.length === 0 ? (
        <p className="text-sm text-foreground-muted">
          This quiz has no questions yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {questions.map((q, idx) => (
            <PreviewQuestionCard key={q.id} question={q} index={idx} />
          ))}
        </div>
      )}

      {/* Footer: total points */}
      <div
        className="flex items-center justify-between border-t border-border pt-3"
        data-testid="preview-footer"
      >
        <span className="text-sm text-foreground-muted">
          {questions.length} {questions.length === 1 ? 'question' : 'questions'}
        </span>
        <span className="text-sm font-medium text-foreground">
          Total: {totalPoints} {totalPoints === 1 ? 'point' : 'points'}
        </span>
      </div>
    </div>
  )
}
