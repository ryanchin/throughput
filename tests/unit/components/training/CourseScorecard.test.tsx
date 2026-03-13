import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import CourseScorecard from '@/components/training/CourseScorecard'

// Mock requestAnimationFrame
beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(performance.now() + 2000)
    return 1
  })
})

const defaultProps = {
  courseTitle: 'Test Course',
  courseSlug: 'test-course',
  finalScore: 85,
  passingScore: 70,
  passed: true,
  completedAt: '2026-03-12T00:00:00Z',
  breakdown: [
    {
      quizTitle: 'Quiz 1',
      lessonTitle: 'Lesson 1',
      score: 40,
      maxScore: 50,
      percentage: 80,
      passed: true,
    },
    {
      quizTitle: 'Quiz 2',
      lessonTitle: 'Lesson 2',
      score: 45,
      maxScore: 50,
      percentage: 90,
      passed: true,
    },
  ],
  zone: 'training' as const,
}

// Helper to get the scorecard container (handles strict mode double-render)
function renderScorecard(props = defaultProps) {
  const result = render(<CourseScorecard {...props} />)
  const container = result.container.querySelector('[data-testid="course-scorecard"]')!
  return { ...result, scorecard: container }
}

describe('CourseScorecard', () => {
  it('renders the scorecard container', () => {
    const { scorecard } = renderScorecard()
    expect(scorecard).toBeDefined()
  })

  it('renders course title text', () => {
    const { scorecard } = renderScorecard()
    expect(within(scorecard as HTMLElement).getByText('Test Course')).toBeDefined()
  })

  it('renders PASSED badge when passed', () => {
    const { scorecard } = renderScorecard()
    const badge = within(scorecard as HTMLElement).getByTestId('pass-fail-badge')
    expect(badge.textContent).toBe('PASSED')
  })

  it('renders NOT PASSED badge when failed', () => {
    const { scorecard } = renderScorecard({ ...defaultProps, passed: false, finalScore: 50 })
    const badge = within(scorecard as HTMLElement).getByTestId('pass-fail-badge')
    expect(badge.textContent).toBe('NOT PASSED')
  })

  it('shows encouragement message on failure', () => {
    const { scorecard } = renderScorecard({ ...defaultProps, passed: false, finalScore: 50 })
    expect(within(scorecard as HTMLElement).getByText(/needed 70% to pass/)).toBeDefined()
  })

  it('does not show encouragement on pass', () => {
    const { scorecard } = renderScorecard()
    expect(within(scorecard as HTMLElement).queryByText(/needed 70% to pass/)).toBeNull()
  })

  it('renders quiz breakdown table with correct rows', () => {
    const { scorecard } = renderScorecard()
    const rows = within(scorecard as HTMLElement).getAllByTestId('breakdown-row')
    expect(rows).toHaveLength(2)
  })

  it('renders LinkedIn share button when passed', () => {
    const { scorecard } = renderScorecard()
    expect(within(scorecard as HTMLElement).getByTestId('linkedin-share-btn')).toBeDefined()
  })

  it('does not render LinkedIn share button when failed', () => {
    const { scorecard } = renderScorecard({ ...defaultProps, passed: false, finalScore: 50 })
    expect(within(scorecard as HTMLElement).queryByTestId('linkedin-share-btn')).toBeNull()
  })

  it('renders Browse More Courses button with correct href', () => {
    const { scorecard } = renderScorecard()
    const btn = within(scorecard as HTMLElement).getByTestId('browse-courses-btn')
    expect(btn.getAttribute('href')).toBe('/training')
  })

  it('renders View Certificate button when hasCertification is true and passed', () => {
    const { scorecard } = renderScorecard({ ...defaultProps, hasCertification: true })
    expect(within(scorecard as HTMLElement).getByTestId('view-certificate-btn')).toBeDefined()
  })

  it('does not render View Certificate button by default', () => {
    const { scorecard } = renderScorecard()
    expect(within(scorecard as HTMLElement).queryByTestId('view-certificate-btn')).toBeNull()
  })

  it('renders confetti canvas element', () => {
    const { scorecard } = renderScorecard()
    expect(within(scorecard as HTMLElement).getByTestId('confetti-canvas')).toBeDefined()
  })

  it('does not render breakdown table when no quizzes', () => {
    const { scorecard } = renderScorecard({ ...defaultProps, breakdown: [] })
    expect(within(scorecard as HTMLElement).queryByTestId('quiz-breakdown-table')).toBeNull()
  })
})
