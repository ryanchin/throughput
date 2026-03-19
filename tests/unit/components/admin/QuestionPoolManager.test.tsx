import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock next/navigation
const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
    refresh: mockRefresh,
    replace: vi.fn(),
  }),
}))

import { QuestionPoolManager } from '@/components/admin/QuestionPoolManager'
import type { Database } from '@/lib/supabase/database.types'

type CertQuestion = Database['public']['Tables']['cert_questions']['Row']

const mockFetch = vi.fn()

function makeQuestion(overrides: Partial<CertQuestion> = {}): CertQuestion {
  return {
    id: 'q-1',
    track_id: 'track-1',
    question_text: 'What is the AAVA methodology?',
    question_type: 'multiple_choice',
    options: [
      { text: 'A PM framework', is_correct: true },
      { text: 'A coding language', is_correct: false },
    ],
    correct_answer: 'A PM framework',
    rubric: null,
    max_points: 10,
    difficulty: 'medium',
    tags: [],
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as CertQuestion
}

const defaultProps = {
  trackId: 'track-1',
  trackTitle: 'AAVA Foundations',
  trackDescription: 'A foundational certification track',
  questions: [] as CertQuestion[],
  questionsPerExam: 30,
  questionPoolSize: 50,
}

describe('QuestionPoolManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch

    // Default: courses fetch for AI panel
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/admin/courses') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ courses: [] }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })
  })

  afterEach(() => {
    cleanup()
  })

  // -------------------------------------------------------------------------
  // Basic rendering
  // -------------------------------------------------------------------------

  it('renders the question pool manager', () => {
    render(<QuestionPoolManager {...defaultProps} />)
    expect(screen.getByTestId('question-pool-manager')).toBeInTheDocument()
    expect(screen.getByText('Question Pool')).toBeInTheDocument()
  })

  it('renders the "Generate Questions" button', () => {
    render(<QuestionPoolManager {...defaultProps} />)
    expect(screen.getByTestId('generate-questions-button')).toBeInTheDocument()
    expect(screen.getByText('Generate Questions')).toBeInTheDocument()
  })

  it('renders the "Add Question" button', () => {
    render(<QuestionPoolManager {...defaultProps} />)
    expect(screen.getByTestId('add-question-button')).toBeInTheDocument()
  })

  it('shows empty state when no questions exist', () => {
    render(<QuestionPoolManager {...defaultProps} />)
    expect(screen.getByText(/No questions yet/)).toBeInTheDocument()
  })

  it('renders question rows when questions are provided', () => {
    render(
      <QuestionPoolManager
        {...defaultProps}
        questions={[makeQuestion({ id: 'q-1' }), makeQuestion({ id: 'q-2', question_text: 'Second question' })]}
      />
    )
    expect(screen.getByTestId('question-row-q-1')).toBeInTheDocument()
    expect(screen.getByTestId('question-row-q-2')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Generate panel toggle
  // -------------------------------------------------------------------------

  it('does not show generate panel by default', () => {
    render(<QuestionPoolManager {...defaultProps} />)
    expect(screen.queryByTestId('generate-questions-panel')).not.toBeInTheDocument()
  })

  it('shows generate panel when "Generate Questions" button is clicked', async () => {
    render(<QuestionPoolManager {...defaultProps} />)
    await userEvent.click(screen.getByTestId('generate-questions-button'))

    expect(screen.getByTestId('generate-questions-panel')).toBeInTheDocument()
    expect(screen.getByText('Generate Questions with AI')).toBeInTheDocument()
    expect(screen.getByTestId('ai-context-panel')).toBeInTheDocument()
    expect(screen.getByTestId('gen-question-count-input')).toBeInTheDocument()
  })

  it('hides generate panel when toggle button is clicked again', async () => {
    render(<QuestionPoolManager {...defaultProps} />)
    await userEvent.click(screen.getByTestId('generate-questions-button'))
    expect(screen.getByTestId('generate-questions-panel')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('generate-questions-button'))
    expect(screen.queryByTestId('generate-questions-panel')).not.toBeInTheDocument()
  })

  it('hides generate panel when close button is clicked', async () => {
    render(<QuestionPoolManager {...defaultProps} />)
    await userEvent.click(screen.getByTestId('generate-questions-button'))
    expect(screen.getByTestId('generate-questions-panel')).toBeInTheDocument()

    // Click the X close button
    const closeButton = screen.getByLabelText('Close generate panel')
    await userEvent.click(closeButton)
    expect(screen.queryByTestId('generate-questions-panel')).not.toBeInTheDocument()
  })

  it('shows default question count of 20', async () => {
    render(<QuestionPoolManager {...defaultProps} />)
    await userEvent.click(screen.getByTestId('generate-questions-button'))

    const input = screen.getByTestId('gen-question-count-input') as HTMLInputElement
    expect(input.value).toBe('20')
  })

  it('shows generate submit button with question count', async () => {
    render(<QuestionPoolManager {...defaultProps} />)
    await userEvent.click(screen.getByTestId('generate-questions-button'))

    expect(screen.getByTestId('generate-submit-button')).toHaveTextContent('Generate 20 Questions')
  })

  // -------------------------------------------------------------------------
  // Generation flow
  // -------------------------------------------------------------------------

  it('calls generation API and writes questions on submit', async () => {
    const mockGenQuestion = {
      question_text: 'Generated question?',
      question_type: 'multiple_choice',
      options: [
        { text: 'Option A', is_correct: true },
        { text: 'Option B', is_correct: false },
      ],
      correct_answer: 'Option A',
      rubric: null,
      difficulty: 'medium',
      max_points: 10,
    }

    const savedQuestion = makeQuestion({
      id: 'gen-q-1',
      question_text: 'Generated question?',
    })

    const fetchCalls: Array<{ url: string; method?: string }> = []

    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      fetchCalls.push({ url, method: opts?.method })

      if (url === '/api/admin/courses') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ courses: [] }) })
      }
      if (url === '/api/admin/generate/certification' && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ questions: [mockGenQuestion] }),
        })
      }
      if (url === '/api/admin/certifications/track-1/questions' && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ question: savedQuestion }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })

    render(<QuestionPoolManager {...defaultProps} />)
    await userEvent.click(screen.getByTestId('generate-questions-button'))
    await userEvent.click(screen.getByTestId('generate-submit-button'))

    await waitFor(() => {
      // Panel should close on success
      expect(screen.queryByTestId('generate-questions-panel')).not.toBeInTheDocument()
    })

    // Verify generation API was called
    const genCall = fetchCalls.find((c) => c.url === '/api/admin/generate/certification')
    expect(genCall).toBeDefined()

    // Verify question was written
    const writeCall = fetchCalls.find(
      (c) => c.url === '/api/admin/certifications/track-1/questions' && c.method === 'POST'
    )
    expect(writeCall).toBeDefined()

    // Verify router.refresh was called
    expect(mockRefresh).toHaveBeenCalled()

    // Verify the question appears in the list
    expect(screen.getByTestId('question-row-gen-q-1')).toBeInTheDocument()
  })

  it('shows error when generation API fails', async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/admin/courses') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ courses: [] }) })
      }
      if (url === '/api/admin/generate/certification' && opts?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })

    render(<QuestionPoolManager {...defaultProps} />)
    await userEvent.click(screen.getByTestId('generate-questions-button'))
    await userEvent.click(screen.getByTestId('generate-submit-button'))

    await waitFor(() => {
      expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument()
    })

    // Panel should still be visible so user can retry
    expect(screen.getByTestId('generate-questions-panel')).toBeInTheDocument()
  })

  it('shows overlay with progress messages during generation', async () => {
    let resolveGeneration: ((value: unknown) => void) | undefined
    const generationPromise = new Promise((resolve) => {
      resolveGeneration = resolve
    })

    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/admin/courses') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ courses: [] }) })
      }
      if (url === '/api/admin/generate/certification' && opts?.method === 'POST') {
        return generationPromise
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })

    render(<QuestionPoolManager {...defaultProps} />)
    await userEvent.click(screen.getByTestId('generate-questions-button'))
    await userEvent.click(screen.getByTestId('generate-submit-button'))

    await waitFor(() => {
      expect(screen.getByTestId('generate-overlay')).toBeInTheDocument()
    })

    expect(screen.getByText('Generating certification questions...')).toBeInTheDocument()
    expect(screen.getByText('Generating exam questions...')).toBeInTheDocument()

    // Resolve to clean up
    resolveGeneration!({
      ok: true,
      json: () => Promise.resolve({ questions: [] }),
    })

    await waitFor(() => {
      expect(screen.queryByTestId('generate-overlay')).not.toBeInTheDocument()
    })
  })

  it('disables generate button while generating', async () => {
    let resolveGeneration: ((value: unknown) => void) | undefined
    const generationPromise = new Promise((resolve) => {
      resolveGeneration = resolve
    })

    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/admin/courses') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ courses: [] }) })
      }
      if (url === '/api/admin/generate/certification' && opts?.method === 'POST') {
        return generationPromise
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })

    render(<QuestionPoolManager {...defaultProps} />)
    await userEvent.click(screen.getByTestId('generate-questions-button'))
    await userEvent.click(screen.getByTestId('generate-submit-button'))

    await waitFor(() => {
      expect(screen.getByTestId('generate-questions-button')).toBeDisabled()
    })

    expect(screen.getByTestId('generate-questions-button')).toHaveTextContent('Generating...')

    // Resolve to clean up
    resolveGeneration!({
      ok: true,
      json: () => Promise.resolve({ questions: [] }),
    })

    await waitFor(() => {
      expect(screen.getByTestId('generate-questions-button')).not.toBeDisabled()
    })
  })

  // -------------------------------------------------------------------------
  // Panel hides add form when generate panel opens
  // -------------------------------------------------------------------------

  it('hides add form when generate panel is opened', async () => {
    render(<QuestionPoolManager {...defaultProps} />)

    // Open add form
    await userEvent.click(screen.getByTestId('add-question-button'))
    expect(screen.getByTestId('add-question-form')).toBeInTheDocument()

    // Open generate panel (should hide add form)
    await userEvent.click(screen.getByTestId('generate-questions-button'))
    expect(screen.queryByTestId('add-question-form')).not.toBeInTheDocument()
    expect(screen.getByTestId('generate-questions-panel')).toBeInTheDocument()
  })

  it('hides generate panel when add form is opened', async () => {
    render(<QuestionPoolManager {...defaultProps} />)

    // Open generate panel
    await userEvent.click(screen.getByTestId('generate-questions-button'))
    expect(screen.getByTestId('generate-questions-panel')).toBeInTheDocument()

    // Open add form (should hide generate panel)
    await userEvent.click(screen.getByTestId('add-question-button'))
    expect(screen.queryByTestId('generate-questions-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('add-question-form')).toBeInTheDocument()
  })
})
