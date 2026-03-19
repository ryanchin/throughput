import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiContextPanel, type AiContextPanelProps } from '@/components/admin/AiContextPanel'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

function makeProps(overrides: Partial<AiContextPanelProps> = {}): AiContextPanelProps {
  return {
    instructions: '',
    onInstructionsChange: vi.fn(),
    preset: null,
    onPresetChange: vi.fn(),
    fileText: null,
    fileName: null,
    fileWordCount: 0,
    onFileUploaded: vi.fn(),
    onFileRemoved: vi.fn(),
    fileUploading: false,
    onFileUploadStart: vi.fn(),
    selectedCourseIds: [],
    onCourseIdsChange: vi.fn(),
    ...overrides,
  }
}

// Default: courses fetch returns empty
function mockCoursesResponse(courses: unknown[] = []) {
  mockFetch.mockImplementation((url: string) => {
    if (url === '/api/admin/courses') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ courses }),
      })
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Not found' }) })
  })
}

describe('AiContextPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCoursesResponse()
  })

  afterEach(() => {
    cleanup()
  })

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it('renders the panel with all sections', async () => {
    render(<AiContextPanel {...makeProps()} />)
    expect(screen.getByTestId('ai-context-panel')).toBeInTheDocument()
    expect(screen.getByTestId('preset-group')).toBeInTheDocument()
    expect(screen.getByTestId('ai-instructions')).toBeInTheDocument()
    expect(screen.getByTestId('file-dropzone')).toBeInTheDocument()
    expect(screen.getByTestId('course-search')).toBeInTheDocument()
  })

  it('renders children slot', () => {
    render(
      <AiContextPanel {...makeProps()}>
        <div data-testid="custom-child">Extra controls</div>
      </AiContextPanel>
    )
    expect(screen.getByTestId('custom-child')).toBeInTheDocument()
  })

  it('hides course picker when showCoursePicker is false', () => {
    render(<AiContextPanel {...makeProps({ showCoursePicker: false })} />)
    expect(screen.queryByTestId('course-search')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Style Presets
  // -------------------------------------------------------------------------

  describe('Style Presets', () => {
    it('renders all four presets', () => {
      render(<AiContextPanel {...makeProps()} />)
      expect(screen.getByTestId('preset-technical')).toBeInTheDocument()
      expect(screen.getByTestId('preset-conversational')).toBeInTheDocument()
      expect(screen.getByTestId('preset-assessment')).toBeInTheDocument()
      expect(screen.getByTestId('preset-beginner')).toBeInTheDocument()
    })

    it('shows the selected preset with aria-checked true', () => {
      render(<AiContextPanel {...makeProps({ preset: 'technical' })} />)
      expect(screen.getByTestId('preset-technical')).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByTestId('preset-conversational')).toHaveAttribute('aria-checked', 'false')
    })

    it('calls onPresetChange when a preset is clicked', async () => {
      const onPresetChange = vi.fn()
      render(<AiContextPanel {...makeProps({ onPresetChange })} />)
      await userEvent.click(screen.getByTestId('preset-technical'))
      expect(onPresetChange).toHaveBeenCalledWith('technical')
    })

    it('calls onPresetChange with null when the active preset is clicked (toggle off)', async () => {
      const onPresetChange = vi.fn()
      render(<AiContextPanel {...makeProps({ preset: 'technical', onPresetChange })} />)
      await userEvent.click(screen.getByTestId('preset-technical'))
      expect(onPresetChange).toHaveBeenCalledWith(null)
    })
  })

  // -------------------------------------------------------------------------
  // Instructions
  // -------------------------------------------------------------------------

  describe('Instructions', () => {
    it('renders the textarea with the current value', () => {
      render(<AiContextPanel {...makeProps({ instructions: 'Focus on API design' })} />)
      expect(screen.getByTestId('ai-instructions')).toHaveValue('Focus on API design')
    })

    it('calls onInstructionsChange on input', async () => {
      const onInstructionsChange = vi.fn()
      render(<AiContextPanel {...makeProps({ onInstructionsChange })} />)
      const textarea = screen.getByTestId('ai-instructions')
      await userEvent.type(textarea, 'A')
      expect(onInstructionsChange).toHaveBeenCalled()
    })

    it('shows the correct placeholder', () => {
      render(<AiContextPanel {...makeProps()} />)
      expect(screen.getByPlaceholderText('Tell the AI what to focus on...')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // File Upload
  // -------------------------------------------------------------------------

  describe('File Upload', () => {
    it('shows the drop zone when no file is uploaded', () => {
      render(<AiContextPanel {...makeProps()} />)
      expect(screen.getByTestId('file-dropzone')).toBeInTheDocument()
      expect(screen.queryByTestId('file-preview')).not.toBeInTheDocument()
    })

    it('shows loading state when uploading', () => {
      render(<AiContextPanel {...makeProps({ fileUploading: true })} />)
      expect(screen.getByTestId('file-uploading')).toBeInTheDocument()
      expect(screen.queryByTestId('file-dropzone')).not.toBeInTheDocument()
    })

    it('shows file preview when file is uploaded', () => {
      render(
        <AiContextPanel
          {...makeProps({
            fileText: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5',
            fileName: 'reference.pdf',
            fileWordCount: 500,
          })}
        />
      )
      expect(screen.getByTestId('file-preview')).toBeInTheDocument()
      expect(screen.getByText('reference.pdf')).toBeInTheDocument()
      expect(screen.getByText('500 words')).toBeInTheDocument()
      // Should only show first 3 lines
      expect(screen.getByText('Show more')).toBeInTheDocument()
    })

    it('toggles full preview on Show more / Show less', async () => {
      render(
        <AiContextPanel
          {...makeProps({
            fileText: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5',
            fileName: 'test.docx',
            fileWordCount: 100,
          })}
        />
      )
      const showMoreBtn = screen.getByText('Show more')
      await userEvent.click(showMoreBtn)
      expect(screen.getByText('Show less')).toBeInTheDocument()
    })

    it('calls onFileRemoved when remove button is clicked', async () => {
      const onFileRemoved = vi.fn()
      render(
        <AiContextPanel
          {...makeProps({
            fileText: 'Some text',
            fileName: 'doc.pdf',
            fileWordCount: 10,
            onFileRemoved,
          })}
        />
      )
      await userEvent.click(screen.getByTestId('file-remove'))
      expect(onFileRemoved).toHaveBeenCalled()
    })

    it('calls onFileUploadStart and onFileUploaded when a file is selected', async () => {
      const onFileUploadStart = vi.fn()
      const onFileUploaded = vi.fn()

      // Mock the extract-text API
      mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
        if (url === '/api/admin/generate/extract-text' && opts?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ text: 'Extracted content', wordCount: 42 }),
          })
        }
        if (url === '/api/admin/courses') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ courses: [] }),
          })
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
      })

      render(
        <AiContextPanel
          {...makeProps({ onFileUploadStart, onFileUploaded })}
        />
      )

      const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' })
      const input = screen.getByTestId('file-input')
      await userEvent.upload(input, file)

      expect(onFileUploadStart).toHaveBeenCalled()
      await waitFor(() => {
        expect(onFileUploaded).toHaveBeenCalledWith({
          text: 'Extracted content',
          name: 'test.pdf',
          wordCount: 42,
        })
      })
    })

    it('shows error when upload fails', async () => {
      mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
        if (url === '/api/admin/generate/extract-text' && opts?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Unsupported file type' }),
          })
        }
        if (url === '/api/admin/courses') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ courses: [] }),
          })
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
      })

      render(<AiContextPanel {...makeProps()} />)
      const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' })
      const input = screen.getByTestId('file-input')
      await userEvent.upload(input, file)

      await waitFor(() => {
        expect(screen.getByTestId('file-error')).toHaveTextContent('Unsupported file type')
      })
    })
  })

  // -------------------------------------------------------------------------
  // Course Picker
  // -------------------------------------------------------------------------

  describe('Course Picker', () => {
    const mockCourses = [
      { id: 'c1', title: 'Sprint Planning 101', lesson_count: 5, description: 'Basics' },
      { id: 'c2', title: 'Advanced OKRs', lesson_count: 8, description: 'Advanced' },
      { id: 'c3', title: 'Sales Techniques', lesson_count: 3, description: 'Sales' },
    ]

    it('fetches and renders courses on mount', async () => {
      mockCoursesResponse(mockCourses)
      render(<AiContextPanel {...makeProps()} />)

      await waitFor(() => {
        expect(screen.getByText('Sprint Planning 101')).toBeInTheDocument()
        expect(screen.getByText('Advanced OKRs')).toBeInTheDocument()
        expect(screen.getByText('Sales Techniques')).toBeInTheDocument()
      })
    })

    it('shows loading state while fetching', () => {
      // Make fetch hang indefinitely
      mockFetch.mockImplementation(() => new Promise(() => {}))
      render(<AiContextPanel {...makeProps()} />)
      expect(screen.getByText('Loading courses...')).toBeInTheDocument()
    })

    it('filters courses by search (debounced)', async () => {
      mockCoursesResponse(mockCourses)
      render(<AiContextPanel {...makeProps()} />)

      await waitFor(() => {
        expect(screen.getByText('Sprint Planning 101')).toBeInTheDocument()
      })

      const search = screen.getByTestId('course-search')
      await userEvent.type(search, 'Sprint')

      // After debounce, only Sprint Planning should be visible
      await waitFor(() => {
        expect(screen.getByText('Sprint Planning 101')).toBeInTheDocument()
        expect(screen.queryByText('Advanced OKRs')).not.toBeInTheDocument()
        expect(screen.queryByText('Sales Techniques')).not.toBeInTheDocument()
      })
    })

    it('calls onCourseIdsChange when a course is toggled', async () => {
      const onCourseIdsChange = vi.fn()
      mockCoursesResponse(mockCourses)
      render(<AiContextPanel {...makeProps({ onCourseIdsChange })} />)

      await waitFor(() => {
        expect(screen.getByText('Sprint Planning 101')).toBeInTheDocument()
      })

      // Click the label to toggle the checkbox
      const checkbox = screen.getByTestId('course-checkbox-c1')
      await userEvent.click(checkbox)
      expect(onCourseIdsChange).toHaveBeenCalledWith(['c1'])
    })

    it('removes course id when already selected', async () => {
      const onCourseIdsChange = vi.fn()
      mockCoursesResponse(mockCourses)
      render(
        <AiContextPanel
          {...makeProps({ selectedCourseIds: ['c1', 'c2'], onCourseIdsChange })}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Sprint Planning 101')).toBeInTheDocument()
      })

      const checkbox = screen.getByTestId('course-checkbox-c1')
      await userEvent.click(checkbox)
      expect(onCourseIdsChange).toHaveBeenCalledWith(['c2'])
    })

    it('shows footer with selection count and estimated words', async () => {
      mockCoursesResponse(mockCourses)
      render(
        <AiContextPanel
          {...makeProps({ selectedCourseIds: ['c1', 'c2'] })}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('course-footer')).toBeInTheDocument()
      })

      const footer = screen.getByTestId('course-footer')
      expect(footer).toHaveTextContent('Selected: 2 courses')
      // 5 lessons * 150 + 8 lessons * 150 = 1950
      expect(footer).toHaveTextContent('1,950 words')
    })

    it('does not show footer when no courses are selected', async () => {
      mockCoursesResponse(mockCourses)
      render(<AiContextPanel {...makeProps({ selectedCourseIds: [] })} />)

      await waitFor(() => {
        expect(screen.getByText('Sprint Planning 101')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('course-footer')).not.toBeInTheDocument()
    })

    it('shows empty state when no courses match search', async () => {
      mockCoursesResponse(mockCourses)
      render(<AiContextPanel {...makeProps()} />)

      await waitFor(() => {
        expect(screen.getByText('Sprint Planning 101')).toBeInTheDocument()
      })

      const search = screen.getByTestId('course-search')
      await userEvent.type(search, 'nonexistent query xyz')

      await waitFor(() => {
        expect(screen.getByText('No courses match your search')).toBeInTheDocument()
      })
    })

    it('displays lesson count and estimated words for each course', async () => {
      mockCoursesResponse(mockCourses)
      render(<AiContextPanel {...makeProps()} />)

      await waitFor(() => {
        expect(screen.getByText('Sprint Planning 101')).toBeInTheDocument()
      })

      // Sprint Planning 101 has 5 lessons
      const courseList = screen.getByTestId('course-list')
      expect(within(courseList).getByText(/5 lessons/)).toBeInTheDocument()
      expect(within(courseList).getByText(/3 lessons/)).toBeInTheDocument()
    })
  })
})
