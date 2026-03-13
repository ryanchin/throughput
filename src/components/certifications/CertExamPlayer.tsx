'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QuestionType = 'multiple_choice' | 'open_ended'

interface ExamQuestion {
  id: string
  question_text: string
  question_type: QuestionType
  options: Array<{ text: string }> | null
  max_points: number
}

interface StartExamResponse {
  attemptId: string
  questions: ExamQuestion[]
  startsAt: string // ISO timestamp
  expiresAt: string // ISO timestamp (startsAt + duration)
}

interface SubmitExamResponse {
  score: number
  passed: boolean
  certHash: string | null // present when passed
}

type ExamPhase = 'pre-exam' | 'loading' | 'in-progress' | 'submitting' | 'results'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CertExamPlayerProps {
  trackId: string
  trackTitle: string
  trackSlug: string
  tier: number
  passingScore: number
  examDurationMinutes: number
  questionsPerExam: number
  attemptsUsed: number
  maxAttempts: number
  cooldownUntil: string | null
  hasInProgressAttempt: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0h 0m'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

// ---------------------------------------------------------------------------
// Spinner component (reused across phases)
// ---------------------------------------------------------------------------

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin h-10 w-10 text-accent', className)}
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
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CertExamPlayer({
  trackId,
  trackTitle,
  trackSlug,
  tier,
  passingScore,
  examDurationMinutes,
  questionsPerExam,
  attemptsUsed,
  maxAttempts,
  cooldownUntil,
  hasInProgressAttempt,
}: CertExamPlayerProps) {
  // Phase state
  const [phase, setPhase] = useState<ExamPhase>('pre-exam')

  // Exam data (populated after start)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [expiresAt, setExpiresAt] = useState<number | null>(null) // epoch ms

  // Question navigation
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())

  // Timer
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    examDurationMinutes * 60
  )

  // Results
  const [result, setResult] = useState<SubmitExamResponse | null>(null)

  // Error
  const [error, setError] = useState<string | null>(null)

  // Cooldown countdown (for pre-exam phase)
  const [cooldownMs, setCooldownMs] = useState<number>(() => {
    if (!cooldownUntil) return 0
    return Math.max(0, new Date(cooldownUntil).getTime() - Date.now())
  })

  // Track whether auto-submit has fired to avoid duplicates
  const autoSubmittedRef = useRef(false)

  // -------------------------------------------------------------------------
  // Cooldown timer
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (cooldownMs <= 0) return
    const interval = setInterval(() => {
      setCooldownMs((prev) => {
        const next = Math.max(0, prev - 1000)
        if (next <= 0) clearInterval(interval)
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [cooldownMs > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Exam timer
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'in-progress' || !expiresAt) return

    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000))
      setRemainingSeconds(remaining)

      if (remaining <= 0) {
        clearInterval(interval)
        // Auto-submit
        if (!autoSubmittedRef.current) {
          autoSubmittedRef.current = true
          handleSubmit()
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [phase, expiresAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Warn before leaving when exam is in progress
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'in-progress') return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [phase])

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------
  const currentQuestion = questions[currentIndex] ?? null
  const currentAnswer = currentQuestion
    ? answers.get(currentQuestion.id) ?? ''
    : ''
  const isFirst = currentIndex === 0
  const isLast = currentIndex === questions.length - 1
  const answeredCount = answers.size
  const allAnswered = answeredCount === questions.length

  const isInCooldown = cooldownMs > 0
  const isMaxedOut = attemptsUsed >= maxAttempts && !isInCooldown
  const canStart = attemptsUsed < maxAttempts && !isInCooldown

  // Timer styling
  const timerWarning = remainingSeconds <= 60
  const timerCaution = remainingSeconds <= 300 && remainingSeconds > 60

  // -------------------------------------------------------------------------
  // Start exam
  // -------------------------------------------------------------------------
  const handleStart = async () => {
    setPhase('loading')
    setError(null)

    try {
      const res = await fetch('/api/certifications/start-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `Failed to start exam (${res.status})`)
      }

      const data: StartExamResponse = await res.json()

      setAttemptId(data.attemptId)
      setQuestions(data.questions)
      setExpiresAt(new Date(data.expiresAt).getTime())
      setRemainingSeconds(
        Math.max(
          0,
          Math.floor(
            (new Date(data.expiresAt).getTime() - Date.now()) / 1000
          )
        )
      )
      setCurrentIndex(0)
      setAnswers(new Map())
      autoSubmittedRef.current = false
      setPhase('in-progress')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('pre-exam')
    }
  }

  // -------------------------------------------------------------------------
  // Set answer for current question
  // -------------------------------------------------------------------------
  const setAnswer = useCallback(
    (value: string) => {
      if (!currentQuestion) return
      setAnswers((prev) => {
        const next = new Map(prev)
        next.set(currentQuestion.id, value)
        return next
      })
    },
    [currentQuestion]
  )

  // -------------------------------------------------------------------------
  // Submit exam
  // -------------------------------------------------------------------------
  const handleSubmit = async () => {
    if (phase === 'submitting') return
    setPhase('submitting')
    setError(null)

    try {
      const payload = {
        attemptId,
        answers: questions.map((q) => ({
          questionId: q.id,
          answer: answers.get(q.id) ?? '',
        })),
      }

      const res = await fetch('/api/certifications/submit-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `Submission failed (${res.status})`)
      }

      const data: SubmitExamResponse = await res.json()
      setResult(data)
      setPhase('results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('in-progress')
    }
  }

  // -------------------------------------------------------------------------
  // Render: Pre-exam
  // -------------------------------------------------------------------------
  if (phase === 'pre-exam') {
    return (
      <div data-testid="cert-exam-player" className="min-h-screen bg-background">
        {/* Nav */}
        <nav className="border-b border-border bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a href="/" className="text-lg font-bold text-foreground">
                Throughput
              </a>
              <span className="text-foreground-subtle">/</span>
              <a
                href="/certifications"
                className="text-sm text-foreground-muted hover:text-foreground"
              >
                Certifications
              </a>
              <span className="text-foreground-subtle">/</span>
              <a
                href={`/certifications/${trackSlug}`}
                className="text-sm text-foreground-muted hover:text-foreground"
              >
                {trackTitle}
              </a>
            </div>
          </div>
        </nav>

        <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
          {/* Exam info card */}
          <div className="bg-surface border border-border rounded-xl shadow-card p-8 space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-foreground">
                Certification Exam
              </h1>
              <p className="text-lg text-foreground-muted">{trackTitle}</p>
            </div>

            {/* Exam details */}
            <div className="grid grid-cols-3 gap-4 py-4 border-y border-border">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {questionsPerExam}
                </div>
                <div className="text-sm text-foreground-muted">Questions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {examDurationMinutes} min
                </div>
                <div className="text-sm text-foreground-muted">Time Limit</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {passingScore}%
                </div>
                <div className="text-sm text-foreground-muted">
                  Passing Score
                </div>
              </div>
            </div>

            {/* Attempt info */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">
                  Attempts used (last 30 days)
                </span>
                <span
                  className={cn(
                    'font-medium',
                    attemptsUsed >= maxAttempts
                      ? 'text-destructive'
                      : 'text-foreground'
                  )}
                >
                  {attemptsUsed} / {maxAttempts}
                </span>
              </div>

              {/* Attempt progress bar */}
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    attemptsUsed >= maxAttempts
                      ? 'bg-destructive'
                      : 'bg-accent'
                  )}
                  style={{
                    width: `${(attemptsUsed / maxAttempts) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Rules */}
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-medium text-foreground">
                Exam Rules
              </h3>
              <ul className="text-sm text-foreground-muted space-y-1 list-disc list-inside">
                <li>
                  You have {examDurationMinutes} minutes to complete all{' '}
                  {questionsPerExam} questions
                </li>
                <li>
                  The exam will auto-submit when time runs out
                </li>
                <li>
                  You need {passingScore}% or higher to pass
                </li>
                <li>
                  Maximum {maxAttempts} attempts per 30-day period
                </li>
                <li>24-hour cooldown between attempts</li>
              </ul>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-destructive-muted border border-destructive/30 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Start button or cooldown/maxed state */}
            {isInCooldown && (
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-warning-muted border border-warning text-warning text-sm font-medium">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Next attempt available in {formatCountdown(cooldownMs)}
                </div>
              </div>
            )}

            {isMaxedOut && (
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive-muted border border-destructive/30 text-destructive text-sm font-medium">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  Maximum attempts reached for this 30-day period
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              {canStart ? (
                <button
                  data-testid="exam-start-btn"
                  onClick={handleStart}
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 rounded-lg bg-accent text-background font-medium hover:bg-accent-hover shadow-accent-glow transition-colors"
                >
                  {hasInProgressAttempt ? 'Resume Exam' : 'Start Exam'}
                </button>
              ) : (
                <button
                  disabled
                  data-testid="exam-start-btn"
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 rounded-lg bg-muted border border-border text-foreground-muted font-medium cursor-not-allowed opacity-50"
                >
                  Start Exam
                </button>
              )}
              <a
                href={`/certifications/${trackSlug}`}
                className="flex-1 inline-flex items-center justify-center px-6 py-3 rounded-lg bg-muted border border-border text-foreground font-medium hover:bg-raised transition-colors text-center"
              >
                Back to Track
              </a>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render: Loading
  // -------------------------------------------------------------------------
  if (phase === 'loading') {
    return (
      <div
        data-testid="cert-exam-player"
        className="min-h-screen bg-background flex flex-col items-center justify-center"
      >
        <Spinner className="mb-4" />
        <p className="text-lg font-medium text-foreground">
          Preparing your exam...
        </p>
        <p className="text-sm text-foreground-muted mt-2">
          Selecting {questionsPerExam} questions from the pool
        </p>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render: Submitting
  // -------------------------------------------------------------------------
  if (phase === 'submitting') {
    return (
      <div
        data-testid="cert-exam-player"
        className="min-h-screen bg-background flex flex-col items-center justify-center"
      >
        <Spinner className="mb-4" />
        <p className="text-lg font-medium text-foreground">
          Grading your exam...
        </p>
        <p className="text-sm text-foreground-muted mt-2">
          This may take a moment for open-ended questions
        </p>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render: Results
  // -------------------------------------------------------------------------
  if (phase === 'results' && result) {
    const passed = result.passed
    return (
      <div
        data-testid="cert-exam-player"
        className="min-h-screen bg-background"
      >
        {/* Nav */}
        <nav className="border-b border-border bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a href="/" className="text-lg font-bold text-foreground">
                Throughput
              </a>
              <span className="text-foreground-subtle">/</span>
              <a
                href="/certifications"
                className="text-sm text-foreground-muted hover:text-foreground"
              >
                Certifications
              </a>
              <span className="text-foreground-subtle">/</span>
              <a
                href={`/certifications/${trackSlug}`}
                className="text-sm text-foreground-muted hover:text-foreground"
              >
                {trackTitle}
              </a>
            </div>
          </div>
        </nav>

        <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
          <div
            data-testid="exam-result"
            className={cn(
              'bg-surface border rounded-xl shadow-card p-8 text-center space-y-6',
              passed
                ? 'border-success'
                : 'border-destructive/30'
            )}
          >
            {/* Result icon */}
            <div
              className={cn(
                'mx-auto w-20 h-20 rounded-full flex items-center justify-center',
                passed
                  ? 'bg-success-muted'
                  : 'bg-destructive-muted'
              )}
            >
              {passed ? (
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-success"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-destructive"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
            </div>

            {/* Status text */}
            <div className="space-y-2">
              <h1
                className={cn(
                  'text-3xl font-bold',
                  passed ? 'text-success' : 'text-destructive'
                )}
              >
                {passed ? 'Congratulations!' : 'Not Quite Yet'}
              </h1>
              <p className="text-foreground-muted">
                {passed
                  ? 'You passed the certification exam!'
                  : 'You did not meet the passing score this time.'}
              </p>
            </div>

            {/* Score display */}
            <div className="py-4">
              <div
                className={cn(
                  'text-5xl font-bold',
                  passed ? 'text-success' : 'text-destructive'
                )}
              >
                {Math.round(result.score)}%
              </div>
              <div className="text-sm text-foreground-muted mt-1">
                Passing score: {passingScore}%
              </div>
            </div>

            {/* Score progress bar */}
            <div className="max-w-xs mx-auto">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    passed ? 'bg-success' : 'bg-destructive'
                  )}
                  style={{ width: `${Math.min(100, Math.round(result.score))}%` }}
                />
              </div>
              {/* Passing threshold marker */}
              <div className="relative h-4">
                <div
                  className="absolute top-0 w-0.5 h-3 bg-foreground-muted"
                  style={{ left: `${passingScore}%` }}
                />
                <div
                  className="absolute top-3 text-xs text-foreground-muted -translate-x-1/2"
                  style={{ left: `${passingScore}%` }}
                >
                  {passingScore}%
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              {passed && result.certHash ? (
                <a
                  href={`/certifications/verify/${result.certHash}`}
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 rounded-lg bg-accent text-background font-medium hover:bg-accent-hover shadow-accent-glow transition-colors"
                >
                  View Certificate
                </a>
              ) : (
                <div className="flex-1 text-center">
                  <p className="text-sm text-foreground-muted mb-3">
                    Next attempt available in 24 hours
                  </p>
                </div>
              )}
              <a
                href={`/certifications/${trackSlug}`}
                className="flex-1 inline-flex items-center justify-center px-6 py-3 rounded-lg bg-muted border border-border text-foreground font-medium hover:bg-raised transition-colors text-center"
              >
                Back to Track
              </a>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render: In-progress (main exam interface)
  // -------------------------------------------------------------------------
  if (phase === 'in-progress' && currentQuestion) {
    return (
      <div data-testid="cert-exam-player" className="min-h-screen bg-background">
        {/* Top bar */}
        <div className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur-sm">
          <div className="mx-auto max-w-4xl px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-foreground truncate max-w-[200px] sm:max-w-none">
                {trackTitle}
              </h2>
            </div>
            <div
              data-testid="exam-timer"
              className={cn(
                'text-lg font-mono font-bold tabular-nums',
                timerWarning
                  ? 'text-destructive animate-pulse'
                  : timerCaution
                    ? 'text-warning'
                    : 'text-foreground'
              )}
            >
              {formatTime(remainingSeconds)}
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
          {/* Progress bar */}
          <div
            data-testid="exam-progress"
            className="bg-surface border border-border rounded-xl shadow-card p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-foreground-muted">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="text-sm font-medium text-accent">
                {answeredCount} answered
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{
                  width: `${((currentIndex + 1) / questions.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Question card */}
          <div
            data-testid="exam-question"
            className="bg-surface border border-border rounded-xl shadow-card p-6 space-y-6"
          >
            <p className="text-lg font-medium text-foreground">
              {currentQuestion.question_text}
            </p>

            {/* Multiple choice options */}
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

            {/* Open-ended textarea */}
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

            <div className="flex items-center gap-3">
              {!isLast ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => i + 1)}
                  className="rounded-lg bg-accent text-background px-4 py-2.5 text-sm font-medium
                    hover:bg-accent-hover transition-colors"
                >
                  Next
                </button>
              ) : (
                <button
                  data-testid="exam-submit-btn"
                  type="button"
                  onClick={handleSubmit}
                  disabled={!allAnswered}
                  className="rounded-lg bg-accent text-background px-6 py-2.5 text-sm font-medium
                    hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Submit Exam
                </button>
              )}
            </div>
          </div>

          {/* Question navigator dots */}
          <div className="flex flex-wrap gap-2 justify-center pt-4">
            {questions.map((q, idx) => {
              const isAnswered = answers.has(q.id)
              const isCurrent = idx === currentIndex
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Go to question ${idx + 1}`}
                  className={cn(
                    'w-8 h-8 rounded-lg text-xs font-medium transition-all',
                    isCurrent
                      ? 'bg-accent text-background'
                      : isAnswered
                        ? 'bg-accent-muted text-accent border border-accent/30'
                        : 'bg-muted text-foreground-muted border border-border hover:border-foreground-muted'
                  )}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>
        </main>
      </div>
    )
  }

  // Fallback (should not reach here)
  return null
}
