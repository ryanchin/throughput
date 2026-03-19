import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock next/navigation
const mockPush = vi.fn()
const mockBack = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import NewCertTrackPage from '@/app/(app)/admin/certifications/new/page'

const mockFetch = vi.fn()

describe('NewCertTrackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch

    // Default: return empty tracks list for prerequisite dropdown + courses list
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/admin/certifications') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ tracks: [] }),
        })
      }
      if (url === '/api/admin/courses') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ courses: [] }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Not found' }) })
    })
  })

  afterEach(() => {
    cleanup()
  })

  // -------------------------------------------------------------------------
  // Basic rendering
  // -------------------------------------------------------------------------

  it('renders the form with all basic fields', () => {
    render(<NewCertTrackPage />)
    expect(screen.getByTestId('new-cert-track-form')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Slug')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
  })

  it('renders the AI mode toggle', () => {
    render(<NewCertTrackPage />)
    expect(screen.getByTestId('ai-mode-toggle')).toBeInTheDocument()
    expect(screen.getByText('Generate with AI')).toBeInTheDocument()
  })

  it('does not show AI context panel by default', () => {
    render(<NewCertTrackPage />)
    expect(screen.queryByTestId('ai-context-panel')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // AI mode toggle
  // -------------------------------------------------------------------------

  it('shows AI context panel when AI toggle is enabled', async () => {
    render(<NewCertTrackPage />)
    const toggle = screen.getByTestId('ai-mode-toggle')
    await userEvent.click(toggle)

    expect(screen.getByTestId('ai-context-panel')).toBeInTheDocument()
    expect(screen.getByTestId('question-count-input')).toBeInTheDocument()
  })

  it('hides AI context panel when AI toggle is disabled', async () => {
    render(<NewCertTrackPage />)
    const toggle = screen.getByTestId('ai-mode-toggle')

    // Enable
    await userEvent.click(toggle)
    expect(screen.getByTestId('ai-context-panel')).toBeInTheDocument()

    // Disable
    await userEvent.click(toggle)
    expect(screen.queryByTestId('ai-context-panel')).not.toBeInTheDocument()
  })

  it('shows question count input with default value of 30', async () => {
    render(<NewCertTrackPage />)
    await userEvent.click(screen.getByTestId('ai-mode-toggle'))

    const input = screen.getByTestId('question-count-input') as HTMLInputElement
    expect(input.value).toBe('30')
  })

  // -------------------------------------------------------------------------
  // Button label changes
  // -------------------------------------------------------------------------

  it('shows "Create Track" button when AI mode is off', () => {
    render(<NewCertTrackPage />)
    expect(screen.getByRole('button', { name: 'Create Track' })).toBeInTheDocument()
  })

  it('shows "Create Track & Generate Questions" button when AI mode is on', async () => {
    render(<NewCertTrackPage />)
    await userEvent.click(screen.getByTestId('ai-mode-toggle'))

    expect(screen.getByRole('button', { name: 'Create Track & Generate Questions' })).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Validation with AI mode
  // -------------------------------------------------------------------------

  it('requires description when AI mode is on', async () => {
    render(<NewCertTrackPage />)
    await userEvent.click(screen.getByTestId('ai-mode-toggle'))

    // Fill title but not description
    await userEvent.type(screen.getByLabelText('Title'), 'Test Certification')

    // Submit
    const form = screen.getByTestId('new-cert-track-form').querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Description is required when generating with AI')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Non-AI submission
  // -------------------------------------------------------------------------

  it('submits without AI and redirects to track editor', async () => {
    const trackId = 'track-123'
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/admin/certifications' && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ track: { id: trackId } }),
        })
      }
      if (url === '/api/admin/certifications') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ tracks: [] }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })

    render(<NewCertTrackPage />)
    await userEvent.type(screen.getByLabelText('Title'), 'My Cert Track')
    // Description is optional when AI is off

    const form = screen.getByTestId('new-cert-track-form').querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(`/admin/certifications/${trackId}`)
    })
  })

  // -------------------------------------------------------------------------
  // AI submission flow
  // -------------------------------------------------------------------------

  it('calls generation API and writes questions when AI mode is on', async () => {
    const trackId = 'track-456'
    const mockQuestion = {
      id: 'q-1',
      question_text: 'What is AAVA?',
      question_type: 'multiple_choice',
      options: [
        { text: 'A method', is_correct: true },
        { text: 'A tool', is_correct: false },
      ],
      correct_answer: 'A method',
      rubric: null,
      difficulty: 'easy',
      max_points: 10,
    }

    const fetchCalls: Array<{ url: string; method?: string }> = []

    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      fetchCalls.push({ url, method: opts?.method })

      // Prerequisite tracks
      if (url === '/api/admin/certifications' && !opts?.method) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ tracks: [] }),
        })
      }
      // Courses list
      if (url === '/api/admin/courses') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ courses: [] }),
        })
      }
      // Create track
      if (url === '/api/admin/certifications' && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ track: { id: trackId } }),
        })
      }
      // Generate certification questions
      if (url === '/api/admin/generate/certification' && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ questions: [mockQuestion] }),
        })
      }
      // Write question to DB
      if (url === `/api/admin/certifications/${trackId}/questions` && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ question: { ...mockQuestion, track_id: trackId } }),
        })
      }

      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })

    render(<NewCertTrackPage />)

    // Enable AI mode
    await userEvent.click(screen.getByTestId('ai-mode-toggle'))

    // Fill required fields
    await userEvent.type(screen.getByLabelText('Title'), 'AI Cert Track')
    await userEvent.type(screen.getByLabelText('Description'), 'A certification about AI basics')

    // Submit
    const form = screen.getByTestId('new-cert-track-form').querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(`/admin/certifications/${trackId}`)
    })

    // Verify the generation API was called
    const genCall = fetchCalls.find((c) => c.url === '/api/admin/generate/certification')
    expect(genCall).toBeDefined()

    // Verify questions were written to DB
    const writeCall = fetchCalls.find((c) => c.url === `/api/admin/certifications/${trackId}/questions` && c.method === 'POST')
    expect(writeCall).toBeDefined()
  })

  it('shows generating overlay during AI question generation', async () => {
    const trackId = 'track-789'

    // Make the generation API hang so we can check the overlay
    let resolveGeneration: ((value: unknown) => void) | undefined
    const generationPromise = new Promise((resolve) => {
      resolveGeneration = resolve
    })

    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/admin/certifications' && !opts?.method) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ tracks: [] }) })
      }
      if (url === '/api/admin/courses') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ courses: [] }) })
      }
      if (url === '/api/admin/certifications' && opts?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ track: { id: trackId } }) })
      }
      if (url === '/api/admin/generate/certification') {
        return generationPromise
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })

    render(<NewCertTrackPage />)
    await userEvent.click(screen.getByTestId('ai-mode-toggle'))
    await userEvent.type(screen.getByLabelText('Title'), 'Test Track')
    await userEvent.type(screen.getByLabelText('Description'), 'Test description')

    const form = screen.getByTestId('new-cert-track-form').querySelector('form')!
    fireEvent.submit(form)

    // Wait for the overlay to appear (after track creation completes)
    await waitFor(() => {
      expect(screen.getByTestId('generating-overlay')).toBeInTheDocument()
    })

    expect(screen.getByText('Generating certification questions...')).toBeInTheDocument()
    expect(screen.getByText('Generating exam questions...')).toBeInTheDocument()

    // Resolve generation to clean up
    resolveGeneration!({
      ok: true,
      json: () => Promise.resolve({ questions: [] }),
    })

    await waitFor(() => {
      expect(screen.queryByTestId('generating-overlay')).not.toBeInTheDocument()
    })
  })
})
