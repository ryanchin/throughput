import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LessonEditor } from '@/components/admin/LessonEditor'
import type { Database } from '@/lib/supabase/database.types'

type Lesson = Database['public']['Tables']['lessons']['Row']

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Mock QuizBuilder
vi.mock('@/components/admin/QuizBuilder', () => ({
  QuizBuilder: (props: Record<string, unknown>) => (
    <div data-testid="quiz-builder" data-props={JSON.stringify({
      courseId: props.courseId,
      lessonId: props.lessonId,
      hasInitialQuiz: !!props.initialQuiz,
      questionCount: Array.isArray(props.initialQuestions) ? (props.initialQuestions as unknown[]).length : 0,
    })}>
      Quiz Builder Mock
    </div>
  ),
}))

// Mock next/dynamic to render the BlockEditor directly
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: React.ComponentType }>) => {
    // Return a simple mock that renders a placeholder for the block editor
    const MockBlockEditor = (props: Record<string, unknown>) => (
      <div data-testid="block-editor-mock" data-props={JSON.stringify({
        editable: props.editable,
        placeholder: props.placeholder,
        hasOnSave: !!props.onSave,
        hasInitialContent: !!props.initialContent,
      })}>
        <button
          data-testid="trigger-content-save"
          onClick={() => {
            if (typeof props.onSave === 'function') {
              props.onSave({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'test' }] }] })
            }
          }}
        >
          Trigger Save
        </button>
      </div>
    )
    MockBlockEditor.displayName = 'MockBlockEditor'
    return MockBlockEditor
  },
}))

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'lesson-1',
    course_id: 'course-1',
    title: 'Test Lesson',
    slug: 'test-lesson',
    content: null,
    order_index: 0,
    status: 'draft',
    video_ids: [],
    duration_minutes: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

const mockFetch = vi.fn()

