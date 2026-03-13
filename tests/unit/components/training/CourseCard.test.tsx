import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import CourseCard from '@/components/training/CourseCard'

// Mock next/link to render a plain anchor
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

function makeCourse(overrides: Partial<Parameters<typeof CourseCard>[0]['course']> = {}) {
  return {
    id: 'course-1',
    title: 'Test Course',
    slug: 'test-course',
    description: 'A course description',
    zone: 'training' as const,
    cover_image_url: null,
    lesson_count: 10,
    total_duration_minutes: 90,
    completed_lesson_count: 0,
    enrollment: null,
    ...overrides,
  }
}

describe('CourseCard', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders course title and description', () => {
    render(<CourseCard course={makeCourse()} basePath="/training" />)
    expect(screen.getByText('Test Course')).toBeInTheDocument()
    expect(screen.getByText('A course description')).toBeInTheDocument()
  })

  it('shows "Training" badge for training zone', () => {
    render(<CourseCard course={makeCourse({ zone: 'training' })} basePath="/training" />)
    expect(screen.getByText('Training')).toBeInTheDocument()
  })

  it('shows "Sales" badge for sales zone', () => {
    render(<CourseCard course={makeCourse({ zone: 'sales' })} basePath="/sales" />)
    expect(screen.getByText('Sales')).toBeInTheDocument()
  })

  it('shows lesson count and formatted duration', () => {
    render(
      <CourseCard
        course={makeCourse({ lesson_count: 5, total_duration_minutes: 90 })}
        basePath="/training"
      />
    )
    expect(screen.getByText('5 lessons')).toBeInTheDocument()
    expect(screen.getByText('1h 30m')).toBeInTheDocument()
  })

  it('shows singular "lesson" for count of 1', () => {
    render(
      <CourseCard course={makeCourse({ lesson_count: 1 })} basePath="/training" />
    )
    expect(screen.getByText('1 lesson')).toBeInTheDocument()
  })

  it('shows "Start Course" when not enrolled', () => {
    render(<CourseCard course={makeCourse({ enrollment: null })} basePath="/training" />)
    expect(screen.getByText('Start Course')).toBeInTheDocument()
  })

  it('shows progress bar and "Continue" when enrolled but not completed', () => {
    render(
      <CourseCard
        course={makeCourse({
          lesson_count: 10,
          completed_lesson_count: 3,
          enrollment: { id: 'e-1', enrolled_at: '2024-01-01', completed_at: null },
        })}
        basePath="/training"
      />
    )
    expect(screen.getByText('Continue')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.getByText('3/10 lessons')).toBeInTheDocument()
  })

  it('shows "Completed" badge when enrollment.completed_at is set', () => {
    render(
      <CourseCard
        course={makeCourse({
          lesson_count: 10,
          completed_lesson_count: 10,
          enrollment: {
            id: 'e-1',
            enrolled_at: '2024-01-01',
            completed_at: '2024-02-01',
          },
        })}
        basePath="/training"
      />
    )
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('links to correct path: basePath/slug', () => {
    render(
      <CourseCard course={makeCourse({ slug: 'my-course' })} basePath="/training" />
    )
    const link = screen.getByTestId('course-card')
    expect(link).toHaveAttribute('href', '/training/my-course')
  })

  it('has data-testid="course-card"', () => {
    render(<CourseCard course={makeCourse()} basePath="/training" />)
    expect(screen.getByTestId('course-card')).toBeInTheDocument()
  })

  it('has data-course-slug attribute', () => {
    render(<CourseCard course={makeCourse({ slug: 'abc' })} basePath="/training" />)
    expect(screen.getByTestId('course-card')).toHaveAttribute('data-course-slug', 'abc')
  })
})
