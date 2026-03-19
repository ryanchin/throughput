'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { generateSlug } from '@/lib/utils/slug'
import { AiContextPanel } from '@/components/admin/AiContextPanel'

type TrackOption = {
  id: string
  title: string
  tier: number
}

type FormErrors = {
  title?: string
  slug?: string
  description?: string
  tier?: string
  passing_score?: string
  exam_duration_minutes?: string
  questions_per_exam?: string
  question_pool_size?: string
  prerequisite_track_id?: string
  questionCount?: string
  general?: string
}

const PROGRESS_MESSAGES = [
  'Generating exam questions...',
  'Creating answer rubrics...',
  'Almost there...',
]

export default function NewCertTrackPage() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [tier, setTier] = useState(1)
  const [domain, setDomain] = useState('')
  const [description, setDescription] = useState('')
  const [prerequisiteTrackId, setPrerequisiteTrackId] = useState('')
  const [passingScore, setPassingScore] = useState(80)
  const [examDurationMinutes, setExamDurationMinutes] = useState(60)
  const [questionsPerExam, setQuestionsPerExam] = useState(30)
  const [questionPoolSize, setQuestionPoolSize] = useState(50)

  const [existingTracks, setExistingTracks] = useState<TrackOption[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  // AI mode state
  const [aiMode, setAiMode] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [progressIndex, setProgressIndex] = useState(0)
  const [questionCount, setQuestionCount] = useState(30)

  // AI context state
  const [instructions, setInstructions] = useState('')
  const [preset, setPreset] = useState<string | null>(null)
  const [fileText, setFileText] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileWordCount, setFileWordCount] = useState(0)
  const [fileUploading, setFileUploading] = useState(false)
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([])

  // Fetch existing tracks for prerequisite dropdown
  useEffect(() => {
    async function fetchTracks() {
      try {
        const res = await fetch('/api/admin/certifications')
        if (res.ok) {
          const data = await res.json()
          setExistingTracks(
            (data.tracks ?? []).map((t: { id: string; title: string; tier: number }) => ({
              id: t.id,
              title: t.title,
              tier: t.tier,
            }))
          )
        }
      } catch {
        // Non-critical -- prerequisite dropdown will just be empty
      }
    }
    fetchTracks()
  }, [])

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManuallyEdited && title) {
      setSlug(generateSlug(title))
    }
  }, [title, slugManuallyEdited])

  // Progressive overlay messages
  useEffect(() => {
    if (!generating) {
      setProgressIndex(0)
      return
    }
    const intervals = [5000, 12000]
    const timers = intervals.map((delay, i) =>
      setTimeout(() => setProgressIndex(i + 1), delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [generating])

  const validate = useCallback((): FormErrors => {
    const errs: FormErrors = {}
    if (!title.trim()) errs.title = 'Title is required'
    if (title.length > 200) errs.title = 'Title must be 200 characters or less'
    if (!slug.trim()) {
      errs.slug = 'Slug is required'
    } else if (slug.length > 200) {
      errs.slug = 'Slug must be 200 characters or less'
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      errs.slug = 'Slug must be lowercase alphanumeric with hyphens'
    }
    if (aiMode && !description.trim()) {
      errs.description = 'Description is required when generating with AI'
    } else if (description && description.length > 2000) {
      errs.description = 'Description must be 2000 characters or less'
    }
    if (tier < 1 || tier > 3) errs.tier = 'Tier must be 1, 2, or 3'
    if (passingScore < 0 || passingScore > 100) {
      errs.passing_score = 'Passing score must be between 0 and 100'
    }
    if (examDurationMinutes < 1 || examDurationMinutes > 480) {
      errs.exam_duration_minutes = 'Exam duration must be between 1 and 480 minutes'
    }
    if (questionsPerExam < 1 || questionsPerExam > 200) {
      errs.questions_per_exam = 'Questions per exam must be between 1 and 200'
    }
    if (questionPoolSize < 1 || questionPoolSize > 500) {
      errs.question_pool_size = 'Question pool size must be between 1 and 500'
    }
    if (questionsPerExam > questionPoolSize) {
      errs.questions_per_exam = 'Questions per exam cannot exceed pool size'
    }
    if (aiMode && (questionCount < 1 || questionCount > 100)) {
      errs.questionCount = 'Question count must be between 1 and 100'
    }
    return errs
  }, [title, slug, description, tier, passingScore, examDurationMinutes, questionsPerExam, questionPoolSize, aiMode, questionCount])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors({})
    setSubmitting(true)

    const body = {
      title: title.trim(),
      slug,
      tier,
      domain: domain.trim() || null,
      description: description.trim() || null,
      prerequisite_track_id: prerequisiteTrackId || null,
      passing_score: passingScore,
      exam_duration_minutes: examDurationMinutes,
      questions_per_exam: questionsPerExam,
      question_pool_size: questionPoolSize,
    }

    try {
      // Step 1: Create the certification track
      const res = await fetch('/api/admin/certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        if (res.status === 409) {
          setErrors({ slug: 'A certification track with this slug already exists' })
        } else if (data.details) {
          const fieldErrors: FormErrors = {}
          for (const issue of data.details) {
            const field = issue.path?.[0] as keyof FormErrors
            if (field) fieldErrors[field] = issue.message
          }
          setErrors(fieldErrors)
        } else {
          setErrors({ general: data.error || 'Something went wrong' })
        }
        return
      }

      const trackData = await res.json()
      const trackId = trackData.track.id

      // Step 2: If AI mode, generate questions and write them
      if (aiMode) {
        setSubmitting(false)
        setGenerating(true)

        try {
          // Call the certification generation API
          const genRes = await fetch('/api/admin/generate/certification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trackTitle: title.trim(),
              trackDescription: description.trim() || undefined,
              questionCount,
              questionTypes: ['multiple_choice', 'open_ended'],
              instructions: instructions.trim() || undefined,
              preset: preset || undefined,
              fileText: fileText || undefined,
              fileName: fileName || undefined,
              courseIds: selectedCourseIds.length > 0 ? selectedCourseIds : undefined,
            }),
          })

          if (!genRes.ok) {
            const genData = await genRes.json()
            setErrors({ general: genData.error || 'Failed to generate questions' })
            // Still redirect to the track editor so the admin can add questions manually
            router.push(`/admin/certifications/${trackId}`)
            return
          }

          const genData = await genRes.json()
          const questions = genData.questions as Array<{
            question_text: string
            question_type: string
            options: Array<{ text: string; is_correct: boolean }> | null
            correct_answer: string | null
            rubric: string | null
            difficulty: string
            max_points: number
          }>

          // Write each question to the DB via the questions API
          let writeErrors = 0
          for (const q of questions) {
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
              if (!writeRes.ok) writeErrors++
            } catch {
              writeErrors++
            }
          }

          if (writeErrors > 0) {
            // Non-fatal: some questions failed to write but we still redirect
            console.warn(`${writeErrors} of ${questions.length} questions failed to write`)
          }
        } catch {
          setErrors({ general: 'Failed to generate questions. Track was created -- you can add questions manually.' })
        } finally {
          setGenerating(false)
        }
      }

      router.push(`/admin/certifications/${trackId}`)
    } catch {
      setErrors({ general: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
      setGenerating(false)
    }
  }

  // Build context summary for overlay
  const contextParts: string[] = []
  if (fileName) contextParts.push(fileName)
  if (selectedCourseIds.length > 0) contextParts.push(`${selectedCourseIds.length} course${selectedCourseIds.length > 1 ? 's' : ''}`)
  if (instructions.trim()) contextParts.push('your instructions')
  const contextSummary = contextParts.length > 0 ? `Using: ${contextParts.join(' + ')}` : ''

  return (
    <>
      {generating && (
        <div data-testid="generating-overlay" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mb-4" />
          <h2 className="text-lg font-semibold text-foreground">Generating certification questions...</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            {PROGRESS_MESSAGES[Math.min(progressIndex, PROGRESS_MESSAGES.length - 1)]}
          </p>
          {contextSummary && (
            <p className="mt-1 text-xs text-foreground-muted">{contextSummary}</p>
          )}
        </div>
      )}

      <div className="max-w-2xl" data-testid="new-cert-track-form">
        <Link
          href="/admin/certifications"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
        >
          &larr; Back to Certification Tracks
        </Link>

        <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">New Certification Track</h2>

          {/* AI Mode Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
            <div>
              <span className="text-sm font-medium text-foreground">Generate with AI</span>
              <p className="text-xs text-foreground-muted">Use AI to generate initial exam questions for the question pool</p>
            </div>
            <button
              type="button"
              data-testid="ai-mode-toggle"
              onClick={() => setAiMode((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background ${
                aiMode ? 'bg-accent' : 'bg-muted'
              }`}
              role="switch"
              aria-checked={aiMode}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-foreground shadow ring-0 transition-transform duration-200 ease-in-out ${
                  aiMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {errors.general && (
            <div className="rounded-lg border border-destructive/50 bg-destructive-muted px-4 py-3 text-sm text-destructive">
              {errors.general}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="title" className="text-sm font-medium text-foreground">
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. AAVA Foundations Certification"
              className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-foreground-subtle"
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <label htmlFor="slug" className="text-sm font-medium text-foreground">
              Slug
            </label>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value)
                setSlugManuallyEdited(true)
              }}
              placeholder="auto-generated-from-title"
              className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-foreground-subtle font-mono text-sm"
            />
            <p className="text-xs text-foreground-muted">
              URL-friendly identifier. Auto-generated from title unless manually edited.
            </p>
            {errors.slug && <p className="text-xs text-destructive">{errors.slug}</p>}
          </div>

          {/* Tier + Domain row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="tier" className="text-sm font-medium text-foreground">
                Tier
              </label>
              <select
                id="tier"
                value={tier}
                onChange={(e) => setTier(Number(e.target.value))}
                className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              >
                <option value={1}>Tier 1 -- Foundations</option>
                <option value={2}>Tier 2 -- Practitioner</option>
                <option value={3}>Tier 3 -- Specialist</option>
              </select>
              {errors.tier && <p className="text-xs text-destructive">{errors.tier}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="domain" className="text-sm font-medium text-foreground">
                Domain <span className="text-foreground-muted">(optional)</span>
              </label>
              <input
                id="domain"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. sprint_planning"
                className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-foreground-subtle"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="description" className="text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this certification validate? Who is it for?"
              rows={4}
              className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-foreground-subtle resize-y"
            />
            <p className="text-xs text-foreground-muted text-right">{description.length}/2000</p>
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          {/* AI Context Panel */}
          {aiMode && (
            <AiContextPanel
              instructions={instructions}
              onInstructionsChange={setInstructions}
              preset={preset}
              onPresetChange={setPreset}
              fileText={fileText}
              fileName={fileName}
              fileWordCount={fileWordCount}
              onFileUploaded={(data) => {
                setFileText(data.text)
                setFileName(data.name)
                setFileWordCount(data.wordCount)
              }}
              onFileRemoved={() => {
                setFileText(null)
                setFileName(null)
                setFileWordCount(0)
              }}
              fileUploading={fileUploading}
              onFileUploadStart={() => setFileUploading(true)}
              selectedCourseIds={selectedCourseIds}
              onCourseIdsChange={setSelectedCourseIds}
              showCoursePicker={true}
            >
              {/* Question generation settings */}
              <div className="space-y-4 pt-2 border-t border-border">
                <div className="space-y-1.5">
                  <label htmlFor="question-count" className="text-sm font-medium text-foreground">
                    Questions to Generate
                  </label>
                  <input
                    id="question-count"
                    data-testid="question-count-input"
                    type="number"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    min={1}
                    max={100}
                    className="w-32 bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                  />
                  <p className="text-xs text-foreground-muted">Between 1 and 100 questions (mix of multiple choice and open-ended)</p>
                  {errors.questionCount && <p className="text-xs text-destructive">{errors.questionCount}</p>}
                </div>
              </div>
            </AiContextPanel>
          )}

          {/* Prerequisite Track */}
          <div className="space-y-1.5">
            <label htmlFor="prerequisite" className="text-sm font-medium text-foreground">
              Prerequisite Track <span className="text-foreground-muted">(optional)</span>
            </label>
            <select
              id="prerequisite"
              value={prerequisiteTrackId}
              onChange={(e) => setPrerequisiteTrackId(e.target.value)}
              className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
            >
              <option value="">None</option>
              {existingTracks.map((t) => (
                <option key={t.id} value={t.id}>
                  Tier {t.tier} -- {t.title}
                </option>
              ))}
            </select>
            {errors.prerequisite_track_id && (
              <p className="text-xs text-destructive">{errors.prerequisite_track_id}</p>
            )}
          </div>

          {/* Exam Settings */}
          <div className="space-y-4 rounded-lg border border-border bg-background p-4">
            <h3 className="text-sm font-semibold text-foreground">Exam Settings</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="passing-score" className="text-sm font-medium text-foreground">
                  Passing Score (%)
                </label>
                <input
                  id="passing-score"
                  type="number"
                  value={passingScore}
                  onChange={(e) => setPassingScore(Number(e.target.value))}
                  min={0}
                  max={100}
                  className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                />
                {errors.passing_score && (
                  <p className="text-xs text-destructive">{errors.passing_score}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="exam-duration" className="text-sm font-medium text-foreground">
                  Exam Duration (min)
                </label>
                <input
                  id="exam-duration"
                  type="number"
                  value={examDurationMinutes}
                  onChange={(e) => setExamDurationMinutes(Number(e.target.value))}
                  min={1}
                  max={480}
                  className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                />
                {errors.exam_duration_minutes && (
                  <p className="text-xs text-destructive">{errors.exam_duration_minutes}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="questions-per-exam" className="text-sm font-medium text-foreground">
                  Questions per Exam
                </label>
                <input
                  id="questions-per-exam"
                  type="number"
                  value={questionsPerExam}
                  onChange={(e) => setQuestionsPerExam(Number(e.target.value))}
                  min={1}
                  max={200}
                  className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                />
                {errors.questions_per_exam && (
                  <p className="text-xs text-destructive">{errors.questions_per_exam}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="pool-size" className="text-sm font-medium text-foreground">
                  Question Pool Size
                </label>
                <input
                  id="pool-size"
                  type="number"
                  value={questionPoolSize}
                  onChange={(e) => setQuestionPoolSize(Number(e.target.value))}
                  min={1}
                  max={500}
                  className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                />
                {errors.question_pool_size && (
                  <p className="text-xs text-destructive">{errors.question_pool_size}</p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting || generating}
              className="bg-accent text-background hover:bg-accent-hover rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {aiMode
                ? (submitting || generating ? 'Creating...' : 'Create Track & Generate Questions')
                : (submitting ? 'Creating...' : 'Create Track')}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="bg-muted border border-border text-foreground hover:bg-raised rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
