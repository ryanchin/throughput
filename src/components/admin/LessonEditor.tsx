'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { StatusBadge } from './StatusBadge'
import { QuizBuilder } from './QuizBuilder'
import type { Database } from '@/lib/supabase/database.types'
import type { JSONContent } from '@tiptap/react'

type Quiz = Database['public']['Tables']['quizzes']['Row']
type Question = Database['public']['Tables']['questions']['Row']

const BlockEditor = dynamic(() => import('@/components/editor/BlockEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-border bg-surface">
      <span className="text-sm text-foreground-muted">Loading editor...</span>
    </div>
  ),
})

type Lesson = Database['public']['Tables']['lessons']['Row']
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface LessonEditorProps {
  courseId: string
  lesson: Lesson
  initialQuiz: Quiz | null
  initialQuestions: Question[]
}

export function LessonEditor({ courseId, lesson: initialLesson, initialQuiz, initialQuestions }: LessonEditorProps) {
  const router = useRouter()
  const [lesson, setLesson] = useState<Lesson>(initialLesson)
  const [title, setTitle] = useState(initialLesson.title)
  const [slug, setSlug] = useState(initialLesson.slug)
  const [metaSaveStatus, setMetaSaveStatus] = useState<SaveStatus>('idle')
  const [regenerating, setRegenerating] = useState(false)
  const [contentSaveStatus, setContentSaveStatus] = useState<SaveStatus>('idle')
  const metaSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (metaSaveTimerRef.current) clearTimeout(metaSaveTimerRef.current)
    }
  }, [])

  /** PATCH lesson metadata with debounce */
  const saveMetadata = useCallback(
    (updates: { title?: string; slug?: string }) => {
      setMetaSaveStatus('saving')
      if (metaSaveTimerRef.current) clearTimeout(metaSaveTimerRef.current)

      metaSaveTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/admin/courses/${courseId}/lessons/${lesson.id}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates),
            }
          )

          if (!res.ok) {
            const err = await res.json()
            setMetaSaveStatus('error')
            console.error('Failed to save metadata:', err.error)
            return
          }

          const { lesson: updated } = await res.json()
          setLesson(updated)
          setMetaSaveStatus('saved')
          setTimeout(() => setMetaSaveStatus('idle'), 2000)
        } catch {
          setMetaSaveStatus('error')
        }
      }, 1000)
    },
    [courseId, lesson.id]
  )

  /** Handle title change */
  function handleTitleChange(value: string) {
    setTitle(value)
    if (value.trim()) {
      saveMetadata({ title: value })
    }
  }

  /** Handle slug change */
  function handleSlugChange(value: string) {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setSlug(cleaned)
    if (cleaned) {
      saveMetadata({ slug: cleaned })
    }
  }

  /** Save editor content */
  const handleContentSave = useCallback(
    async (content: JSONContent) => {
      setContentSaveStatus('saving')
      try {
        const res = await fetch(
          `/api/admin/courses/${courseId}/lessons/${lesson.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
          }
        )

        if (!res.ok) {
          setContentSaveStatus('error')
          return
        }

        setContentSaveStatus('saved')
        setTimeout(() => setContentSaveStatus('idle'), 2000)
      } catch {
        setContentSaveStatus('error')
      }
    },
    [courseId, lesson.id]
  )

  /** Regenerate lesson content with AI */
  async function handleRegenerateLesson() {
    if (lesson.content) {
      const confirmed = window.confirm(
        'Replace existing content? This will overwrite the current lesson content with AI-generated content.'
      )
      if (!confirmed) return
    }

    setRegenerating(true)
    try {
      const generateRes = await fetch('/api/admin/generate/lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseTitle: title,
          lessonTitle: title,
          additionalNotes: '',
        }),
      })

      if (!generateRes.ok) {
        const err = await generateRes.json()
        alert(err.error || 'Failed to generate lesson content')
        return
      }

      const { content } = await generateRes.json()

      // Save the generated content to the lesson
      const patchRes = await fetch(
        `/api/admin/courses/${courseId}/lessons/${lesson.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        }
      )

      if (!patchRes.ok) {
        alert('Generated content but failed to save it. Please try again.')
        return
      }

      router.refresh()
    } catch {
      alert('An error occurred while generating lesson content.')
    } finally {
      setRegenerating(false)
    }
  }

  /** Resolve a combined save status for the header indicator */
  function getCombinedStatus(): SaveStatus {
    if (metaSaveStatus === 'saving' || contentSaveStatus === 'saving') return 'saving'
    if (metaSaveStatus === 'error' || contentSaveStatus === 'error') return 'error'
    if (metaSaveStatus === 'saved' || contentSaveStatus === 'saved') return 'saved'
    return 'idle'
  }

  const combinedStatus = getCombinedStatus()

  return (
    <div data-testid="lesson-editor">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/courses/${courseId}`}
            className="rounded-md border border-border bg-background p-1.5 text-foreground-muted transition-colors hover:bg-raised hover:text-foreground"
            data-testid="back-to-course"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to course</span>
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">Edit Lesson</h1>
          <StatusBadge status={lesson.status} />
        </div>

        {/* Auto-save indicator */}
        <div className="flex items-center gap-1.5 text-sm" data-testid="auto-save-indicator">
          {combinedStatus === 'saving' && (
            <span className="text-foreground-muted">Saving...</span>
          )}
          {combinedStatus === 'saved' && (
            <span className="text-success">Saved</span>
          )}
          {combinedStatus === 'error' && (
            <span className="text-destructive">Error saving</span>
          )}
        </div>
      </div>

      {/* Main layout: 2/3 editor + 1/3 sidebar */}
      <div className="flex gap-6">
        {/* Left: metadata + editor */}
        <div className="flex-[2] min-w-0">
          {/* Metadata fields */}
          <div className="mb-4 rounded-xl border border-border bg-surface p-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label
                  htmlFor="lesson-title"
                  className="mb-1.5 block text-xs font-medium text-foreground-muted"
                >
                  Title
                </label>
                <input
                  id="lesson-title"
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="Lesson title"
                  data-testid="lesson-title-input"
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor="lesson-slug"
                  className="mb-1.5 block text-xs font-medium text-foreground-muted"
                >
                  Slug
                </label>
                <input
                  id="lesson-slug"
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-foreground-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="lesson-slug"
                  data-testid="lesson-slug-input"
                />
              </div>
            </div>
            <div className="mt-3">
              <button
                type="button"
                onClick={handleRegenerateLesson}
                disabled={regenerating}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:bg-raised hover:text-foreground disabled:opacity-50"
                data-testid="regenerate-lesson-button"
              >
                {regenerating ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Regenerate with AI
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Block editor */}
          <BlockEditor
            initialContent={lesson.content as JSONContent | undefined}
            onSave={handleContentSave}
            editable
            placeholder="Start writing lesson content..."
          />
        </div>

        {/* Right: sidebar */}
        <div className="flex-1 min-w-[280px]">
          <QuizBuilder
            courseId={courseId}
            lessonId={lesson.id}
            initialQuiz={initialQuiz}
            initialQuestions={initialQuestions}
          />
        </div>
      </div>
    </div>
  )
}
