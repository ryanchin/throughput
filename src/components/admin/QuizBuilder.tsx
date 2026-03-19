'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Trash2,
  Plus,
  ListChecks,
  ToggleLeft,
  MessageSquare,
  Eye,
  ChevronDown,
} from 'lucide-react'
import { calculateTotalPoints } from '@/lib/quiz/calculator'
import { QuizPreview } from './QuizPreview'
import type { Database, Json, QuestionType } from '@/lib/supabase/database.types'

type Quiz = Database['public']['Tables']['quizzes']['Row']
type Question = Database['public']['Tables']['questions']['Row']
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** Typed MC option for reading from the jsonb `options` column */
interface McOption {
  text: string
  is_correct: boolean
}

interface QuizBuilderProps {
  courseId: string
  lessonId: string
  initialQuiz: Quiz | null
  initialQuestions: Question[]
}

// ---------------------------------------------------------------------------
// Save status indicator
// ---------------------------------------------------------------------------
function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null
  return (
    <span
      className="text-xs"
      data-testid="save-indicator"
    >
      {status === 'saving' && (
        <span className="text-foreground-muted">Saving...</span>
      )}
      {status === 'saved' && <span className="text-success">Saved</span>}
      {status === 'error' && (
        <span className="text-destructive">Error saving</span>
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Question type picker dropdown
// ---------------------------------------------------------------------------
function QuestionTypePicker({
  onSelect,
}: {
  onSelect: (type: QuestionType) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const types: { type: QuestionType; label: string; icon: React.ReactNode }[] = [
    {
      type: 'multiple_choice',
      label: 'Multiple Choice',
      icon: <ListChecks className="h-4 w-4" />,
    },
    {
      type: 'true_false',
      label: 'True / False',
      icon: <ToggleLeft className="h-4 w-4" />,
    },
    {
      type: 'open_ended',
      label: 'Open Ended',
      icon: <MessageSquare className="h-4 w-4" />,
    },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-background hover:bg-accent-hover"
        data-testid="add-question-button"
      >
        <Plus className="h-4 w-4" />
        Add Question
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div
          className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-border bg-raised shadow-card"
          data-testid="question-type-picker"
        >
          {types.map(({ type, label, icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onSelect(type)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
              data-testid={`add-${type}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MC Option row
// ---------------------------------------------------------------------------
function McOptionRow({
  option,
  index,
  isCorrect,
  canDelete,
  onTextChange,
  onCorrectChange,
  onDelete,
}: {
  option: McOption
  index: number
  isCorrect: boolean
  canDelete: boolean
  onTextChange: (text: string) => void
  onCorrectChange: () => void
  onDelete: () => void
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-border bg-background p-2"
      data-testid={`mc-option-${index}`}
    >
      <input
        type="radio"
        checked={isCorrect}
        onChange={onCorrectChange}
        className="h-4 w-4 accent-accent"
        aria-label={`Mark option ${index + 1} as correct`}
        data-testid={`mc-option-radio-${index}`}
      />
      <input
        type="text"
        value={option.text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={`Option ${index + 1}`}
        className="flex-1 rounded-md border-none bg-transparent px-1 py-0.5 text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none"
        data-testid={`mc-option-text-${index}`}
      />
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="text-foreground-muted hover:text-destructive"
          aria-label={`Remove option ${index + 1}`}
          data-testid={`mc-option-delete-${index}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sortable question card
// ---------------------------------------------------------------------------
function SortableQuestionCard({
  question,
  onUpdate,
  onDelete,
  saveStatus,
}: {
  question: Question
  onUpdate: (id: string, updates: Partial<Question>) => void
  onDelete: (id: string) => void
  saveStatus: SaveStatus
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const options: McOption[] =
    question.question_type === 'multiple_choice' && question.options
      ? (question.options as unknown as McOption[])
      : []

  function handleQuestionTextChange(text: string) {
    onUpdate(question.id, { question_text: text })
  }

  function handlePointsChange(val: string) {
    const points = Math.max(1, parseInt(val, 10) || 1)
    onUpdate(question.id, { max_points: points })
  }

  function handleDeleteClick() {
    const confirmed = window.confirm(
      'Are you sure you want to delete this question? This action cannot be undone.'
    )
    if (confirmed) onDelete(question.id)
  }

  // --- MC handlers ---
  function handleOptionTextChange(idx: number, text: string) {
    const updated = options.map((o, i) => (i === idx ? { ...o, text } : o))
    onUpdate(question.id, {
      options: updated as unknown as Json,
    })
  }

  function handleCorrectChange(idx: number) {
    const updated = options.map((o, i) => ({
      ...o,
      is_correct: i === idx,
    }))
    onUpdate(question.id, {
      options: updated as unknown as Json,
      correct_answer: updated[idx].text,
    })
  }

  function handleAddOption() {
    if (options.length >= 6) return
    const updated = [...options, { text: '', is_correct: false }]
    onUpdate(question.id, { options: updated as unknown as Json })
  }

  function handleRemoveOption(idx: number) {
    if (options.length <= 2) return
    const removed = options[idx]
    const updated = options.filter((_, i) => i !== idx)
    // If we removed the correct answer, default to the first option
    if (removed.is_correct && updated.length > 0) {
      updated[0].is_correct = true
      onUpdate(question.id, {
        options: updated as unknown as Json,
        correct_answer: updated[0].text,
      })
    } else {
      onUpdate(question.id, { options: updated as unknown as Json })
    }
  }

  // --- T/F handlers ---
  function handleTrueFalseChange(answer: 'true' | 'false') {
    onUpdate(question.id, { correct_answer: answer })
  }

  // --- Open ended handlers ---
  function handleRubricChange(rubric: string) {
    onUpdate(question.id, { rubric })
  }

  const typeLabel =
    question.question_type === 'multiple_choice'
      ? 'Multiple Choice'
      : question.question_type === 'true_false'
        ? 'True / False'
        : 'Open Ended'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-border bg-muted p-4 space-y-3 ${
        isDragging ? 'opacity-50 shadow-accent-glow' : ''
      }`}
      data-testid={`question-card-${question.id}`}
    >
      {/* Card header: drag handle, type label, points, save status, delete */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab text-foreground-muted hover:text-foreground focus:outline-none active:cursor-grabbing"
          aria-label="Drag to reorder"
          data-testid={`question-drag-handle-${question.id}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <span className="rounded bg-accent-muted px-2 py-0.5 text-xs font-medium text-accent">
          {typeLabel}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <SaveIndicator status={saveStatus} />

          <label className="flex items-center gap-1 text-xs text-foreground-muted">
            Points:
            <input
              type="number"
              min={1}
              max={100}
              value={question.max_points}
              onChange={(e) => handlePointsChange(e.target.value)}
              className="w-14 rounded-md border border-border bg-background px-2 py-1 text-center text-xs text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              data-testid={`question-points-${question.id}`}
            />
          </label>

          <button
            type="button"
            onClick={handleDeleteClick}
            className="rounded-md p-1 text-foreground-muted transition-colors hover:bg-[var(--destructive-muted)] hover:text-destructive"
            aria-label="Delete question"
            data-testid={`delete-question-${question.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Question text */}
      <textarea
        value={question.question_text}
        onChange={(e) => handleQuestionTextChange(e.target.value)}
        placeholder="Enter question text..."
        rows={2}
        className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        data-testid={`question-text-${question.id}`}
      />

      {/* Type-specific content */}
      {question.question_type === 'multiple_choice' && (
        <div className="space-y-2">
          <p className="text-xs text-foreground-muted">
            Select the correct answer:
          </p>
          {options.map((opt, idx) => (
            <McOptionRow
              key={idx}
              option={opt}
              index={idx}
              isCorrect={opt.is_correct}
              canDelete={options.length > 2}
              onTextChange={(text) => handleOptionTextChange(idx, text)}
              onCorrectChange={() => handleCorrectChange(idx)}
              onDelete={() => handleRemoveOption(idx)}
            />
          ))}
          {options.length < 6 && (
            <button
              type="button"
              onClick={handleAddOption}
              className="w-full rounded-md border border-dashed border-border py-1.5 text-xs text-foreground-muted hover:border-accent hover:text-accent"
              data-testid="add-mc-option"
            >
              + Add Option
            </button>
          )}
        </div>
      )}

      {question.question_type === 'true_false' && (
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name={`tf-${question.id}`}
              checked={question.correct_answer === 'true'}
              onChange={() => handleTrueFalseChange('true')}
              className="h-4 w-4 accent-accent"
              data-testid={`tf-true-${question.id}`}
            />
            True
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name={`tf-${question.id}`}
              checked={question.correct_answer === 'false'}
              onChange={() => handleTrueFalseChange('false')}
              className="h-4 w-4 accent-accent"
              data-testid={`tf-false-${question.id}`}
            />
            False
          </label>
        </div>
      )}

      {question.question_type === 'open_ended' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground-muted">
            Grading Rubric
          </label>
          <textarea
            value={question.rubric ?? ''}
            onChange={(e) => handleRubricChange(e.target.value)}
            placeholder="Describe what a full-credit answer includes..."
            rows={3}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            data-testid={`question-rubric-${question.id}`}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main QuizBuilder component
// ---------------------------------------------------------------------------
export function QuizBuilder({
  courseId,
  lessonId,
  initialQuiz,
  initialQuestions,
}: QuizBuilderProps) {
  const [quiz, setQuiz] = useState<Quiz | null>(initialQuiz)
  const [questions, setQuestions] = useState<Question[]>(initialQuestions)
  const [creating, setCreating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [quizSaveStatus, setQuizSaveStatus] = useState<SaveStatus>('idle')
  const [questionSaveStatuses, setQuestionSaveStatuses] = useState<
    Record<string, SaveStatus>
  >({})
  const [reordering, setReordering] = useState(false)

  // Debounce timers
  const quizSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const questionSaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (quizSaveTimerRef.current) clearTimeout(quizSaveTimerRef.current)
      Object.values(questionSaveTimersRef.current).forEach(clearTimeout)
    }
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const apiBase = `/api/admin/courses/${courseId}/lessons/${lessonId}`

  // --- Quiz CRUD ---
  async function handleCreateQuiz() {
    setCreating(true)
    try {
      const res = await fetch(`${apiBase}/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to create quiz')
        return
      }
      const { quiz: newQuiz } = await res.json()
      setQuiz(newQuiz)
    } catch {
      alert('Network error')
    } finally {
      setCreating(false)
    }
  }

  /** Debounced PATCH for quiz metadata (title, passing_score, max_attempts) */
  const saveQuizMeta = useCallback(
    (updates: { title?: string; passing_score?: number; max_attempts?: number | null }) => {
      if (!quiz) return
      setQuizSaveStatus('saving')
      if (quizSaveTimerRef.current) clearTimeout(quizSaveTimerRef.current)

      quizSaveTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`${apiBase}/quiz`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          })
          if (!res.ok) {
            setQuizSaveStatus('error')
            return
          }
          const { quiz: updated } = await res.json()
          setQuiz(updated)
          setQuizSaveStatus('saved')
          setTimeout(() => setQuizSaveStatus('idle'), 2000)
        } catch {
          setQuizSaveStatus('error')
        }
      }, 2000)
    },
    [quiz, apiBase]
  )

  // --- Question CRUD ---

  async function handleAddQuestion(type: QuestionType) {
    if (!quiz) return

    const defaultOptions: McOption[] =
      type === 'multiple_choice'
        ? [
            { text: '', is_correct: true },
            { text: '', is_correct: false },
          ]
        : []

    try {
      const res = await fetch(`${apiBase}/quiz/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_type: type,
          question_text: 'New question — click to edit',
          max_points: 10,
          correct_answer: type === 'true_false' ? 'true' : null,
          options: type === 'multiple_choice'
            ? [
                { text: 'Option A', is_correct: true },
                { text: 'Option B', is_correct: false },
              ]
            : null,
          rubric: type === 'open_ended' ? 'Evaluate the response for completeness and accuracy.' : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to add question')
        return
      }
      const { question } = await res.json()
      setQuestions((prev) => [...prev, question])
    } catch {
      alert('Network error')
    }
  }

  /** Debounced PATCH for a single question */
  const handleQuestionUpdate = useCallback(
    (questionId: string, updates: Partial<Question>) => {
      // Update local state immediately
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, ...updates } : q))
      )

      // Debounce the save
      setQuestionSaveStatuses((prev) => ({ ...prev, [questionId]: 'saving' }))

      if (questionSaveTimersRef.current[questionId]) {
        clearTimeout(questionSaveTimersRef.current[questionId])
      }

      questionSaveTimersRef.current[questionId] = setTimeout(async () => {
        try {
          const res = await fetch(`${apiBase}/quiz/questions/${questionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          })
          if (!res.ok) {
            setQuestionSaveStatuses((prev) => ({
              ...prev,
              [questionId]: 'error',
            }))
            return
          }
          setQuestionSaveStatuses((prev) => ({
            ...prev,
            [questionId]: 'saved',
          }))
          setTimeout(() => {
            setQuestionSaveStatuses((prev) => ({
              ...prev,
              [questionId]: 'idle',
            }))
          }, 2000)
        } catch {
          setQuestionSaveStatuses((prev) => ({
            ...prev,
            [questionId]: 'error',
          }))
        }
      }, 2000)
    },
    [apiBase]
  )

  async function handleDeleteQuestion(questionId: string) {
    try {
      const res = await fetch(`${apiBase}/quiz/questions/${questionId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to delete question')
        return
      }
      setQuestions((prev) =>
        prev
          .filter((q) => q.id !== questionId)
          .map((q, i) => ({ ...q, order_index: i }))
      )
    } catch {
      alert('Network error')
    }
  }

  // --- Drag reorder ---
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = questions.findIndex((q) => q.id === active.id)
      const newIndex = questions.findIndex((q) => q.id === over.id)

      const reordered = arrayMove(questions, oldIndex, newIndex).map(
        (q, i) => ({ ...q, order_index: i })
      )

      setQuestions(reordered)
      setReordering(true)

      try {
        const res = await fetch(`${apiBase}/quiz/questions/reorder`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionIds: reordered.map((q) => q.id),
          }),
        })
        if (!res.ok) {
          setQuestions(questions)
          const err = await res.json()
          alert(err.error || 'Failed to reorder questions')
        }
      } catch {
        setQuestions(questions)
        alert('Network error')
      } finally {
        setReordering(false)
      }
    },
    [questions, apiBase]
  )

  const totalPoints = calculateTotalPoints(questions)

  // --- Preview mode ---
  if (showPreview && quiz) {
    return (
      <QuizPreview
        quiz={quiz}
        questions={questions}
        onClose={() => setShowPreview(false)}
      />
    )
  }

  // --- No quiz yet ---
  if (!quiz) {
    return (
      <div
        className="rounded-xl border border-border bg-surface p-5"
        data-testid="quiz-builder"
      >
        <h3 className="text-sm font-semibold text-foreground">Quiz Builder</h3>
        <p className="mt-2 text-xs text-foreground-muted">
          Add a quiz to this lesson to test learner comprehension.
        </p>
        <button
          type="button"
          onClick={handleCreateQuiz}
          disabled={creating}
          className="mt-3 w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover disabled:opacity-50"
          data-testid="create-quiz-button"
        >
          {creating ? 'Creating...' : 'Create Quiz'}
        </button>
      </div>
    )
  }

  // --- Quiz exists ---
  return (
    <div
      className="rounded-xl border border-border bg-surface p-4 space-y-4"
      data-testid="quiz-builder"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Quiz Builder</h3>
        <div className="flex items-center gap-2">
          <SaveIndicator status={quizSaveStatus} />
          {reordering && (
            <span className="text-xs text-foreground-muted">
              Saving order...
            </span>
          )}
        </div>
      </div>

      {/* Quiz metadata */}
      <div className="space-y-3">
        <div>
          <label
            htmlFor="quiz-title"
            className="mb-1 block text-xs font-medium text-foreground-muted"
          >
            Quiz Title
          </label>
          <input
            id="quiz-title"
            type="text"
            value={quiz.title ?? ''}
            onChange={(e) => {
              setQuiz((prev) =>
                prev ? { ...prev, title: e.target.value } : prev
              )
              saveQuizMeta({ title: e.target.value })
            }}
            placeholder="e.g. Lesson 1 Quiz"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            data-testid="quiz-title-input"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label
              htmlFor="quiz-passing-score"
              className="mb-1 block text-xs font-medium text-foreground-muted"
            >
              Passing Score (%)
            </label>
            <input
              id="quiz-passing-score"
              type="number"
              min={0}
              max={100}
              value={quiz.passing_score}
              onChange={(e) => {
                const score = Math.min(
                  100,
                  Math.max(0, parseInt(e.target.value, 10) || 0)
                )
                setQuiz((prev) =>
                  prev ? { ...prev, passing_score: score } : prev
                )
                saveQuizMeta({ passing_score: score })
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              data-testid="quiz-passing-score-input"
            />
          </div>
          <div className="flex-1">
            <span className="mb-1 block text-xs font-medium text-foreground-muted">
              Total Points
            </span>
            <div
              className="rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground"
              data-testid="quiz-total-points"
            >
              {totalPoints}
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="quiz-max-attempts"
            className="mb-1 block text-xs font-medium text-foreground-muted"
          >
            Max Attempts (leave empty for unlimited)
          </label>
          <input
            id="quiz-max-attempts"
            type="number"
            min={1}
            value={quiz.max_attempts ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              const value = raw === '' ? null : Math.max(1, parseInt(raw, 10) || 1)
              setQuiz((prev) =>
                prev ? { ...prev, max_attempts: value } : prev
              )
              saveQuizMeta({ max_attempts: value })
            }}
            placeholder="Unlimited"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            data-testid="quiz-max-attempts-input"
          />
        </div>
      </div>

      {/* Questions list */}
      {questions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-background px-4 py-6 text-center">
          <span className="text-xs text-foreground-subtle">
            No questions yet. Add your first question below.
          </span>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={questions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-3">
              {questions.map((q) => (
                <SortableQuestionCard
                  key={q.id}
                  question={q}
                  onUpdate={handleQuestionUpdate}
                  onDelete={handleDeleteQuestion}
                  saveStatus={questionSaveStatuses[q.id] ?? 'idle'}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <QuestionTypePicker onSelect={handleAddQuestion} />

        {questions.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground-muted transition-colors hover:bg-raised hover:text-foreground"
            data-testid="preview-quiz-button"
          >
            <Eye className="h-4 w-4" />
            Preview Quiz
          </button>
        )}
      </div>
    </div>
  )
}
