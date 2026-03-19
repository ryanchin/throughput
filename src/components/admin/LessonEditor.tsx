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
  const [editorKey, setEditorKey] = useState(0) // increment to force BlockEditor remount
  const [metaSaveStatus, setMetaSaveStatus] = useState<SaveStatus>('idle')
  const [regenerating, setRegenerating] = useState(false)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [adjustmentInstructions, setAdjustmentInstructions] = useState('')
  const [alsoRegenerateQuiz, setAlsoRegenerateQuiz] = useState(true)
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

  /** Regenerate or adjust lesson content with AI */
  async function handleRegenerateLesson(mode: 'regenerate' | 'adjust') {
    if (mode === 'regenerate' && lesson.content) {
      const confirmed = window.confirm(
        'Replace existing content? This will overwrite the current lesson content with AI-generated content.'
      )
      if (!confirmed) return
    }

    setRegenerating(true)
    try {
      // Build instructions: for adjustment mode, include current content context + specific instructions
      let instructions = adjustmentInstructions.trim()
      if (mode === 'adjust' && lesson.content) {
        // Extract current content text for context
        const currentText = extractTiptapText(lesson.content)
        instructions = `ADJUSTMENT MODE: The lesson already has content. Make the following specific adjustments to the existing content while keeping the overall structure:\n\n${adjustmentInstructions}\n\nCurrent content for reference:\n${currentText.slice(0, 4000)}`
      }

      const generateRes = await fetch('/api/admin/generate/lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseTitle: title,
          lessonTitle: title,
          additionalNotes: adjustmentInstructions.trim() || undefined,
          instructions: instructions || undefined,
        }),
      })

      if (!generateRes.ok) {
        const err = await generateRes.json()
        alert(err.error || 'Failed to generate lesson content')
        return
      }

      const { content } = await generateRes.json()

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

      // Update local state and force BlockEditor remount with new content
      const { lesson: updatedLesson } = await patchRes.json()
      setLesson(updatedLesson)
      setEditorKey((k) => k + 1)

      // Regenerate quiz if requested and quiz exists
      if (alsoRegenerateQuiz && initialQuiz) {
        try {
          const newContentText = extractTiptapText(content)
          const quizRes = await fetch('/api/admin/generate/certification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trackTitle: title,
              trackDescription: `Quiz for lesson: ${title}`,
              questionCount: Math.max(10, initialQuestions.length),
              questionTypes: ['multiple_choice', 'open_ended'],
              instructions: `Generate quiz questions that test understanding of this lesson content:\n\n${newContentText.slice(0, 3000)}`,
            }),
          })

          if (quizRes.ok) {
            const { questions } = await quizRes.json()
            // Delete existing questions
            for (const q of initialQuestions) {
              await fetch(
                `/api/admin/courses/${courseId}/lessons/${lesson.id}/quiz/questions/${q.id}`,
                { method: 'DELETE' }
              )
            }
            // Add new questions
            for (let i = 0; i < questions.length; i++) {
              const q = questions[i]
              await fetch(
                `/api/admin/courses/${courseId}/lessons/${lesson.id}/quiz/questions`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    question_text: q.question_text,
                    question_type: q.question_type,
                    options: q.options ?? null,
                    correct_answer: q.correct_answer ?? null,
                    rubric: q.rubric ?? null,
                    max_points: q.max_points ?? 10,
                    order_index: i,
                  }),
                }
              )
            }
          }
        } catch {
          // Quiz regen failed — content is still saved, just note it
          console.error('Quiz regeneration failed, but lesson content was saved')
        }
      }

      setShowAiPanel(false)
      setAdjustmentInstructions('')
      router.refresh() // Refresh to pick up new quiz questions in sidebar
    } catch {
      alert('An error occurred while generating lesson content.')
    } finally {
      setRegenerating(false)
    }
  }

  /** Extract plain text from Tiptap JSON for context */
  function extractTiptapText(content: unknown): string {
    if (!content || typeof content !== 'object') return ''
    const node = content as Record<string, unknown>
    let text = ''
    if (node.text && typeof node.text === 'string') text += node.text
    if (Array.isArray(node.content)) {
      for (const child of node.content) text += extractTiptapText(child) + ' '
    }
    return text.trim()
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
                onClick={() => setShowAiPanel(!showAiPanel)}
                disabled={regenerating}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:bg-raised hover:text-foreground disabled:opacity-50"
                data-testid="regenerate-lesson-button"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {showAiPanel ? 'Hide AI Panel' : 'AI Assist'}
              </button>
            </div>

            {/* AI adjustment/regeneration panel */}
            {showAiPanel && (
              <div className="mt-3 rounded-lg border border-accent-muted bg-raised p-4 space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">
                    What do you want to change?
                  </label>
                  <textarea
                    value={adjustmentInstructions}
                    onChange={(e) => setAdjustmentInstructions(e.target.value)}
                    rows={3}
                    placeholder="e.g., Make it more technical, add healthcare examples, shorten the introduction, add a hands-on exercise..."
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                    data-testid="adjustment-instructions"
                  />
                </div>

                {initialQuiz && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alsoRegenerateQuiz}
                      onChange={(e) => setAlsoRegenerateQuiz(e.target.checked)}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span className="text-xs text-foreground-muted">Also regenerate quiz questions to match new content</span>
                  </label>
                )}

                <div className="flex items-center gap-2">
                  {lesson.content && adjustmentInstructions.trim() && (
                    <button
                      type="button"
                      onClick={() => handleRegenerateLesson('adjust')}
                      disabled={regenerating}
                      className="rounded-lg bg-accent text-background px-3 py-1.5 text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
                      data-testid="adjust-content-button"
                    >
                      {regenerating ? 'Adjusting...' : 'Adjust Content'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRegenerateLesson('regenerate')}
                    disabled={regenerating}
                    className="rounded-lg border border-border bg-background text-foreground px-3 py-1.5 text-sm font-medium hover:bg-raised transition-colors disabled:opacity-50"
                    data-testid="regenerate-content-button"
                  >
                    {regenerating ? 'Generating...' : 'Regenerate from Scratch'}
                  </button>
                </div>

                {regenerating && (
                  <p className="text-xs text-foreground-muted">This typically takes 15-30 seconds...</p>
                )}
              </div>
            )}
          </div>

          {/* Block editor */}
          <BlockEditor
            key={editorKey}
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
