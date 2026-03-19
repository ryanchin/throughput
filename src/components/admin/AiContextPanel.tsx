'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Checkbox } from '@/components/ui/checkbox'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AiContextPanelProps {
  /** Current context state */
  instructions: string
  onInstructionsChange: (value: string) => void
  preset: string | null
  onPresetChange: (value: string | null) => void
  /** File upload state */
  fileText: string | null
  fileName: string | null
  fileWordCount: number
  onFileUploaded: (data: { text: string; name: string; wordCount: number }) => void
  onFileRemoved: () => void
  fileUploading: boolean
  onFileUploadStart: () => void
  /** Course picker state */
  selectedCourseIds: string[]
  onCourseIdsChange: (ids: string[]) => void
  /** Optional: hide course picker (e.g., when generating a course) */
  showCoursePicker?: boolean
  /** Slot for form-specific controls (e.g., lesson count, include quizzes) */
  children?: React.ReactNode
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESETS = [
  { id: 'technical', icon: '\u2699\uFE0F', label: 'Technical', desc: 'Precise, formal' },
  { id: 'conversational', icon: '\uD83D\uDCAC', label: 'Conversational', desc: 'Friendly, clear' },
  { id: 'assessment', icon: '\uD83D\uDCCB', label: 'Assessment', desc: 'Test-focused' },
  { id: 'beginner', icon: '\uD83C\uDF31', label: 'Beginner', desc: 'Simple, guided' },
] as const

const ACCEPTED_FILE_TYPES = '.pdf,.docx'
const FILE_PREVIEW_LINES = 3

// ---------------------------------------------------------------------------
// Course type for the picker
// ---------------------------------------------------------------------------

