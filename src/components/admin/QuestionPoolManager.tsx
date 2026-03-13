'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Database } from '@/lib/supabase/database.types'

type CertQuestion = Database['public']['Tables']['cert_questions']['Row']
type CertQuestionType = 'multiple_choice' | 'open_ended'
type Difficulty = 'easy' | 'medium' | 'hard'

interface McOption {
  text: string
  is_correct: boolean
}

interface QuestionPoolManagerProps {
  trackId: string
  questions: CertQuestion[]
  questionsPerExam: number
  questionPoolSize: number
}

// ────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────

export function QuestionPoolManager({
  trackId,
  questions: initialQuestions,
  questionsPerExam,
  questionPoolSize,
}: QuestionPoolManagerProps) {
  const router = useRouter()
  const [questions, setQuestions] = useState<CertQuestion[]>(initialQuestions)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const count = questions.length
  const poolReady = count >= questionsPerExam
  const progressPercent = Math.min((count / questionPoolSize) * 100, 100)

  async function handleDeleteQuestion(questionId: string) {
    try {
      const res = await fetch(`/api/admin/certifications/${trackId}/questions/${questionId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to delete question')
        return
      }

      setQuestions((prev) => prev.filter((q) => q.id !== questionId))
      setDeletingId(null)
      router.refresh()
    } catch {
      alert('Network error. Please try again.')
    }
  }

  function handleQuestionCreated(question: CertQuestion) {
    setQuestions((prev) => [...prev, question])
    setShowAddForm(false)
    router.refresh()
  }

  function handleQuestionUpdated(question: CertQuestion) {
    setQuestions((prev) => prev.map((q) => (q.id === question.id ? question : q)))
    setEditingId(null)
    router.refresh()
  }

  return (
    <div data-testid="question-pool-manager">
      {/* Pool header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Question Pool</h2>
          <p className={`mt-1 text-sm font-medium ${poolReady ? 'text-success' : 'text-warning'}`}>
            {count} of {questionPoolSize} required questions
            {!poolReady && (
              <span className="text-foreground-muted font-normal"> (min {questionsPerExam} for exam)</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAddForm(true)
            setEditingId(null)
          }}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
          data-testid="add-question-button"
        >
          Add Question
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="h-2 w-full rounded-full bg-[var(--background-muted)]">
          <div
            className={`h-2 rounded-full transition-all ${poolReady ? 'bg-success' : 'bg-warning'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Add question form */}
      {showAddForm && (
        <div className="mt-6">
          <QuestionForm
            trackId={trackId}
            onSave={handleQuestionCreated}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {/* Question list */}
      <div className="mt-6 space-y-3">
        {questions.length === 0 && !showAddForm ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center shadow-card">
            <p className="text-sm text-foreground-muted">
              No questions yet. Add questions to build the certification exam pool.
            </p>
          </div>
        ) : (
          questions.map((question) => (
            <div key={question.id}>
              {editingId === question.id ? (
                <QuestionForm
                  trackId={trackId}
                  question={question}
                  onSave={handleQuestionUpdated}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <QuestionRow
                  question={question}
                  onEdit={() => {
                    setEditingId(question.id)
                    setShowAddForm(false)
                  }}
                  onDelete={() => setDeletingId(question.id)}
                />
              )}

              {/* Delete confirmation */}
              {deletingId === question.id && (
                <div className="mt-2 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive-muted px-4 py-3">
                  <p className="flex-1 text-sm text-foreground">Delete this question?</p>
                  <button
                    type="button"
                    onClick={() => setDeletingId(null)}
                    className="text-sm text-foreground-muted hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(question.id)}
                    className="text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
                    data-testid={`confirm-delete-question-${question.id}`}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────
// Question Row (read-only display)
// ────────────────────────────────────────────

function QuestionRow({
  question,
  onEdit,
  onDelete,
}: {
  question: CertQuestion
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className="rounded-xl border border-border bg-surface p-4 shadow-card"
      data-testid={`question-row-${question.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground line-clamp-2">{question.question_text}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <QuestionTypeBadge type={question.question_type} />
            <DifficultyBadge difficulty={question.difficulty} />
            <span className="text-xs text-foreground-muted">{question.max_points} pts</span>
            {question.tags && question.tags.length > 0 && (
              <div className="flex gap-1">
                {question.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex rounded-full bg-[var(--background-muted)] px-2 py-0.5 text-xs text-foreground-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="text-sm text-accent hover:text-accent-hover transition-colors"
            data-testid={`edit-question-${question.id}`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-sm text-destructive hover:text-destructive/80 transition-colors"
            data-testid={`delete-question-${question.id}`}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────
// Question Form (add / edit)
// ────────────────────────────────────────────

function QuestionForm({
  trackId,
  question,
  onSave,
  onCancel,
}: {
  trackId: string
  question?: CertQuestion
  onSave: (q: CertQuestion) => void
  onCancel: () => void
}) {
  const isEdit = Boolean(question)

  const [questionText, setQuestionText] = useState(question?.question_text ?? '')
  const [questionType, setQuestionType] = useState<CertQuestionType>(
    (question?.question_type as CertQuestionType) ?? 'multiple_choice'
  )
  const [options, setOptions] = useState<McOption[]>(() => {
    if (question?.options && Array.isArray(question.options)) {
      return (question.options as unknown as McOption[]).map((o) => ({ text: o.text, is_correct: o.is_correct }))
    }
    return [
      { text: '', is_correct: true },
      { text: '', is_correct: false },
    ]
  })
  const [rubric, setRubric] = useState(question?.rubric ?? '')
  const [maxPoints, setMaxPoints] = useState(question?.max_points ?? 10)
  const [difficulty, setDifficulty] = useState<Difficulty>(question?.difficulty ?? 'medium')
  const [tagsInput, setTagsInput] = useState((question?.tags ?? []).join(', '))

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function addOption() {
    setOptions((prev) => [...prev, { text: '', is_correct: false }])
  }

  function removeOption(index: number) {
    if (options.length <= 2) return
    setOptions((prev) => prev.filter((_, i) => i !== index))
  }

  function updateOption(index: number, field: keyof McOption, value: string | boolean) {
    setOptions((prev) =>
      prev.map((opt, i) => {
        if (i !== index) return opt
        return { ...opt, [field]: value }
      })
    )
  }

  function setCorrectOption(index: number) {
    setOptions((prev) =>
      prev.map((opt, i) => ({ ...opt, is_correct: i === index }))
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Client-side validation
    if (!questionText.trim()) {
      setError('Question text is required')
      return
    }

    if (questionType === 'multiple_choice') {
      const filledOptions = options.filter((o) => o.text.trim())
      if (filledOptions.length < 2) {
        setError('At least 2 options are required for multiple choice')
        return
      }
      if (!filledOptions.some((o) => o.is_correct)) {
        setError('At least one option must be marked as correct')
        return
      }
    }

    if (questionType === 'open_ended' && !rubric.trim()) {
      setError('Rubric is required for open-ended questions')
      return
    }

    setSubmitting(true)

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const filteredOptions = questionType === 'multiple_choice'
      ? options.filter((o) => o.text.trim())
      : null

    const correctAnswer = questionType === 'multiple_choice' && filteredOptions
      ? filteredOptions.find((o) => o.is_correct)?.text ?? null
      : null

    const body = {
      question_text: questionText.trim(),
      question_type: questionType,
      options: filteredOptions,
      correct_answer: correctAnswer,
      rubric: questionType === 'open_ended' ? rubric.trim() : null,
      max_points: maxPoints,
      difficulty,
      tags,
    }

    try {
      const url = isEdit
        ? `/api/admin/certifications/${trackId}/questions/${question!.id}`
        : `/api/admin/certifications/${trackId}/questions`
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save question')
        return
      }

      const data = await res.json()
      onSave(data.question)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-accent/30 bg-surface p-5 shadow-card space-y-4"
      data-testid={isEdit ? `edit-question-form-${question!.id}` : 'add-question-form'}
    >
      <h3 className="text-sm font-semibold text-foreground">
        {isEdit ? 'Edit Question' : 'New Question'}
      </h3>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive-muted px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Question text */}
      <div className="space-y-1.5">
        <label htmlFor="q-text" className="text-sm font-medium text-foreground">
          Question Text
        </label>
        <textarea
          id="q-text"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          rows={3}
          placeholder="Enter the certification question..."
          className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-foreground-subtle resize-y"
        />
      </div>

      {/* Type + Difficulty + Points row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="q-type" className="text-sm font-medium text-foreground">
            Type
          </label>
          <select
            id="q-type"
            value={questionType}
            onChange={(e) => setQuestionType(e.target.value as CertQuestionType)}
            className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
          >
            <option value="multiple_choice">Multiple Choice</option>
            <option value="open_ended">Open Ended</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="q-difficulty" className="text-sm font-medium text-foreground">
            Difficulty
          </label>
          <select
            id="q-difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="q-points" className="text-sm font-medium text-foreground">
            Max Points
          </label>
          <input
            id="q-points"
            type="number"
            value={maxPoints}
            onChange={(e) => setMaxPoints(Number(e.target.value))}
            min={1}
            max={100}
            className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
          />
        </div>
      </div>

      {/* MC Options */}
      {questionType === 'multiple_choice' && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">Answer Options</label>
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCorrectOption(index)}
                className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                  option.is_correct
                    ? 'border-success bg-success text-white'
                    : 'border-border bg-background text-transparent hover:border-foreground-muted'
                }`}
                title={option.is_correct ? 'Correct answer' : 'Mark as correct'}
                data-testid={`option-correct-${index}`}
              >
                {option.is_correct && (
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <input
                type="text"
                value={option.text}
                onChange={(e) => updateOption(index, 'text', e.target.value)}
                placeholder={`Option ${index + 1}`}
                className="flex-1 bg-background border border-border text-foreground rounded-lg px-3 py-1.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-foreground-subtle"
                data-testid={`option-text-${index}`}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="shrink-0 text-foreground-muted hover:text-destructive transition-colors"
                  title="Remove option"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="text-sm text-accent hover:text-accent-hover transition-colors"
            data-testid="add-option-button"
          >
            + Add Option
          </button>
        </div>
      )}

      {/* Rubric for open-ended */}
      {questionType === 'open_ended' && (
        <div className="space-y-1.5">
          <label htmlFor="q-rubric" className="text-sm font-medium text-foreground">
            Grading Rubric
          </label>
          <textarea
            id="q-rubric"
            value={rubric}
            onChange={(e) => setRubric(e.target.value)}
            rows={3}
            placeholder="Describe what a good answer looks like. This is used by the LLM grader."
            className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-foreground-subtle resize-y"
          />
        </div>
      )}

      {/* Tags */}
      <div className="space-y-1.5">
        <label htmlFor="q-tags" className="text-sm font-medium text-foreground">
          Tags <span className="text-foreground-muted">(comma-separated, optional)</span>
        </label>
        <input
          id="q-tags"
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="e.g. sprint-planning, agile, fundamentals"
          className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-foreground-subtle"
        />
      </div>

      {/* Form actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="bg-accent text-background hover:bg-accent-hover rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting
            ? (isEdit ? 'Saving...' : 'Adding...')
            : (isEdit ? 'Save Question' : 'Add Question')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-muted border border-border text-foreground hover:bg-raised rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ────────────────────────────────────────────
// Badge Components
// ────────────────────────────────────────────

function QuestionTypeBadge({ type }: { type: string }) {
  const label = type === 'multiple_choice' ? 'MC' : 'Open-ended'
  const color = type === 'multiple_choice'
    ? 'bg-accent-muted text-accent'
    : 'bg-[var(--secondary-muted)] text-[var(--secondary)]'

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    easy: 'bg-[var(--success-muted)] text-success',
    medium: 'bg-[var(--warning-muted)] text-warning',
    hard: 'bg-[var(--destructive-muted)] text-destructive',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${colors[difficulty] ?? ''}`}>
      {difficulty}
    </span>
  )
}
