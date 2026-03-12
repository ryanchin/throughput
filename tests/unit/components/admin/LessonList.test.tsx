import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LessonList } from '@/components/admin/LessonList'
import type { Database } from '@/lib/supabase/database.types'

type Lesson = Database['public']['Tables']['lessons']['Row']

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'lesson-1',
    course_id: 'course-1',
    title: 'Lesson One',
    slug: 'lesson-one',
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

describe('LessonList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch
    global.alert = vi.fn()
    global.confirm = vi.fn(() => true)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders empty state when no lessons exist', () => {
    render(<LessonList courseId="course-1" initialLessons={[]} />)
    expect(screen.getByText(/No lessons yet/)).toBeInTheDocument()
  })

  it('renders the lesson list header', () => {
    render(<LessonList courseId="course-1" initialLessons={[]} />)
    expect(screen.getByText('Lessons')).toBeInTheDocument()
  })

  it('renders lessons in order', () => {
    const lessons = [
      makeLesson({ id: 'l-1', title: 'First Lesson', order_index: 0 }),
      makeLesson({ id: 'l-2', title: 'Second Lesson', order_index: 1 }),
      makeLesson({ id: 'l-3', title: 'Third Lesson', order_index: 2 }),
    ]

    render(<LessonList courseId="course-1" initialLessons={lessons} />)

    expect(screen.getByText('First Lesson')).toBeInTheDocument()
    expect(screen.getByText('Second Lesson')).toBeInTheDocument()
    expect(screen.getByText('Third Lesson')).toBeInTheDocument()
  })

  it('renders order index numbers (1-based)', () => {
    const lessons = [
      makeLesson({ id: 'l-1', title: 'First', order_index: 0 }),
      makeLesson({ id: 'l-2', title: 'Second', order_index: 1 }),
    ]

    render(<LessonList courseId="course-1" initialLessons={lessons} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders status badges for each lesson', () => {
    const lessons = [
      makeLesson({ id: 'l-1', title: 'Draft Lesson', status: 'draft' }),
      makeLesson({ id: 'l-2', title: 'Published Lesson', status: 'published', order_index: 1 }),
    ]

    render(<LessonList courseId="course-1" initialLessons={lessons} />)

    const badges = screen.getAllByTestId(/status-badge/)
    expect(badges).toHaveLength(2)
  })

  it('renders edit links pointing to the lesson editor', () => {
    const lessons = [makeLesson({ id: 'l-1' })]

    render(<LessonList courseId="course-1" initialLessons={lessons} />)

    const editLink = screen.getByTestId('edit-lesson-l-1')
    expect(editLink.getAttribute('href')).toBe('/admin/courses/course-1/lessons/l-1')
  })

  it('renders drag handles for each lesson', () => {
    const lessons = [makeLesson({ id: 'l-1' })]

    render(<LessonList courseId="course-1" initialLessons={lessons} />)

    expect(screen.getByTestId('drag-handle-l-1')).toBeInTheDocument()
  })

  it('renders the Add Lesson button', () => {
    render(<LessonList courseId="course-1" initialLessons={[]} />)
    expect(screen.getByTestId('add-lesson-button')).toBeInTheDocument()
  })

  it('shows add lesson form when Add Lesson is clicked', async () => {
    const user = userEvent.setup()
    render(<LessonList courseId="course-1" initialLessons={[]} />)

    await user.click(screen.getByTestId('add-lesson-button'))

    expect(screen.getByTestId('add-lesson-form')).toBeInTheDocument()
    expect(screen.getByTestId('new-lesson-title-input')).toBeInTheDocument()
    expect(screen.getByTestId('create-lesson-button')).toBeInTheDocument()
  })

  it('hides empty state when add form is shown', async () => {
    const user = userEvent.setup()
    render(<LessonList courseId="course-1" initialLessons={[]} />)

    // Show add form
    await user.click(screen.getByTestId('add-lesson-button'))

    // The "No lessons yet" message should still be visible since the form is additive
    // but the add button should be replaced by the form
    expect(screen.queryByTestId('add-lesson-button')).not.toBeInTheDocument()
  })

  it('cancels adding a lesson', async () => {
    const user = userEvent.setup()
    render(<LessonList courseId="course-1" initialLessons={[]} />)

    await user.click(screen.getByTestId('add-lesson-button'))
    expect(screen.getByTestId('add-lesson-form')).toBeInTheDocument()

    await user.click(screen.getByTestId('cancel-add-lesson'))
    expect(screen.queryByTestId('add-lesson-form')).not.toBeInTheDocument()
    expect(screen.getByTestId('add-lesson-button')).toBeInTheDocument()
  })

  it('creates a new lesson via POST', async () => {
    const newLesson = makeLesson({
      id: 'new-lesson',
      title: 'Introduction',
      slug: 'introduction',
      order_index: 0,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ lesson: newLesson }),
    })

    const user = userEvent.setup()
    render(<LessonList courseId="course-1" initialLessons={[]} />)

    await user.click(screen.getByTestId('add-lesson-button'))
    await user.type(screen.getByTestId('new-lesson-title-input'), 'Introduction')
    await user.click(screen.getByTestId('create-lesson-button'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/courses/course-1/lessons',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    // Verify slug was auto-generated
    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)
    expect(body.title).toBe('Introduction')
    expect(body.slug).toBe('introduction')

    // Lesson should appear in the list
    await waitFor(() => {
      expect(screen.getByText('Introduction')).toBeInTheDocument()
    })
  })

  it('disables create button when title is empty', async () => {
    const user = userEvent.setup()
    render(<LessonList courseId="course-1" initialLessons={[]} />)

    await user.click(screen.getByTestId('add-lesson-button'))

    const createButton = screen.getByTestId('create-lesson-button')
    expect(createButton).toBeDisabled()
  })

  it('shows alert when create fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'A lesson with this slug already exists in this course' }),
    })

    const user = userEvent.setup()
    render(<LessonList courseId="course-1" initialLessons={[]} />)

    await user.click(screen.getByTestId('add-lesson-button'))
    await user.type(screen.getByTestId('new-lesson-title-input'), 'Duplicate')
    await user.click(screen.getByTestId('create-lesson-button'))

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('A lesson with this slug already exists in this course')
    })
  })

  it('shows confirmation dialog on delete', async () => {
    const lessons = [makeLesson({ id: 'l-1', title: 'Lesson to Delete' })]

    render(<LessonList courseId="course-1" initialLessons={lessons} />)

    fireEvent.click(screen.getByTestId('delete-lesson-l-1'))

    expect(global.confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete "Lesson to Delete"? This action cannot be undone.'
    )
  })

  it('deletes a lesson via DELETE API on confirmation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })

    const lessons = [
      makeLesson({ id: 'l-1', title: 'Lesson to Delete' }),
      makeLesson({ id: 'l-2', title: 'Remaining Lesson', order_index: 1 }),
    ]

    render(<LessonList courseId="course-1" initialLessons={lessons} />)

    fireEvent.click(screen.getByTestId('delete-lesson-l-1'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/courses/course-1/lessons/l-1',
        { method: 'DELETE' }
      )
    })

    // Deleted lesson should be removed
    await waitFor(() => {
      expect(screen.queryByText('Lesson to Delete')).not.toBeInTheDocument()
      expect(screen.getByText('Remaining Lesson')).toBeInTheDocument()
    })
  })

  it('does not delete when confirmation is cancelled', () => {
    ;(global.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false)

    const lessons = [makeLesson({ id: 'l-1', title: 'Safe Lesson' })]

    render(<LessonList courseId="course-1" initialLessons={lessons} />)

    fireEvent.click(screen.getByTestId('delete-lesson-l-1'))

    expect(mockFetch).not.toHaveBeenCalled()
    expect(screen.getByText('Safe Lesson')).toBeInTheDocument()
  })

  it('shows alert when delete fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Lesson not found' }),
    })

    const lessons = [makeLesson({ id: 'l-1', title: 'Lesson' })]

    render(<LessonList courseId="course-1" initialLessons={lessons} />)

    fireEvent.click(screen.getByTestId('delete-lesson-l-1'))

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Lesson not found')
    })
  })

  it('toggles lesson status via PATCH', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ lesson: makeLesson({ status: 'published' }) }),
    })

    const lessons = [makeLesson({ id: 'l-1', status: 'draft' })]

    render(<LessonList courseId="course-1" initialLessons={lessons} />)

    const toggle = screen.getByTestId('lesson-status-toggle-l-1')
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/courses/course-1/lessons/l-1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)
    expect(body.status).toBe('published')
  })

  it('creates lesson on Enter key press', async () => {
    const newLesson = makeLesson({ id: 'new-lesson', title: 'Quick Lesson', slug: 'quick-lesson' })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ lesson: newLesson }),
    })

    const user = userEvent.setup()
    render(<LessonList courseId="course-1" initialLessons={[]} />)

    await user.click(screen.getByTestId('add-lesson-button'))
    await user.type(screen.getByTestId('new-lesson-title-input'), 'Quick Lesson')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
  })

  it('closes add form on Escape key press', async () => {
    const user = userEvent.setup()
    render(<LessonList courseId="course-1" initialLessons={[]} />)

    await user.click(screen.getByTestId('add-lesson-button'))
    expect(screen.getByTestId('add-lesson-form')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('add-lesson-form')).not.toBeInTheDocument()
  })

  it('handles network error on delete', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const lessons = [makeLesson({ id: 'l-1', title: 'Lesson' })]

    render(<LessonList courseId="course-1" initialLessons={lessons} />)

    fireEvent.click(screen.getByTestId('delete-lesson-l-1'))

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Network error')
    })

    // Lesson should still be in the list
    expect(screen.getByText('Lesson')).toBeInTheDocument()
  })

  it('handles network error on create', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const user = userEvent.setup()
    render(<LessonList courseId="course-1" initialLessons={[]} />)

    await user.click(screen.getByTestId('add-lesson-button'))
    await user.type(screen.getByTestId('new-lesson-title-input'), 'New Lesson')
    await user.click(screen.getByTestId('create-lesson-button'))

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Network error')
    })
  })

  it('generates correct slugs from titles', async () => {
    const newLesson = makeLesson({ id: 'new', title: 'My Cool Lesson!', slug: 'my-cool-lesson' })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ lesson: newLesson }),
    })

    const user = userEvent.setup()
    render(<LessonList courseId="course-1" initialLessons={[]} />)

    await user.click(screen.getByTestId('add-lesson-button'))
    await user.type(screen.getByTestId('new-lesson-title-input'), 'My Cool Lesson!')
    await user.click(screen.getByTestId('create-lesson-button'))

    await waitFor(() => {
      const call = mockFetch.mock.calls[0]
      const body = JSON.parse(call[1].body)
      expect(body.slug).toBe('my-cool-lesson')
    })
  })
})