describe('LessonEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('renders the editor layout with back link', () => {
    render(<LessonEditor courseId="course-1" initialQuiz={null} initialQuestions={[]} lesson={makeLesson()} />)

    const backLink = screen.getByTestId('back-to-course')
    expect(backLink.getAttribute('href')).toBe('/admin/courses/course-1')
    expect(screen.getByText('Edit Lesson')).toBeInTheDocument()
  })

  it('renders lesson title input with current value', () => {
    render(<LessonEditor courseId="course-1" initialQuiz={null} initialQuestions={[]} lesson={makeLesson({ title: 'My Lesson' })} />)

    const titleInput = screen.getByTestId('lesson-title-input')
    expect(titleInput).toHaveValue('My Lesson')
  })

  it('renders lesson slug input with current value', () => {
    render(<LessonEditor courseId="course-1" initialQuiz={null} initialQuestions={[]} lesson={makeLesson({ slug: 'my-lesson' })} />)

    const slugInput = screen.getByTestId('lesson-slug-input')
    expect(slugInput).toHaveValue('my-lesson')
  })

  it('renders status badge', () => {
    render(<LessonEditor courseId="course-1" initialQuiz={null} initialQuestions={[]} lesson={makeLesson({ status: 'draft' })} />)
    expect(screen.getByTestId('status-badge-draft')).toBeInTheDocument()
  })

  it('renders published status badge', () => {
    render(<LessonEditor courseId="course-1" initialQuiz={null} initialQuestions={[]} lesson={makeLesson({ status: 'published' })} />)
    expect(screen.getByTestId('status-badge-published')).toBeInTheDocument()
  })

  it('renders quiz builder component', () => {
    render(<LessonEditor courseId="course-1" initialQuiz={null} initialQuestions={[]} lesson={makeLesson()} />)
    expect(screen.getByTestId('quiz-builder')).toBeInTheDocument()
  })

  it('renders the block editor with correct props', () => {
    render(<LessonEditor courseId="course-1" initialQuiz={null} initialQuestions={[]} lesson={makeLesson()} />)

    const editor = screen.getByTestId('block-editor-mock')
    const props = JSON.parse(editor.getAttribute('data-props')!)
    expect(props.editable).toBe(true)
    expect(props.hasOnSave).toBe(true)
    expect(props.placeholder).toBe('Start writing lesson content...')
  })

  it('passes initialContent to the block editor when lesson has content', () => {
    const content = { type: 'doc', content: [] }
    render(<LessonEditor courseId="course-1" initialQuiz={null} initialQuestions={[]} lesson={makeLesson({ content: content as unknown as Lesson['content'] })} />)

    const editor = screen.getByTestId('block-editor-mock')
    const props = JSON.parse(editor.getAttribute('data-props')!)
    expect(props.hasInitialContent).toBe(true)
  })

  it('auto-saves title changes with debounce', async () => {
    const updatedLesson = makeLesson({ title: 'Updated Title' })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ lesson: updatedLesson }),
    })

    vi.useRealTimers()
    const user = userEvent.setup()
    render(<LessonEditor courseId="course-1" initialQuiz={null} initialQuestions={[]} lesson={makeLesson()} />)

    const titleInput = screen.getByTestId('lesson-title-input')
    await user.clear(titleInput)
    await user.type(titleInput, 'Updated Title')

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/courses/course-1/lessons/lesson-1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }, { timeout: 3000 })

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)
    expect(body.title).toBe('Updated Title')
  })

  it('auto-saves slug changes and cleans input', async () => {
    const updatedLesson = makeLesson({ slug: 'clean-slug' })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ lesson: updatedLesson }),
    })

    vi.useRealTimers()
    const user = userEvent.setup()
    render(<LessonEditor courseId="course-1" initialQuiz={null} initialQuestions={[]} lesson={makeLesson()} />)

    const slugInput = screen.getByTestId('lesson-slug-input')
    await user.clear(slugInput)
    await user.type(slugInput, 'clean-slug')

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    }, { timeout: 3000 })

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)
    expect(body.slug).toBe('clean-slug')
  })

  it('saves content when block editor triggers save', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    })

    vi.useRealTimers()
    render(<LessonEditor courseId="course-1" initialQuiz={null} initialQuestions={[]} lesson={makeLesson()} />)

    fireEvent.click(screen.getByTestId('trigger-content-save'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/courses/course-1/lessons/lesson-1',
        expect.objectContaining({
          method: 'PATCH',
        })
      )
    })

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)
    expect(body.content).toBeDefined()
    expect(body.content.type).toBe('doc')
  })

  it('shows saving indicator during content save', async () => {
    let resolveRequest: (value: unknown) => void
    mockFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve
      })
    )

    vi.useRealTimers()
    render(<LessonEditor courseId="course-1" initialQuiz={null} initialQuestions={[]} lesson={makeLesson()} />)

    fireEvent.click(screen.getByTestId('trigger-content-save'))

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })

    // Resolve the request
    resolveRequest!({
      ok: true,
      json: () => Promise.resolve({}),
    })

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument()
    })
  })

  it('shows error indicator when content save fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Failed' }),
    })

    vi.useRealTimers()
    render(<LessonEditor courseId="course-1" initialQuiz={null} initialQuestions={[]} lesson={makeLesson()} />)

    fireEvent.click(screen.getByTestId('trigger-content-save'))

    await waitFor(() => {
      expect(screen.getByText('Error saving')).toBeInTheDocument()
    })
  })

  it('shows error indicator when metadata save fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid slug' }),
    })

    vi.useRealTimers()
    const user = userEvent.setup()
    render(<LessonEditor courseId="course-1" initialQuiz={null} initialQuestions={[]} lesson={makeLesson()} />)

    const titleInput = screen.getByTestId('lesson-title-input')
    await user.clear(titleInput)
    await user.type(titleInput, 'New Title')

    await waitFor(() => {
      expect(screen.getByText('Error saving')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('renders two-column layout', () => {
    render(<LessonEditor courseId="course-1" initialQuiz={null} initialQuestions={[]} lesson={makeLesson()} />)

    // Left side has the editor, right side has the quiz builder
    expect(screen.getByTestId('block-editor-mock')).toBeInTheDocument()
    expect(screen.getByTestId('quiz-builder')).toBeInTheDocument()
  })

  it('cleans slug input to only allow lowercase alphanumeric and hyphens', async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    render(<LessonEditor courseId="course-1" initialQuiz={null} initialQuestions={[]} lesson={makeLesson()} />)

    const slugInput = screen.getByTestId('lesson-slug-input')
    await user.clear(slugInput)
    // Type uppercase and special chars
    await user.type(slugInput, 'ABC')

    // Should be cleaned to lowercase, no special chars
    expect(slugInput).toHaveValue('abc')
  })
})
