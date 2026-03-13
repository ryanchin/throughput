'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { generateSlug } from '@/lib/utils/slug'
import type { Database } from '@/lib/supabase/database.types'

type Course = Database['public']['Tables']['courses']['Row']

interface CourseFormProps {
  course?: Course
}

type FormErrors = {
  title?: string
  slug?: string
  description?: string
  zone?: string
  passing_score?: string
  cover_image_url?: string
  lessonCount?: string
  general?: string
}

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken'

export function CourseForm({ course }: CourseFormProps) {
  const router = useRouter()
  const isEdit = Boolean(course)

  const [title, setTitle] = useState(course?.title ?? '')
  const [slug, setSlug] = useState(course?.slug ?? '')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(isEdit)
  const [description, setDescription] = useState(course?.description ?? '')
  const [zone, setZone] = useState<'training' | 'sales'>(course?.zone ?? 'training')
  const [passingScore, setPassingScore] = useState(course?.passing_score ?? 70)
  const [coverImageUrl, setCoverImageUrl] = useState(course?.cover_image_url ?? '')

  const [aiMode, setAiMode] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [lessonCount, setLessonCount] = useState(5)
  const [includeQuizzes, setIncludeQuizzes] = useState(true)

  const [errors, setErrors] = useState<FormErrors>({})
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle')
  const [submitting, setSubmitting] = useState(false)

  // Auto-generate slug from title (only if slug hasn't been manually edited)
  useEffect(() => {
    if (!slugManuallyEdited && title) {
      setSlug(generateSlug(title))
      setSlugStatus('idle')
    }
  }, [title, slugManuallyEdited])

  // Check slug uniqueness on blur
  const checkSlugAvailability = useCallback(async (slugValue: string) => {
    if (!slugValue) {
      setSlugStatus('idle')
      return
    }

    setSlugStatus('checking')
    try {
      const params = new URLSearchParams({ slug: slugValue })
      if (course?.id) {
        params.set('excludeId', course.id)
      }
      const res = await fetch(`/api/admin/courses/check-slug?${params}`)
      if (!res.ok) {
        setSlugStatus('idle')
        return
      }
      const data = await res.json()
      setSlugStatus(data.available ? 'available' : 'taken')
    } catch {
      setSlugStatus('idle')
    }
  }, [course?.id])

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!title.trim()) errs.title = 'Title is required'
    if (title.length > 200) errs.title = 'Title must be 200 characters or less'
    if (!slug.trim()) {
      errs.slug = 'Slug is required'
    } else if (slug.length > 200) {
      errs.slug = 'Slug must be 200 characters or less'
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      errs.slug = 'Slug must be lowercase alphanumeric with hyphens'
    } else if (slugStatus === 'taken') {
      errs.slug = 'This slug is already taken'
    }
    if (aiMode && !description.trim()) {
      errs.description = 'Description is required when generating with AI'
    } else if (description && description.length > 2000) {
      errs.description = 'Description must be 2000 characters or less'
    }
    if (aiMode && (lessonCount < 1 || lessonCount > 20)) {
      errs.lessonCount = 'Lesson count must be between 1 and 20'
    }
    if (passingScore < 0 || passingScore > 100) {
      errs.passing_score = 'Passing score must be between 0 and 100'
    }
    if (coverImageUrl && !/^https?:\/\/.+/.test(coverImageUrl)) {
      errs.cover_image_url = 'Must be a valid URL'
    }
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors({})

    if (aiMode && !isEdit) {
      setGenerating(true)

      const aiBody = {
        title: title.trim(),
        zone,
        description: description.trim(),
        lessonCount,
        includeQuizzes,
      }

      try {
        const res = await fetch('/api/admin/generate/course', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aiBody),
        })

        if (!res.ok) {
          const data = await res.json()
          if (data.details) {
            const fieldErrors: FormErrors = {}
            for (const issue of data.details) {
              const field = issue.path?.[0] as keyof FormErrors
              if (field) fieldErrors[field] = issue.message
            }
            setErrors(fieldErrors)
          } else {
            setErrors({ general: data.error || 'Failed to generate course' })
          }
          return
        }

        const data = await res.json()
        router.push(`/admin/courses/${data.courseId}`)
      } catch {
        setErrors({ general: 'Network error. Please try again.' })
      } finally {
        setGenerating(false)
      }
      return
    }

    setSubmitting(true)

    const body = {
      title: title.trim(),
      slug,
      description: description.trim() || null,
      zone,
      passing_score: passingScore,
      cover_image_url: coverImageUrl.trim() || null,
    }

    try {
      const url = isEdit
        ? `/api/admin/courses/${course!.id}`
        : '/api/admin/courses'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        if (res.status === 409) {
          setErrors({ slug: 'A course with this slug already exists' })
          setSlugStatus('taken')
        } else if (data.details) {
          // Zod validation errors from API
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
      if (isEdit) {
        router.push(`/admin/courses/${course!.id}`)
        router.refresh()
      } else {
        router.push(`/admin/courses/${data.course.id}`)
      }
    } catch {
      setErrors({ general: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    {generating && (
      <div data-testid="generating-overlay" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mb-4" />
        <h2 className="text-lg font-semibold text-foreground">Generating your course draft...</h2>
        <p className="mt-2 text-sm text-foreground-muted">This typically takes 15-30 seconds</p>
      </div>
    )}
    <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 space-y-6">
      <h2 className="text-2xl font-semibold text-foreground">
        {isEdit ? 'Edit Course' : 'Create Course'}
      </h2>

      {!isEdit && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
          <div>
            <span className="text-sm font-medium text-foreground">Generate with AI</span>
            <p className="text-xs text-foreground-muted">Use AI to generate a full course draft with lessons and quizzes</p>
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
      )}

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
          placeholder="e.g. Sprint Planning Fundamentals"
          className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-foreground-subtle"
        />
        {errors.title && (
          <p className="text-xs text-destructive">{errors.title}</p>
        )}
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <label htmlFor="slug" className="text-sm font-medium text-foreground">
          Slug
        </label>
        <div className="relative">
          <input
            id="slug"
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value)
              setSlugManuallyEdited(true)
              setSlugStatus('idle')
            }}
            onBlur={() => checkSlugAvailability(slug)}
            placeholder="auto-generated-from-title"
            className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 pr-10 focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-foreground-subtle font-mono text-sm"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {slugStatus === 'checking' && (
              <span className="text-foreground-muted text-xs" aria-label="Checking slug availability">...</span>
            )}
            {slugStatus === 'available' && (
              <span className="text-success text-sm" aria-label="Slug is available">&#10003;</span>
            )}
            {slugStatus === 'taken' && (
              <span className="text-destructive text-sm" aria-label="Slug is taken">&#10007;</span>
            )}
          </div>
        </div>
        <p className="text-xs text-foreground-muted">
          URL-friendly identifier. Auto-generated from title unless manually edited.
        </p>
        {errors.slug && (
          <p className="text-xs text-destructive">{errors.slug}</p>
        )}
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
          placeholder="What will learners gain from this course?"
          rows={4}
          className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-foreground-subtle resize-y"
        />
        <p className="text-xs text-foreground-muted text-right">
          {description.length}/2000
        </p>
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description}</p>
        )}
      </div>

      {/* AI Mode Fields */}
      {aiMode && !isEdit && (
        <div className="space-y-4 rounded-lg border border-accent-muted bg-raised p-4">
          <div className="space-y-1.5">
            <label htmlFor="lesson-count" className="text-sm font-medium text-foreground">
              Number of Lessons
            </label>
            <input
              id="lesson-count"
              data-testid="lesson-count-input"
              type="number"
              value={lessonCount}
              onChange={(e) => setLessonCount(Number(e.target.value))}
              min={1}
              max={20}
              className="w-32 bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
            />
            <p className="text-xs text-foreground-muted">Between 1 and 20 lessons</p>
            {errors.lessonCount && (
              <p className="text-xs text-destructive">{errors.lessonCount}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-foreground">Include Quizzes</span>
              <p className="text-xs text-foreground-muted">Generate quiz questions for each lesson</p>
            </div>
            <button
              type="button"
              data-testid="include-quizzes-toggle"
              onClick={() => setIncludeQuizzes((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background ${
                includeQuizzes ? 'bg-accent' : 'bg-muted'
              }`}
              role="switch"
              aria-checked={includeQuizzes}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-foreground shadow ring-0 transition-transform duration-200 ease-in-out ${
                  includeQuizzes ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Zone */}
      <div className="space-y-1.5">
        <label htmlFor="zone" className="text-sm font-medium text-foreground">
          Zone
        </label>
        <select
          id="zone"
          value={zone}
          onChange={(e) => setZone(e.target.value as 'training' | 'sales')}
          className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
        >
          <option value="training">Training</option>
          <option value="sales">Sales</option>
        </select>
        {errors.zone && (
          <p className="text-xs text-destructive">{errors.zone}</p>
        )}
      </div>

      {/* Passing Score */}
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
          className="w-32 bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
        />
        {errors.passing_score && (
          <p className="text-xs text-destructive">{errors.passing_score}</p>
        )}
      </div>

      {/* Cover Image URL */}
      <div className="space-y-1.5">
        <label htmlFor="cover-image" className="text-sm font-medium text-foreground">
          Cover Image URL
        </label>
        <input
          id="cover-image"
          type="text"
          value={coverImageUrl}
          onChange={(e) => setCoverImageUrl(e.target.value)}
          placeholder="https://example.com/image.jpg"
          className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-foreground-subtle"
        />
        <p className="text-xs text-foreground-muted">
          Optional. Full upload support coming in a future iteration.
        </p>
        {errors.cover_image_url && (
          <p className="text-xs text-destructive">{errors.cover_image_url}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting || generating}
          className="bg-accent text-background hover:bg-accent-hover rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {aiMode && !isEdit
            ? (generating ? 'Generating...' : 'Generate Course')
            : submitting
              ? (isEdit ? 'Saving...' : 'Creating...')
              : (isEdit ? 'Save Changes' : 'Create Course')}
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
    </>
  )
}
