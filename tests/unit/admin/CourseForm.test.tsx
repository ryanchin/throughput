import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CourseForm } from '@/components/admin/CourseForm'
import type { Database } from '@/lib/supabase/database.types'

type Course = Database['public']['Tables']['courses']['Row']

// Mock next/navigation
const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockBack = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    back: mockBack,
  }),
}))

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 'course-123',
    title: 'Existing Course',
    slug: 'existing-course',
    description: 'A course description',
    zone: 'training',
    status: 'draft',
    cover_image_url: null,
    learning_objectives: null,
    passing_score: 70,
    navigation_mode: 'sequential',
    created_by: 'user-1',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('CourseForm', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Create mode (no course prop)', () => {
    it('renders create form with empty fields', () => {
      render(<CourseForm />)
      expect(screen.getByRole('heading', { name: 'Create Course' })).toBeInTheDocument()
      expect(screen.getByLabelText('Title')).toHaveValue('')
      expect(screen.getByLabelText('Slug')).toHaveValue('')
      expect(screen.getByLabelText('Description')).toHaveValue('')
      expect(screen.getByLabelText('Zone')).toHaveValue('training')
      expect(screen.getByLabelText('Passing Score (%)')).toHaveValue(70)
      expect(screen.getByLabelText('Cover Image URL')).toHaveValue('')
    })

    it('shows the Create Course submit button', () => {
      render(<CourseForm />)
      expect(screen.getByRole('button', { name: 'Create Course' })).toBeInTheDocument()
    })

    it('renders navigation mode dropdown defaulting to sequential', () => {
      render(<CourseForm />)
      const select = screen.getByLabelText('Navigation Mode')
      expect(select).toBeInTheDocument()
      expect(select).toHaveValue('sequential')
    })

    it('includes navigation_mode in the submit body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ course: { id: 'new-id' } }),
      })

      const user = userEvent.setup()
      render(<CourseForm />)

      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'Nav Test')

      // Change navigation mode to free
      await user.selectOptions(screen.getByLabelText('Navigation Mode'), 'free')

      await user.click(screen.getByRole('button', { name: 'Create Course' }))

      await waitFor(() => {
        const callArgs = mockFetch.mock.calls.find(
          (call) => call[0] === '/api/admin/courses'
        )
        const body = JSON.parse(callArgs![1].body)
        expect(body.navigation_mode).toBe('free')
      })
    })

    it('auto-generates slug from title', async () => {
      const user = userEvent.setup()
      render(<CourseForm />)

      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'My New Course')
      expect(screen.getByLabelText('Slug')).toHaveValue('my-new-course')
    })

    it('stops auto-generating slug once slug is manually edited', async () => {
      const user = userEvent.setup()
      render(<CourseForm />)

      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'First Title')
      expect(screen.getByLabelText('Slug')).toHaveValue('first-title')

      // Manually edit slug
      await user.clear(screen.getByLabelText('Slug'))
      await user.type(screen.getByLabelText('Slug'), 'custom-slug')

      // Change title -- slug should NOT auto-update
      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'Second Title')
      expect(screen.getByLabelText('Slug')).toHaveValue('custom-slug')
    })

    it('checks slug availability on blur', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ available: true }),
      })

      const user = userEvent.setup()
      render(<CourseForm />)

      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'Test Course')
      fireEvent.blur(screen.getByLabelText('Slug'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/admin/courses/check-slug?slug=test-course')
        )
      })
    })

    it('shows validation errors for empty required fields', async () => {
      const user = userEvent.setup()
      render(<CourseForm />)

      await user.click(screen.getByRole('button', { name: 'Create Course' }))

      expect(screen.getByText('Title is required')).toBeInTheDocument()
      expect(screen.getByText('Slug is required')).toBeInTheDocument()
      // Should NOT have called fetch for submit
      expect(mockFetch).not.toHaveBeenCalledWith(
        '/api/admin/courses',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('shows error for invalid slug format', async () => {
      const user = userEvent.setup()
      render(<CourseForm />)

      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'Test')
      await user.clear(screen.getByLabelText('Slug'))
      await user.type(screen.getByLabelText('Slug'), 'INVALID SLUG!')

      await user.click(screen.getByRole('button', { name: 'Create Course' }))

      expect(screen.getByText('Slug must be lowercase alphanumeric with hyphens')).toBeInTheDocument()
    })

    it('submits POST request on create and redirects', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ course: { id: 'new-course-id' } }),
      })

      const user = userEvent.setup()
      render(<CourseForm />)

      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'My Course')
      await user.type(screen.getByLabelText('Description'), 'A description')

      await user.click(screen.getByRole('button', { name: 'Create Course' }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/admin/courses',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        )
      })

      // Verify the body contains proper values
      const callArgs = mockFetch.mock.calls.find(
        (call) => call[0] === '/api/admin/courses'
      )
      const body = JSON.parse(callArgs![1].body)
      expect(body.title).toBe('My Course')
      expect(body.slug).toBe('my-course')
      expect(body.description).toBe('A description')
      expect(body.zone).toBe('training')
      expect(body.passing_score).toBe(70)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/courses/new-course-id')
      })
    })

    it('handles 409 slug conflict from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'A course with this slug already exists' }),
      })

      const user = userEvent.setup()
      render(<CourseForm />)

      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'Conflict Course')
      await user.click(screen.getByRole('button', { name: 'Create Course' }))

      await waitFor(() => {
        expect(screen.getByText('A course with this slug already exists')).toBeInTheDocument()
      })
    })

    it('handles API validation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Validation failed',
          details: [
            { path: ['title'], message: 'Title is too short' },
          ],
        }),
      })

      const user = userEvent.setup()
      render(<CourseForm />)

      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'X')
      await user.click(screen.getByRole('button', { name: 'Create Course' }))

      await waitFor(() => {
        expect(screen.getByText('Title is too short')).toBeInTheDocument()
      })
    })

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'))

      const user = userEvent.setup()
      render(<CourseForm />)

      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'Test Course')
      await user.click(screen.getByRole('button', { name: 'Create Course' }))

      await waitFor(() => {
        expect(screen.getByText('Network error. Please try again.')).toBeInTheDocument()
      })
    })

    it('disables submit button while submitting', async () => {
      // Use a promise that does not resolve immediately
      let resolveSubmit: (value: unknown) => void
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSubmit = resolve
        })
      )

      const user = userEvent.setup()
      render(<CourseForm />)

      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'Test Course')
      await user.click(screen.getByRole('button', { name: 'Create Course' }))

      expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled()

      // Resolve to clean up
      resolveSubmit!({
        ok: true,
        json: async () => ({ course: { id: '1' } }),
      })
    })
  })

  describe('Edit mode (with course prop)', () => {
    it('renders edit form with pre-filled fields', () => {
      const course = makeCourse({
        title: 'Sprint Planning',
        slug: 'sprint-planning',
        description: 'Learn sprint planning',
        zone: 'sales',
        passing_score: 80,
        cover_image_url: 'https://example.com/img.jpg',
      })

      render(<CourseForm course={course} />)

      expect(screen.getByRole('heading', { name: 'Edit Course' })).toBeInTheDocument()
      expect(screen.getByLabelText('Title')).toHaveValue('Sprint Planning')
      expect(screen.getByLabelText('Slug')).toHaveValue('sprint-planning')
      expect(screen.getByLabelText('Description')).toHaveValue('Learn sprint planning')
      expect(screen.getByLabelText('Zone')).toHaveValue('sales')
      expect(screen.getByLabelText('Passing Score (%)')).toHaveValue(80)
      expect(screen.getByLabelText('Cover Image URL')).toHaveValue('https://example.com/img.jpg')
    })

    it('shows the Save Changes submit button', () => {
      render(<CourseForm course={makeCourse()} />)
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
    })

    it('pre-fills navigation mode from course prop', () => {
      const course = makeCourse({ navigation_mode: 'free' })
      render(<CourseForm course={course} />)
      expect(screen.getByLabelText('Navigation Mode')).toHaveValue('free')
    })

    it('does not auto-generate slug from title changes in edit mode', async () => {
      const course = makeCourse({
        title: 'Original Title',
        slug: 'original-title',
      })

      const user = userEvent.setup()
      render(<CourseForm course={course} />)

      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'New Title')

      // Slug should remain unchanged since edit mode starts with slugManuallyEdited=true
      expect(screen.getByLabelText('Slug')).toHaveValue('original-title')
    })

    it('submits PATCH request on edit and redirects', async () => {
      const course = makeCourse()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ course: { ...course, title: 'Updated' } }),
      })

      const user = userEvent.setup()
      render(<CourseForm course={course} />)

      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'Updated Title')

      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/admin/courses/${course.id}`,
          expect.objectContaining({ method: 'PATCH' })
        )
      })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(`/admin/courses/${course.id}`)
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('includes excludeId when checking slug availability', async () => {
      const course = makeCourse()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ available: true }),
      })

      const user = userEvent.setup()
      render(<CourseForm course={course} />)

      await user.clear(screen.getByLabelText('Slug'))
      await user.type(screen.getByLabelText('Slug'), 'new-slug')
      fireEvent.blur(screen.getByLabelText('Slug'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`excludeId=${course.id}`)
        )
      })
    })
  })

  describe('Cancel button', () => {
    it('calls router.back() on cancel', async () => {
      const user = userEvent.setup()
      render(<CourseForm />)

      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(mockBack).toHaveBeenCalled()
    })
  })

  describe('Validation edge cases', () => {
    it('validates description max length', async () => {
      const user = userEvent.setup()
      render(<CourseForm />)

      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'Test')
      // Set description over 2000 chars
      const longDesc = 'a'.repeat(2001)
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: longDesc } })

      await user.click(screen.getByRole('button', { name: 'Create Course' }))

      expect(screen.getByText('Description must be 2000 characters or less')).toBeInTheDocument()
    })

    it('validates cover image URL format', async () => {
      const user = userEvent.setup()
      render(<CourseForm />)

      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'Test')
      await user.type(screen.getByLabelText('Cover Image URL'), 'not-a-url')

      await user.click(screen.getByRole('button', { name: 'Create Course' }))

      expect(screen.getByText('Must be a valid URL')).toBeInTheDocument()
    })

    it('validates passing score range', async () => {
      // Start with a course that has an out-of-range passing score to test validation
      const course = makeCourse({ passing_score: 150 })
      render(<CourseForm course={course} />)

      const form = screen.getByRole('button', { name: 'Save Changes' }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText('Passing score must be between 0 and 100')).toBeInTheDocument()
      })
    })

    it('allows empty cover image URL and description', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ course: { id: 'new-id' } }),
      })

      const user = userEvent.setup()
      render(<CourseForm />)

      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'Minimal Course')
      await user.click(screen.getByRole('button', { name: 'Create Course' }))

      await waitFor(() => {
        const callArgs = mockFetch.mock.calls.find(
          (call) => call[0] === '/api/admin/courses'
        )
        const body = JSON.parse(callArgs![1].body)
        expect(body.description).toBeNull()
        expect(body.cover_image_url).toBeNull()
      })
    })

    it('shows slug taken indicator after failed check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ available: false }),
      })

      const user = userEvent.setup()
      render(<CourseForm />)

      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'Taken Course')
      fireEvent.blur(screen.getByLabelText('Slug'))

      await waitFor(() => {
        expect(screen.getByLabelText('Slug is taken')).toBeInTheDocument()
      })
    })

    it('shows slug available indicator after successful check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ available: true }),
      })

      const user = userEvent.setup()
      render(<CourseForm />)

      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'Available Course')
      fireEvent.blur(screen.getByLabelText('Slug'))

      await waitFor(() => {
        expect(screen.getByLabelText('Slug is available')).toBeInTheDocument()
      })
    })

    it('sends null for empty description and cover_image_url', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ course: { id: 'x' } }),
      })

      const user = userEvent.setup()
      render(<CourseForm />)

      await user.clear(screen.getByLabelText('Title'))
      await user.type(screen.getByLabelText('Title'), 'Test')

      await user.click(screen.getByRole('button', { name: 'Create Course' }))

      await waitFor(() => {
        const callArgs = mockFetch.mock.calls.find(
          (call) => call[0] === '/api/admin/courses'
        )
        const body = JSON.parse(callArgs![1].body)
        expect(body.description).toBeNull()
        expect(body.cover_image_url).toBeNull()
      })
    })
  })
})
