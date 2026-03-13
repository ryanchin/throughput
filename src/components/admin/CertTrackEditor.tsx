'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { generateSlug } from '@/lib/utils/slug'
import { StatusBadge } from '@/components/admin/StatusBadge'
import type { Database } from '@/lib/supabase/database.types'

type CertTrack = Database['public']['Tables']['certification_tracks']['Row']

interface CertTrackEditorProps {
  track: CertTrack
  availableTracks: { id: string; title: string; tier: number }[]
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
  general?: string
}

export function CertTrackEditor({ track, availableTracks }: CertTrackEditorProps) {
  const router = useRouter()

  const [title, setTitle] = useState(track.title)
  const [slug, setSlug] = useState(track.slug)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(true)
  const [tier, setTier] = useState(track.tier)
  const [domain, setDomain] = useState(track.domain ?? '')
  const [description, setDescription] = useState(track.description ?? '')
  const [prerequisiteTrackId, setPrerequisiteTrackId] = useState(track.prerequisite_track_id ?? '')
  const [passingScore, setPassingScore] = useState(track.passing_score)
  const [examDurationMinutes, setExamDurationMinutes] = useState(track.exam_duration_minutes)
  const [questionsPerExam, setQuestionsPerExam] = useState(track.questions_per_exam)
  const [questionPoolSize, setQuestionPoolSize] = useState(track.question_pool_size)
  const [status, setStatus] = useState(track.status)

  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

  // Auto-generate slug from title when not manually edited
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

  async function handleSave(e: React.FormEvent) {
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
      const res = await fetch(`/api/admin/certifications/${track.id}`, {
        method: 'PATCH',
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

      router.refresh()
    } catch {
      setErrors({ general: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatusToggle() {
    const newStatus = status === 'published' ? 'draft' : 'published'
    setStatusUpdating(true)

    try {
      const res = await fetch(`/api/admin/certifications/${track.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const data = await res.json()
        setErrors({ general: data.error || 'Failed to update status' })
        return
      }

      setStatus(newStatus)
      router.refresh()
    } catch {
      setErrors({ general: 'Network error. Please try again.' })
    } finally {
      setStatusUpdating(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)

    try {
      const res = await fetch(`/api/admin/certifications/${track.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        setErrors({ general: data.error || 'Failed to delete track' })
        setDeleting(false)
        setShowDeleteConfirm(false)
        return
      }

      router.push('/admin/certifications')
    } catch {
      setErrors({ general: 'Network error. Please try again.' })
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div data-testid="cert-track-editor">
      <form onSubmit={handleSave} className="bg-surface border border-border rounded-xl p-6 space-y-6">
        {/* Header with status */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-foreground">Edit Track</h2>
          <div className="flex items-center gap-3">
            <StatusBadge status={status} />
            <button
              type="button"
              onClick={handleStatusToggle}
              disabled={statusUpdating}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background ${
                status === 'published' ? 'bg-success' : 'bg-[var(--background-muted)]'
              } ${statusUpdating ? 'opacity-50' : ''}`}
              role="switch"
              aria-checked={status === 'published'}
              data-testid="status-toggle"
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  status === 'published' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
              <span className="sr-only">{status === 'published' ? 'Unpublish' : 'Publish'}</span>
            </button>
          </div>
        </div>

        {errors.general && (
          <div className="rounded-lg border border-destructive/50 bg-destructive-muted px-4 py-3 text-sm text-destructive">
            {errors.general}
          </div>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <label htmlFor="edit-title" className="text-sm font-medium text-foreground">
            Title
          </label>
          <input
            id="edit-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-foreground-subtle"
          />
          {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
        </div>

        {/* Slug */}
        <div className="space-y-1.5">
          <label htmlFor="edit-slug" className="text-sm font-medium text-foreground">
            Slug
          </label>
          <input
            id="edit-slug"
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value)
              setSlugManuallyEdited(true)
            }}
            className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-foreground-subtle font-mono text-sm"
          />
          {errors.slug && <p className="text-xs text-destructive">{errors.slug}</p>}
        </div>

        {/* Tier + Domain row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="edit-tier" className="text-sm font-medium text-foreground">
              Tier
            </label>
            <select
              id="edit-tier"
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
            <label htmlFor="edit-domain" className="text-sm font-medium text-foreground">
              Domain <span className="text-foreground-muted">(optional)</span>
            </label>
            <input
              id="edit-domain"
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
          <label htmlFor="edit-description" className="text-sm font-medium text-foreground">
            Description
          </label>
          <textarea
            id="edit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-foreground-subtle resize-y"
          />
          <p className="text-xs text-foreground-muted text-right">{description.length}/2000</p>
          {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
        </div>

        {/* Prerequisite Track */}
        <div className="space-y-1.5">
          <label htmlFor="edit-prerequisite" className="text-sm font-medium text-foreground">
            Prerequisite Track <span className="text-foreground-muted">(optional)</span>
          </label>
          <select
            id="edit-prerequisite"
            value={prerequisiteTrackId}
            onChange={(e) => setPrerequisiteTrackId(e.target.value)}
            className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
          >
            <option value="">None</option>
            {availableTracks.map((t) => (
              <option key={t.id} value={t.id}>
                Tier {t.tier} — {t.title}
              </option>
            ))}
          </select>
        </div>

        {/* Exam Settings */}
        <div className="space-y-4 rounded-lg border border-border bg-background p-4">
          <h3 className="text-sm font-semibold text-foreground">Exam Settings</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="edit-passing-score" className="text-sm font-medium text-foreground">
                Passing Score (%)
              </label>
              <input
                id="edit-passing-score"
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
              <label htmlFor="edit-exam-duration" className="text-sm font-medium text-foreground">
                Exam Duration (min)
              </label>
              <input
                id="edit-exam-duration"
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
              <label htmlFor="edit-questions-per-exam" className="text-sm font-medium text-foreground">
                Questions per Exam
              </label>
              <input
                id="edit-questions-per-exam"
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
              <label htmlFor="edit-pool-size" className="text-sm font-medium text-foreground">
                Question Pool Size
              </label>
              <input
                id="edit-pool-size"
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
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="bg-accent text-background hover:bg-accent-hover rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm text-destructive hover:text-destructive/80 transition-colors"
            data-testid="delete-track-button"
          >
            Delete Track
          </button>
        </div>
      </form>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-card" data-testid="delete-confirm-dialog">
            <h3 className="text-lg font-semibold text-foreground">Delete Certification Track</h3>
            <p className="mt-2 text-sm text-foreground-muted">
              Are you sure you want to delete &ldquo;{track.title}&rdquo;? This will also delete all
              questions in the pool. This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="bg-muted border border-border text-foreground hover:bg-raised rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-white hover:bg-destructive/90 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="confirm-delete-button"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