interface CourseOption {
  id: string
  title: string
  lessonCount: number
  estimatedWords: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiContextPanel({
  instructions,
  onInstructionsChange,
  preset,
  onPresetChange,
  fileText,
  fileName,
  fileWordCount,
  onFileUploaded,
  onFileRemoved,
  fileUploading,
  onFileUploadStart,
  selectedCourseIds,
  onCourseIdsChange,
  showCoursePicker = true,
  children,
}: AiContextPanelProps) {
  return (
    <div
      data-testid="ai-context-panel"
      className="bg-raised border border-accent-muted rounded-xl p-5 space-y-5"
    >
      {/* Style Presets */}
      <PresetSelector selected={preset} onChange={onPresetChange} />

      {/* Instructions */}
      <div className="space-y-1.5">
        <label htmlFor="ai-instructions" className="text-sm font-medium text-foreground">
          Instructions
        </label>
        <textarea
          id="ai-instructions"
          data-testid="ai-instructions"
          value={instructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
          placeholder="Tell the AI what to focus on..."
          rows={4}
          className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-foreground-subtle resize-y text-sm"
        />
      </div>

      {/* Reference File */}
      <FileUploadSection
        fileText={fileText}
        fileName={fileName}
        fileWordCount={fileWordCount}
        fileUploading={fileUploading}
        onFileUploaded={onFileUploaded}
        onFileRemoved={onFileRemoved}
        onFileUploadStart={onFileUploadStart}
      />

      {/* Course Context */}
      {showCoursePicker && (
        <CoursePicker
          selectedIds={selectedCourseIds}
          onChange={onCourseIdsChange}
        />
      )}

      {/* Form-specific controls slot */}
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preset Selector
// ---------------------------------------------------------------------------

function PresetSelector({
  selected,
  onChange,
}: {
  selected: string | null
  onChange: (id: string | null) => void
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-foreground">Style Preset</span>
      <div
        role="radiogroup"
        aria-label="Style presets"
        data-testid="preset-group"
        className="grid grid-cols-2 gap-2"
      >
        {PRESETS.map((p) => {
          const isSelected = selected === p.id
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              data-testid={`preset-${p.id}`}
              onClick={() => onChange(isSelected ? null : p.id)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                isSelected
                  ? 'border-accent bg-accent-muted text-accent'
                  : 'border-border bg-background text-foreground-muted hover:border-foreground-muted'
              }`}
            >
              <span className="text-base" aria-hidden="true">
                {p.icon}
              </span>
              <div>
                <div className="font-medium leading-tight">{p.label}</div>
                <div className="text-xs opacity-70">{p.desc}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// File Upload Section
// ---------------------------------------------------------------------------

function FileUploadSection({
  fileText,
  fileName,
  fileWordCount,
  fileUploading,
  onFileUploaded,
  onFileRemoved,
  onFileUploadStart,
}: {
  fileText: string | null
  fileName: string | null
  fileWordCount: number
  fileUploading: boolean
  onFileUploaded: (data: { text: string; name: string; wordCount: number }) => void
  onFileRemoved: () => void
  onFileUploadStart: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [showFullPreview, setShowFullPreview] = useState(false)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    onFileUploadStart()

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/admin/generate/extract-text', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to extract text')
        return
      }

      onFileUploaded({
        text: data.text,
        name: file.name,
        wordCount: data.wordCount,
      })
    } catch {
      setError('Network error uploading file')
    }

    // Reset the input so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleRemove() {
    setShowFullPreview(false)
    setError(null)
    onFileRemoved()
    if (inputRef.current) inputRef.current.value = ''
  }

  // Build a short preview: first N lines
  const previewLines = fileText
    ? fileText.split('\n').slice(0, FILE_PREVIEW_LINES).join('\n')
    : null
  const hasMoreContent = fileText
    ? fileText.split('\n').length > FILE_PREVIEW_LINES
    : false

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-foreground">Reference File</span>

      {fileUploading && (
        <div
          data-testid="file-uploading"
          className="flex items-center gap-3 rounded-lg border border-border bg-muted p-4"
        >
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent" />
          <span className="text-sm text-foreground-muted">Extracting text...</span>
        </div>
      )}

      {!fileText && !fileUploading && (
        <label
          data-testid="file-dropzone"
          className="block cursor-pointer border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-foreground-muted transition-colors"
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={handleFileChange}
            className="sr-only"
            data-testid="file-input"
          />
          <div className="text-foreground-muted text-sm">
            <span className="font-medium text-accent">Click to upload</span> or drag
            and drop
          </div>
          <div className="text-xs text-foreground-subtle mt-1">PDF or DOCX, max 50 MB</div>
        </label>
      )}

      {fileText && !fileUploading && (
        <div data-testid="file-preview" className="bg-muted rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-foreground truncate">
                {fileName}
              </span>
              <span className="text-xs text-foreground-muted whitespace-nowrap">
                {fileWordCount.toLocaleString()} words
              </span>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              data-testid="file-remove"
              className="text-foreground-muted hover:text-destructive text-lg leading-none px-1 transition-colors"
              aria-label="Remove file"
            >
              &times;
            </button>
          </div>
          <pre className="text-xs text-foreground-muted whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
            {showFullPreview ? fileText : previewLines}
          </pre>
          {hasMoreContent && (
            <button
              type="button"
              onClick={() => setShowFullPreview((v) => !v)}
              className="text-xs text-accent hover:text-accent-hover transition-colors"
            >
              {showFullPreview ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {/* Hidden input for drag-and-drop fallback when file is already uploaded */}
      {fileText && (
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileChange}
          className="sr-only"
        />
      )}

      {error && (
        <p data-testid="file-error" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Course Picker
// ---------------------------------------------------------------------------

function CoursePicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Fetch courses once on mount
  useEffect(() => {
    let cancelled = false

    async function fetchCourses() {
      try {
        const res = await fetch('/api/admin/courses')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return

        const mapped: CourseOption[] = (data.courses ?? []).map(
          (c: { id: string; title: string; lesson_count?: number; description?: string | null }) => ({
            id: c.id,
            title: c.title,
            lessonCount: c.lesson_count ?? 0,
            // Rough estimate: ~150 words per lesson average
            estimatedWords: (c.lesson_count ?? 0) * 150,
          })
        )
        setCourses(mapped)
      } catch {
        // Silently fail — the picker will just be empty
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchCourses()
    return () => { cancelled = true }
  }, [])

  // Debounce search input (300ms)
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }, [])

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const filtered = debouncedSearch
    ? courses.filter((c) =>
        c.title.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : courses

  const selectedSet = new Set(selectedIds)

  function toggleCourse(id: string) {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((sid) => sid !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const totalEstimatedWords = courses
    .filter((c) => selectedSet.has(c.id))
    .reduce((sum, c) => sum + c.estimatedWords, 0)

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-foreground">Course Context</span>

      <input
        type="text"
        value={search}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="Search courses..."
        data-testid="course-search"
        className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none placeholder:text-foreground-subtle text-sm"
      />

      <div
        data-testid="course-list"
        className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-border bg-background p-2"
      >
        {loading && (
          <div className="text-xs text-foreground-muted py-4 text-center">
            Loading courses...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-xs text-foreground-muted py-4 text-center">
            {debouncedSearch ? 'No courses match your search' : 'No courses available'}
          </div>
        )}

        {!loading &&
          filtered.map((course) => {
            const isChecked = selectedSet.has(course.id)
            return (
              <label
                key={course.id}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => toggleCourse(course.id)}
                  data-testid={`course-checkbox-${course.id}`}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-foreground truncate">{course.title}</div>
                  <div className="text-xs text-foreground-muted">
                    {course.lessonCount} lesson{course.lessonCount !== 1 ? 's' : ''}
                    {' \u00B7 ~'}
                    {course.estimatedWords.toLocaleString()} words
                  </div>
                </div>
              </label>
            )
          })}
      </div>

      {selectedIds.length > 0 && (
        <div data-testid="course-footer" className="text-xs text-foreground-muted">
          Selected: {selectedIds.length} course{selectedIds.length !== 1 ? 's' : ''} &middot;
          ~{totalEstimatedWords.toLocaleString()} words
        </div>
      )}
    </div>
  )
}
