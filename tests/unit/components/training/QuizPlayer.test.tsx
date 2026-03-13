import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import QuizPlayer from '@/components/training/QuizPlayer'

afterEach(() => {
  cleanup()
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const MC_QUESTION = {
  id: 'q1',
  question_text: 'What is AAVA?',
  question_type: 'multiple_choice' as const,
  options: [{ text: 'A methodology' }, { text: 'A tool' }, { text: 'A language' }],
  max_points: 10,
  order_index: 0,
}

const TF_QUESTION = {
  id: 'q2',
  question_text: 'AAVA is open source',
  question_type: 'true_false' as const,
  options: null,
  max_points: 5,
  order_index: 1,
}

const OE_QUESTION = {
  id: 'q3',
  question_text: 'Describe sprint planning',
  question_type: 'open_ended' as const,
  options: null,
  max_points: 20,
  order_index: 2,
}

const defaultProps = {
  quizId: 'quiz-1',
  quizTitle: 'Test Quiz',
  questions: [MC_QUESTION, TF_QUESTION, OE_QUESTION],
  passingScore: 70,
  courseSlug: 'test-course',
  lessonSlug: 'test-lesson',
  basePath: '/training',
  onResults: vi.fn(),
}

describe('QuizPlayer', () => {
  it('renders first question with progress "Question 1 of 3"', () => {
    render(<QuizPlayer {...defaultProps} />)
    expect(screen.getByTestId('quiz-progress')).toHaveTextContent('Question 1 of 3')
    expect(screen.getByText('What is AAVA?')).toBeInTheDocument()
  })

  it('shows MC radio options for multiple_choice question', () => {
    render(<QuizPlayer {...defaultProps} />)
    expect(screen.getByTestId('mc-option-0')).toBeInTheDocument()
    expect(screen.getByTestId('mc-option-1')).toBeInTheDocument()
    expect(screen.getByTestId('mc-option-2')).toBeInTheDocument()
    expect(screen.getByText('A methodology')).toBeInTheDocument()
    expect(screen.getByText('A tool')).toBeInTheDocument()
    expect(screen.getByText('A language')).toBeInTheDocument()
  })

  it('shows True/False toggle buttons for true_false question', () => {
    render(<QuizPlayer {...defaultProps} />)
    // Select an MC answer and navigate to q2
    fireEvent.click(screen.getByTestId('mc-option-0'))
    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByTestId('tf-true')).toBeInTheDocument()
    expect(screen.getByTestId('tf-false')).toBeInTheDocument()
  })

  it('shows textarea for open_ended question', () => {
    render(<QuizPlayer {...defaultProps} />)
    // Navigate to q3
    fireEvent.click(screen.getByTestId('mc-option-0'))
    fireEvent.click(screen.getByText('Next'))
    fireEvent.click(screen.getByTestId('tf-true'))
    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByTestId('open-ended-textarea')).toBeInTheDocument()
  })

  it('back button hidden on first question', () => {
    render(<QuizPlayer {...defaultProps} />)
    expect(screen.queryByText('Back')).not.toBeInTheDocument()
  })

  it('next button hidden on last question', () => {
    render(<QuizPlayer {...defaultProps} />)
    // Navigate to last question
    fireEvent.click(screen.getByTestId('mc-option-0'))
    fireEvent.click(screen.getByText('Next'))
    fireEvent.click(screen.getByTestId('tf-true'))
    fireEvent.click(screen.getByText('Next'))
    expect(screen.queryByText('Next')).not.toBeInTheDocument()
  })

  it('submit button shown only on last question', () => {
    render(<QuizPlayer {...defaultProps} />)
    // First question: no Submit
    expect(screen.queryByText('Submit Quiz')).not.toBeInTheDocument()

    // Navigate to last
    fireEvent.click(screen.getByTestId('mc-option-0'))
    fireEvent.click(screen.getByText('Next'))
    fireEvent.click(screen.getByTestId('tf-true'))
    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Submit Quiz')).toBeInTheDocument()
  })

  it('next button disabled when no answer selected', () => {
    render(<QuizPlayer {...defaultProps} />)
    const nextButton = screen.getByText('Next')
    expect(nextButton).toBeDisabled()
  })

  it('can select MC option and navigate to next question', () => {
    render(<QuizPlayer {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mc-option-1'))
    const nextButton = screen.getByText('Next')
    expect(nextButton).not.toBeDisabled()
    fireEvent.click(nextButton)
    expect(screen.getByTestId('quiz-progress')).toHaveTextContent('Question 2 of 3')
  })

  it('shows character count for open-ended', () => {
    render(<QuizPlayer {...defaultProps} />)
    // Navigate to q3
    fireEvent.click(screen.getByTestId('mc-option-0'))
    fireEvent.click(screen.getByText('Next'))
    fireEvent.click(screen.getByTestId('tf-true'))
    fireEvent.click(screen.getByText('Next'))

    expect(screen.getByText('0 / 50 minimum characters')).toBeInTheDocument()

    const textarea = screen.getByTestId('open-ended-textarea')
    fireEvent.change(textarea, { target: { value: 'Hello world' } })
    expect(screen.getByText('11 / 50 minimum characters')).toBeInTheDocument()
  })

  it('has required data-testid attributes', () => {
    render(<QuizPlayer {...defaultProps} />)
    expect(screen.getByTestId('quiz-player')).toBeInTheDocument()
    expect(screen.getByTestId('quiz-progress')).toBeInTheDocument()
    expect(screen.getByTestId('mc-option-0')).toBeInTheDocument()
  })
})
