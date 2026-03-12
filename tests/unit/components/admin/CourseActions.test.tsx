import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// Mock next/navigation
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

import { CourseActions } from '@/app/(app)/admin/courses/CourseActions'

describe('CourseActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    global.alert = vi.fn()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders Edit and Delete buttons', () => {
    render(<CourseActions courseId="course-1" courseTitle="Test Course" />)
    expect(screen.getByText('Edit')).toBeDefined()
    expect(screen.getByText('Delete')).toBeDefined()
  })

  it('Edit links to the course edit page', () => {
    render(<CourseActions courseId="course-1" courseTitle="Test Course" />)
    const editLink = screen.getByTestId('edit-course-course-1')
    expect(editLink.getAttribute('href')).toBe('/admin/courses/course-1')
  })

  it('shows confirmation dialog when Delete is clicked', () => {
    render(<CourseActions courseId="course-1" courseTitle="Test Course" />)
    fireEvent.click(screen.getByTestId('delete-course-course-1'))
    expect(screen.getByTestId('delete-confirm-dialog')).toBeDefined()
    expect(screen.getByText(/Test Course/)).toBeDefined()
  })

  it('closes confirmation dialog when Cancel is clicked', () => {
    render(<CourseActions courseId="course-1" courseTitle="Test Course" />)
    fireEvent.click(screen.getByTestId('delete-course-course-1'))
    expect(screen.getByTestId('delete-confirm-dialog')).toBeDefined()

    fireEvent.click(screen.getByTestId('delete-cancel'))
    expect(screen.queryByTestId('delete-confirm-dialog')).toBeNull()
  })

  it('calls DELETE API and refreshes on successful delete', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })
    global.fetch = mockFetch

    render(<CourseActions courseId="course-1" courseTitle="Test Course" />)
    fireEvent.click(screen.getByTestId('delete-course-course-1'))
    fireEvent.click(screen.getByTestId('delete-confirm'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/courses/course-1', {
        method: 'DELETE',
      })
    })

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('shows alert on failed delete', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Course not found' }),
    })
    global.fetch = mockFetch

    render(<CourseActions courseId="course-1" courseTitle="Test Course" />)
    fireEvent.click(screen.getByTestId('delete-course-course-1'))
    fireEvent.click(screen.getByTestId('delete-confirm'))

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Course not found')
    })
  })

  it('shows alert on network error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    global.fetch = mockFetch

    render(<CourseActions courseId="course-1" courseTitle="Test Course" />)
    fireEvent.click(screen.getByTestId('delete-course-course-1'))
    fireEvent.click(screen.getByTestId('delete-confirm'))

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Failed to delete course. Please try again.')
    })
  })

  it('disables buttons while deleting', async () => {
    let resolveDelete: (value: unknown) => void
    const deletePromise = new Promise((resolve) => {
      resolveDelete = resolve
    })
    const mockFetch = vi.fn().mockReturnValue(deletePromise)
    global.fetch = mockFetch

    render(<CourseActions courseId="course-1" courseTitle="Test Course" />)
    fireEvent.click(screen.getByTestId('delete-course-course-1'))
    fireEvent.click(screen.getByTestId('delete-confirm'))

    await waitFor(() => {
      expect(screen.getByText('Deleting...')).toBeDefined()
      expect(screen.getByTestId('delete-confirm')).toHaveProperty('disabled', true)
      expect(screen.getByTestId('delete-cancel')).toHaveProperty('disabled', true)
    })

    // Resolve to clean up
    resolveDelete!({ ok: true, json: () => Promise.resolve({ success: true }) })
  })
})
