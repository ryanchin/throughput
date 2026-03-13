import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import LessonNav from '@/components/training/LessonNav'

// Mock next/link to render a plain anchor
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const baseLessons = [
  { id: 'l1', title: 'Introduction', slug: 'introduction', order_index: 0 },
  { id: 'l2', title: 'Fundamentals', slug: 'fundamentals', order_index: 1 },
  { id: 'l3', title: 'Advanced Topics', slug: 'advanced-topics', order_index: 2 },
]

const baseProps = {
  lessons: baseLessons,
  lessonProgress: [] as Array<{ lesson_id: string; completed_at: string | null }>,
  quizInfo: [] as Array<{ lessonId: string; passed: boolean }>,
  currentLessonSlug: 'introduction',
  courseSlug: 'my-course',
  basePath: '/training',
  navigationMode: 'free' as const,
}

describe('LessonNav', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders all lessons with titles', () => {
    render(<LessonNav {...baseProps} />)
    expect(screen.getByText('Introduction')).toBeInTheDocument()
    expect(screen.getByText('Fundamentals')).toBeInTheDocument()
    expect(screen.getByText('Advanced Topics')).toBeInTheDocument()
  })

  it('has data-testid="lesson-nav"', () => {
    render(<LessonNav {...baseProps} />)
    expect(screen.getByTestId('lesson-nav')).toBeInTheDocument()
  })

  it('has data-testid for each lesson item', () => {
    render(<LessonNav {...baseProps} />)
    expect(screen.getByTestId('lesson-nav-item-introduction')).toBeInTheDocument()
    expect(screen.getByTestId('lesson-nav-item-fundamentals')).toBeInTheDocument()
    expect(screen.getByTestId('lesson-nav-item-advanced-topics')).toBeInTheDocument()
  })

  it('current lesson does not render as a link', () => {
    render(<LessonNav {...baseProps} currentLessonSlug="fundamentals" />)
    const currentItem = screen.getByTestId('lesson-nav-item-fundamentals')
    // Current lesson should not have an anchor child
    expect(currentItem.querySelector('a')).toBeNull()
  })

  it('non-current accessible lessons render as links in free mode', () => {
    render(<LessonNav {...baseProps} currentLessonSlug="introduction" />)
    const fundItem = screen.getByTestId('lesson-nav-item-fundamentals')
    const link = fundItem.querySelector('a')
    expect(link).not.toBeNull()
    expect(link).toHaveAttribute('href', '/training/my-course/fundamentals')
  })

  it('completed lessons are rendered as clickable links', () => {
    render(
      <LessonNav
        {...baseProps}
        currentLessonSlug="fundamentals"
        lessonProgress={[{ lesson_id: 'l1', completed_at: '2024-01-01' }]}
        navigationMode="sequential"
      />
    )
    const introItem = screen.getByTestId('lesson-nav-item-introduction')
    const link = introItem.querySelector('a')
    expect(link).not.toBeNull()
    expect(link).toHaveAttribute('href', '/training/my-course/introduction')
  })

  it('sequential mode: locks inaccessible lessons (no link, has lock icon)', () => {
    render(
      <LessonNav
        {...baseProps}
        currentLessonSlug="introduction"
        lessonProgress={[]}
        navigationMode="sequential"
      />
    )
    // Third lesson (index 2) should be locked — first lesson not completed
    const advItem = screen.getByTestId('lesson-nav-item-advanced-topics')
    expect(advItem.querySelector('a')).toBeNull()
    // Should have cursor-not-allowed class
    const lockedDiv = advItem.querySelector('.cursor-not-allowed')
    expect(lockedDiv).not.toBeNull()
  })

  it('sequential mode: second lesson accessible when first is completed', () => {
    render(
      <LessonNav
        {...baseProps}
        currentLessonSlug="introduction"
        lessonProgress={[{ lesson_id: 'l1', completed_at: '2024-01-01' }]}
        navigationMode="sequential"
      />
    )
    const fundItem = screen.getByTestId('lesson-nav-item-fundamentals')
    const link = fundItem.querySelector('a')
    expect(link).not.toBeNull()
    expect(link).toHaveAttribute('href', '/training/my-course/fundamentals')
  })

  it('free mode: all non-current lessons are clickable', () => {
    render(
      <LessonNav
        {...baseProps}
        currentLessonSlug="introduction"
        navigationMode="free"
      />
    )
    const fundItem = screen.getByTestId('lesson-nav-item-fundamentals')
    expect(fundItem.querySelector('a')).not.toBeNull()

    const advItem = screen.getByTestId('lesson-nav-item-advanced-topics')
    expect(advItem.querySelector('a')).not.toBeNull()
  })

  it('shows lesson numbers', () => {
    render(<LessonNav {...baseProps} />)
    expect(screen.getByText('1.')).toBeInTheDocument()
    expect(screen.getByText('2.')).toBeInTheDocument()
    expect(screen.getByText('3.')).toBeInTheDocument()
  })
})
