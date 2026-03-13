'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { generateSlug } from '@/lib/utils/slug'

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
  general?: string
}

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
        // Non-critical — prerequisite dropdown will just be empty
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
    if (description && description.length > 2000) {
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
    return errs
  }, [title, slug, description, tier, passingScore, examDurationMinutes, questionsPerExam, questionPoolSize])

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

      const data = await res.json()
      router.push(`/admin/certifications/${data.track.id}`)
    } catch {
      setErrors({ general: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl" data-testid="new-cert-track-form">
      <Link
        href="/admin/certifications"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
      >
        &larr; Back to Certification Tracks
      </Link>

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 space-y-6">
        <h2 className="text-2xl font-semibold text-foreground">New Certification Track</h2>

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
              <option value={1}>Tier 1 — Foundations</option>
              <option value={2}>Tier 2 — Practitioner</option>
              <option value={3}>Tier 3 — Specialist</option>
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
                Tier {t.tier} — {t.title}
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
            disabled={submitting}
            className="bg-accent text-background hover:bg-accent-hover rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Creating...' : 'Create Track'}
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
  )
}
