'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AiContextPanel } from '@/components/admin/AiContextPanel'
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
  trackTitle: string
  trackDescription: string | null
  questions: CertQuestion[]
  questionsPerExam: number
  questionPoolSize: number
}

// ────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────

const GENERATE_PROGRESS_MESSAGES = [
  'Generating exam questions...',
  'Creating answer rubrics...',
  'Almost there...',
]

export function QuestionPoolManager({
  trackId,
  trackTitle,
  trackDescription,
  questions: initialQuestions,
  questionsPerExam,
  questionPoolSize,
}: QuestionPoolManagerProps) {
  const router = useRouter()
  const [questions, setQuestions] = useState<CertQuestion[]>(initialQuestions)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // AI generation state
  const [showGeneratePanel, setShowGeneratePanel] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateProgressIndex, setGenerateProgressIndex] = useState(0)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generateQuestionCount, setGenerateQuestionCount] = useState(20)

  // AI context state for generation
  const [genInstructions, setGenInstructions] = useState('')
  const [genPreset, setGenPreset] = useState<string | null>(null)
  const [genFileText, setGenFileText] = useState<string | null>(null)
  const [genFileName, setGenFileName] = useState<string | null>(null)
  const [genFileWordCount, setGenFileWordCount] = useState(0)
  const [genFileUploading, setGenFileUploading] = useState(false)
  const [genSelectedCourseIds, setGenSelectedCourseIds] = useState<string[]>([])

  // Progressive overlay messages for generation
  useEffect(() => {
    if (!generating) {
      setGenerateProgressIndex(0)
      return
    }
    const intervals = [5000, 12000]
    const timers = intervals.map((delay, i) =>
      setTimeout(() => setGenerateProgressIndex(i + 1), delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [generating])

  async function handleGenerateQuestions() {
    setGenerateError(null)
    setGenerating(true)

    try {
      // Step 1: Call the certification generation API
      const genRes = await fetch('/api/admin/generate/certification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackTitle,
          trackDescription: trackDescription || undefined,
          questionCount: generateQuestionCount,
          questionTypes: ['multiple_choice', 'open_ended'],
          instructions: genInstructions.trim() || undefined,
          preset: genPreset || undefined,
          fileText: genFileText || undefined,
          fileName: genFileName || undefined,
          courseIds: genSelectedCourseIds.length > 0 ? genSelectedCourseIds : undefined,
        }),
      })

      if (!genRes.ok) {
        const genData = await genRes.json()
        setGenerateError(genData.error || 'Failed to generate questions')
        return
      }

      const genData = await genRes.json()
      const generatedQuestions = genData.questions as Array<{
        question_text: string
        question_type: string
        options: Array<{ text: string; is_correct: boolean }> | null
        correct_answer: string | null
        rubric: string | null
        difficulty: string
        max_points: number
      }>

      // Step 2: Write each question to the DB
      let writeErrors = 0
      const newQuestions: CertQuestion[] = []

      for (const q of generatedQuestions) {
        try {
          const writeRes = await fetch(`/api/admin/certifications/${trackId}/questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question_text: q.question_text,
              question_type: q.question_type,
              options: q.options,
              correct_answer: q.correct_answer,
              rubric: q.rubric,
              difficulty: q.difficulty,
              max_points: q.max_points,
              tags: [],
            }),
          })

          if (writeRes.ok) {
            const writeData = await writeRes.json()
            newQuestions.push(writeData.question)
          } else {
            writeErrors++
          }
        } catch {
          writeErrors++
        }
      }

      // Update local state with newly created questions
      if (newQuestions.length > 0) {
        setQuestions((prev) => [...prev, ...newQuestions])
      }

      if (writeErrors > 0) {
        setGenerateError(
          `Generated ${generatedQuestions.length} questions, but ${writeErrors} failed to save. ${newQuestions.length} were added successfully.`
        )
      } else {
        // Success -- close the panel
        setShowGeneratePanel(false)
        // Reset generation form state
        setGenInstructions('')
        setGenPreset(null)
        setGenFileText(null)
        setGenFileName(null)
        setGenFileWordCount(0)
        setGenSelectedCourseIds([])
      }

      router.refresh()
    } catch {
      setGenerateError('Network error. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowGeneratePanel((prev) => !prev)
              setShowAddForm(false)
              setEditingId(null)
            }}
            disabled={generating}
            className="rounded-lg border border-accent bg-accent-muted px-4 py-2 text-sm font-medium text-accent hover:bg-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="generate-questions-button"
          >
            {generating ? 'Generating...' : 'Generate Questions'}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddForm(true)
              setEditingId(null)
              setShowGeneratePanel(false)
            }}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
            data-testid="add-question-button"
          >
            Add Question
          </button>
        </div>
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

      {/* Generate questions panel */}
      {showGeneratePanel && (
        <div className="mt-6" data-testid="generate-questions-panel">
          {generating && (
            <div data-testid="generate-overlay" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mb-4" />
              <h2 className="text-lg font-semibold text-foreground">Generating certification questions...</h2>
              <p className="mt-2 text-sm text-foreground-muted">
                {GENERATE_PROGRESS_MESSAGES[Math.min(generateProgressIndex, GENERATE_PROGRESS_MESSAGES.length - 1)]}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-accent/30 bg-surface p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Generate Questions with AI</h3>
              <button
                type="button"
                onClick={() => setShowGeneratePanel(false)}
                className="text-foreground-muted hover:text-foreground text-lg leading-none px-1 transition-colors"
                aria-label="Close generate panel"
              >
                &times;
              </button>
            </div>

            {generateError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive-muted px-4 py-2 text-sm text-destructive">
                {generateError}
              </div>
            )}

            <AiContextPanel
              instructions={genInstructions}
              onInstructionsChange={setGenInstructions}
              preset={genPreset}
              onPresetChange={setGenPreset}
              fileText={genFileText}
              fileName={genFileName}
              fileWordCount={genFileWordCount}
              onFileUploaded={(data) => {
                setGenFileText(data.text)
                setGenFileName(data.name)
                setGenFileWordCount(data.wordCount)
              }}
              onFileRemoved={() => {
                setGenFileText(null)
                setGenFileName(null)
                setGenFileWordCount(0)
              }}
              fileUploading={genFileUploading}
              onFileUploadStart={() => setGenFileUploading(true)}
              selectedCourseIds={genSelectedCourseIds}
              onCourseIdsChange={setGenSelectedCourseIds}
              showCoursePicker={true}
            >
              {/* Question count setting */}
              <div className="space-y-4 pt-2 border-t border-border">
                <div className="space-y-1.5">
                  <label htmlFor="gen-question-count" className="text-sm font-medium text-foreground">
                    Questions to Generate
                  </label>
                  <input
                    id="gen-question-count"
                    data-testid="gen-question-count-input"
                    type="number"
                    value={generateQuestionCount}
                    onChange={(e) => setGenerateQuestionCount(Number(e.target.value))}
                    min={1}
                    max={100}
                    className="w-32 bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                  />
                  <p className="text-xs text-foreground-muted">Between 1 and 100 questions (mix of multiple choice and open-ended)</p>
                </div>
              </div>
            </AiContextPanel>

            {/* Generate action */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleGenerateQuestions}
                disabled={generating || generateQuestionCount < 1 || generateQuestionCount > 100}
                className="bg-accent text-background hover:bg-accent-hover rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-accent-glow"
                data-testid="generate-submit-button"
              >
                {generating ? 'Generating...' : `Generate ${generateQuestionCount} Questions`}
              </button>
              <button
                type="button"
                onClick={() => setShowGeneratePanel(false)}
                className="bg-muted border border-border text-foreground hover:bg-raised rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
