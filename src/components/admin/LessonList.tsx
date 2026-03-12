'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
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
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import type { Database } from '@/lib/supabase/database.types'

type Lesson = Database['public']['Tables']['lessons']['Row']
type ContentStatus = 'draft' | 'published'

interface LessonListProps {
  courseId: string
  initialLessons: Lesson[]
}

/** Inline status toggle for lessons -- PATCHes the lesson directly instead of using the generic content/status API */
function LessonStatusToggle({
  courseId,
  lessonId,
  currentStatus,
  onStatusChange,
}: {
  courseId: string
  lessonId: string
  currentStatus: ContentStatus
  onStatusChange: (newStatus: ContentStatus) => void
}) {
  const [loading, setLoading] = useState(false)
  const isPublished = currentStatus === 'published'

  async function handleToggle() {
    const newStatus: ContentStatus = isPublished ? 'draft' : 'published'
    setLoading(true)

    try {
      const res = await fetch(`/api/admin/courses/${courseId}/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to update status')
        return
      }

      onStatusChange(newStatus)
    } catch {
      alert('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background ${
        isPublished ? 'bg-success' : 'bg-[var(--background-muted)]'
      } ${loading ? 'opacity-50' : ''}`}
      role="switch"
      aria-checked={isPublished}
      data-testid={`lesson-status-toggle-${lessonId}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
          isPublished ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
      <span className="sr-only">{isPublished ? 'Unpublish' : 'Publish'}</span>
    </button>
  )
}

/** Sortable lesson row */
function SortableLessonItem({
  lesson,
  courseId,
  onStatusChange,
  onDelete,
}: {
  lesson: Lesson
  courseId: string
  onStatusChange: (lessonId: string, newStatus: ContentStatus) => void
  onDelete: (lessonId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border border-border bg-surface p-3 ${
        isDragging ? 'opacity-50 shadow-accent-glow' : ''
      }`}
      data-testid={`lesson-row-${lesson.id}`}
    >
      {/* Drag handle */}
      <button
        className="cursor-grab text-foreground-muted hover:text-foreground focus:outline-none active:cursor-grabbing"
        aria-label="Drag to reorder"
        data-testid={`drag-handle-${lesson.id}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Order index */}
      <span className="min-w-[1.5rem] text-center font-mono text-sm text-foreground-subtle">
        {lesson.order_index + 1}
      </span>

      {/* Title */}
      <span className="flex-1 truncate text-sm font-medium text-foreground">
        {lesson.title}
      </span>

      {/* Status badge */}
      <StatusBadge status={lesson.status} />

      {/* Status toggle */}
      <LessonStatusToggle
        courseId={courseId}
        lessonId={lesson.id}
        currentStatus={lesson.status}
        onStatusChange={(newStatus) => onStatusChange(lesson.id, newStatus)}
      />

      {/* Edit link */}
      <Link
        href={`/admin/courses/${courseId}/lessons/${lesson.id}`}
        className="rounded-md border border-border bg-background p-1.5 text-foreground-muted transition-colors hover:bg-raised hover:text-foreground"
        data-testid={`edit-lesson-${lesson.id}`}
      >
        <Pencil className="h-3.5 w-3.5" />
        <span className="sr-only">Edit</span>
      </Link>

      {/* Delete button */}
      <button
        onClick={() => onDelete(lesson.id)}
        className="rounded-md border border-border bg-background p-1.5 text-foreground-muted transition-colors hover:border-destructive hover:bg-[var(--destructive-muted)] hover:text-destructive"
        data-testid={`delete-lesson-${lesson.id}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span className="sr-only">Delete</span>
      </button>
    </div>
  )
}

export function LessonList({ courseId, initialLessons }: LessonListProps) {
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [reordering, setReordering] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  /** Generate slug from title */
  function slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  /** Handle drag end -- reorder lessons */
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = lessons.findIndex((l) => l.id === active.id)
      const newIndex = lessons.findIndex((l) => l.id === over.id)

      const reordered = arrayMove(lessons, oldIndex, newIndex).map((l, i) => ({
        ...l,
        order_index: i,
      }))

      setLessons(reordered)
      setReordering(true)

      try {
        const res = await fetch(`/api/admin/courses/${courseId}/lessons/reorder`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonIds: reordered.map((l) => l.id) }),
        })

        if (!res.ok) {
          // Revert on failure
          setLessons(lessons)
          const err = await res.json()
          alert(err.error || 'Failed to reorder lessons')
        }
      } catch {
        setLessons(lessons)
        alert('Network error')
      } finally {
        setReordering(false)
      }
    },
    [lessons, courseId]
  )

  /** Handle status change for a lesson */
  function handleStatusChange(lessonId: string, newStatus: ContentStatus) {
    setLessons((prev) =>
      prev.map((l) => (l.id === lessonId ? { ...l, status: newStatus } : l))
    )
  }

  /** Handle delete */
  async function handleDelete(lessonId: string) {
    const lesson = lessons.find((l) => l.id === lessonId)
    if (!lesson) return

    const confirmed = window.confirm(
      `Are you sure you want to delete "${lesson.title}"? This action cannot be undone.`
    )
    if (!confirmed) return

    try {
      const res = await fetch(`/api/admin/courses/${courseId}/lessons/${lessonId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to delete lesson')
        return
      }

      // Remove from local state and re-index
      setLessons((prev) =>
        prev
          .filter((l) => l.id !== lessonId)
          .map((l, i) => ({ ...l, order_index: i }))
      )
    } catch {
      alert('Network error')
    }
  }

  /** Handle create lesson */
  async function handleCreate() {
    const title = newTitle.trim()
    if (!title) return

    const slug = slugify(title)
    if (!slug) {
      alert('Title must contain at least one alphanumeric character')
      return
    }

    setCreating(true)

    try {
      const res = await fetch(`/api/admin/courses/${courseId}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, slug }),
      })

      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to create lesson')
        return
      }

      const { lesson } = await res.json()
      setLessons((prev) => [...prev, lesson])
      setNewTitle('')
      setShowAddForm(false)
    } catch {
      alert('Network error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div data-testid="lesson-list">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Lessons</h2>
        {reordering && (
          <span className="text-xs text-foreground-muted">Saving order...</span>
        )}
      </div>

      {lessons.length === 0 && !showAddForm && (
        <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-foreground-muted">
          No lessons yet. Add your first lesson to get started.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={lessons.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {lessons.map((lesson) => (
              <SortableLessonItem
                key={lesson.id}
                lesson={lesson}
                courseId={courseId}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add lesson form / button */}
      {showAddForm ? (
        <div
          className="mt-3 rounded-lg border border-border bg-muted p-4"
          data-testid="add-lesson-form"
        >
          <label htmlFor="new-lesson-title" className="mb-1.5 block text-xs font-medium text-foreground-muted">
            Lesson Title
          </label>
          <div className="flex gap-2">
            <input
              id="new-lesson-title"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Introduction to Goal Setting"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') {
                  setShowAddForm(false)
                  setNewTitle('')
                }
              }}
              data-testid="new-lesson-title-input"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newTitle.trim()}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover disabled:opacity-50"
              data-testid="create-lesson-button"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setNewTitle('')
              }}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground-muted hover:text-foreground"
              data-testid="cancel-add-lesson"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="mt-3 w-full rounded-lg border border-dashed border-border bg-background py-3 text-sm text-foreground-muted transition-colors hover:border-accent hover:text-accent"
          data-testid="add-lesson-button"
        >
          + Add Lesson
        </button>
      )}
    </div>
  )
}
