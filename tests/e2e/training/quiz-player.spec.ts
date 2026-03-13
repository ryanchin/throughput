import { test, expect } from '@playwright/test'

test.describe('Quiz Player', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-quiz-player')
    await page.getByTestId('mode-player').click()
    await page.getByTestId('quiz-player').waitFor()
  })

  // Helper to scope button lookups to the quiz-player container
  // (avoids conflict with Next.js Dev Tools button that also matches "Next")
  function quizPlayer(page: import('@playwright/test').Page) {
    return page.getByTestId('quiz-player')
  }

  test('renders first question with progress indicator', async ({ page }) => {
    const progress = page.getByTestId('quiz-progress')
    await expect(progress).toHaveText('Question 1 of 3')
    await expect(page.getByText('What is the primary goal of sprint planning?')).toBeVisible()
    await expect(page.getByText('Passing score: 70%')).toBeVisible()
    await expect(page.getByText('Sprint Planning Quiz')).toBeVisible()
  })

  test('shows MC options for multiple choice question', async ({ page }) => {
    await expect(page.getByTestId('mc-option-0')).toBeVisible()
    await expect(page.getByTestId('mc-option-1')).toBeVisible()
    await expect(page.getByTestId('mc-option-2')).toBeVisible()
    await expect(page.getByTestId('mc-option-0')).toContainText('Define sprint backlog')
    await expect(page.getByTestId('mc-option-1')).toContainText('Review past sprints')
    await expect(page.getByTestId('mc-option-2')).toContainText('Deploy to production')
  })

  test('can select MC option and navigate to next question', async ({ page }) => {
    await page.getByTestId('mc-option-0').click()
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()
    await expect(page.getByTestId('quiz-progress')).toHaveText('Question 2 of 3')
    await expect(page.getByText('Daily standups should be limited to 15 minutes.')).toBeVisible()
  })

  test('shows True/False toggle buttons on question 2', async ({ page }) => {
    await page.getByTestId('mc-option-0').click()
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()

    await expect(page.getByTestId('tf-true')).toBeVisible()
    await expect(page.getByTestId('tf-false')).toBeVisible()
    await expect(page.getByTestId('tf-true')).toHaveText('True')
    await expect(page.getByTestId('tf-false')).toHaveText('False')
  })

  test('can select True/False and navigate to next question', async ({ page }) => {
    await page.getByTestId('mc-option-0').click()
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()

    await page.getByTestId('tf-true').click()
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()

    await expect(page.getByTestId('quiz-progress')).toHaveText('Question 3 of 3')
    await expect(page.getByText('Explain why retrospectives are important for team improvement.')).toBeVisible()
  })

  test('shows textarea for open-ended question', async ({ page }) => {
    await page.getByTestId('mc-option-0').click()
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()
    await page.getByTestId('tf-true').click()
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()

    await expect(page.getByTestId('open-ended-textarea')).toBeVisible()
    await expect(page.getByTestId('open-ended-textarea')).toHaveAttribute('placeholder', 'Type your response...')
  })

  test('shows character count for open-ended and updates on typing', async ({ page }) => {
    await page.getByTestId('mc-option-0').click()
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()
    await page.getByTestId('tf-true').click()
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()

    await expect(page.getByText('0 / 50 minimum characters')).toBeVisible()

    await page.getByTestId('open-ended-textarea').fill('Hello world')
    await expect(page.getByText('11 / 50 minimum characters')).toBeVisible()
  })

  test('Back button hidden on first question', async ({ page }) => {
    await expect(quizPlayer(page).getByRole('button', { name: 'Back' })).not.toBeVisible()
  })

  test('Back button works on second question', async ({ page }) => {
    await page.getByTestId('mc-option-0').click()
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()
    await expect(page.getByTestId('quiz-progress')).toHaveText('Question 2 of 3')

    await quizPlayer(page).getByRole('button', { name: 'Back' }).click()
    await expect(page.getByTestId('quiz-progress')).toHaveText('Question 1 of 3')
  })

  test('Submit Quiz button shown only on last question', async ({ page }) => {
    // On question 1: no Submit button
    await expect(quizPlayer(page).getByRole('button', { name: 'Submit Quiz' })).not.toBeVisible()
    await expect(quizPlayer(page).getByRole('button', { name: 'Next' })).toBeVisible()

    // Navigate to question 3 (last)
    await page.getByTestId('mc-option-0').click()
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()
    await page.getByTestId('tf-true').click()
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()

    // On last question: Submit visible, Next not visible
    await expect(quizPlayer(page).getByRole('button', { name: 'Submit Quiz' })).toBeVisible()
    await expect(quizPlayer(page).getByRole('button', { name: 'Next' })).not.toBeVisible()
  })

  test('Next button disabled when no answer selected', async ({ page }) => {
    const nextBtn = quizPlayer(page).getByRole('button', { name: 'Next' })
    await expect(nextBtn).toBeVisible()
    await expect(nextBtn).toBeDisabled()
  })

  test('Next button enabled after selecting an answer', async ({ page }) => {
    const nextBtn = quizPlayer(page).getByRole('button', { name: 'Next' })
    await expect(nextBtn).toBeDisabled()

    await page.getByTestId('mc-option-1').click()
    await expect(nextBtn).toBeEnabled()
  })

  test('Submit Quiz button disabled when open-ended has no answer', async ({ page }) => {
    await page.getByTestId('mc-option-0').click()
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()
    await page.getByTestId('tf-true').click()
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()

    const submitBtn = quizPlayer(page).getByRole('button', { name: 'Submit Quiz' })
    await expect(submitBtn).toBeDisabled()
  })

  test('preserves answers when navigating back and forward', async ({ page }) => {
    // Answer q1
    await page.getByTestId('mc-option-1').click()
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()

    // Answer q2
    await page.getByTestId('tf-false').click()

    // Go back to q1
    await quizPlayer(page).getByRole('button', { name: 'Back' }).click()

    // The radio for option 1 should still be selected (border-accent indicates selection)
    const option1 = page.getByTestId('mc-option-1')
    await expect(option1).toHaveClass(/border-accent/)

    // Go forward to q2
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()

    // tf-false should still be selected
    const falseBtn = page.getByTestId('tf-false')
    await expect(falseBtn).toHaveClass(/bg-accent/)
  })

  test('progress bar updates as questions advance', async ({ page }) => {
    // Q1: 33%
    await expect(page.getByText('33%')).toBeVisible()

    await page.getByTestId('mc-option-0').click()
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()

    // Q2: 67%
    await expect(page.getByText('67%')).toBeVisible()

    await page.getByTestId('tf-true').click()
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()

    // Q3: 100%
    await expect(page.getByText('100%')).toBeVisible()
  })

  test('shows grading overlay when submitting', async ({ page }) => {
    // Mock the API to delay response
    await page.route('/api/quiz/submit', async (route) => {
      await new Promise((r) => setTimeout(r, 2000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          attempt: { id: 'a1', score: 85, passed: true, attempt_number: 1 },
          responses: [],
          quizTitle: 'Sprint Planning Quiz',
          passingScore: 70,
        }),
      })
    })

    // Navigate through all questions
    await page.getByTestId('mc-option-0').click()
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()
    await page.getByTestId('tf-true').click()
    await quizPlayer(page).getByRole('button', { name: 'Next' }).click()
    await page.getByTestId('open-ended-textarea').fill('Retrospectives help teams reflect and improve continuously.')
    await quizPlayer(page).getByRole('button', { name: 'Submit Quiz' }).click()

    // Grading overlay should appear
    await expect(page.getByTestId('quiz-grading-overlay')).toBeVisible()
    await expect(page.getByText('Your responses are being reviewed by AI...')).toBeVisible()
  })
})

test.describe('Quiz Results - Passed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-quiz-player')
    await page.getByTestId('mode-results-pass').click()
    await page.getByTestId('quiz-results').waitFor()
  })

  test('shows score badge with pass status', async ({ page }) => {
    const badge = page.getByTestId('quiz-score-badge')
    await expect(badge).toBeVisible()
    await expect(badge).toContainText('85')
    await expect(badge).toContainText('/ 100')
    await expect(page.getByText('Passed!')).toBeVisible()
  })

  test('shows quiz title and attempt info', async ({ page }) => {
    await expect(page.getByText('Sprint Planning Quiz')).toBeVisible()
    await expect(page.getByText(/Attempt #1/)).toBeVisible()
    await expect(page.getByText(/Passing score: 70%/)).toBeVisible()
  })

  test('shows total points earned', async ({ page }) => {
    // 10 + 5 + 15 = 30 earned out of 10 + 5 + 20 = 35 total
    await expect(page.getByText('30 / 35 points earned')).toBeVisible()
  })

  test('shows Question Breakdown heading', async ({ page }) => {
    await expect(page.getByText('Question Breakdown')).toBeVisible()
  })

  test('shows per-question results for all three questions', async ({ page }) => {
    await expect(page.getByTestId('quiz-result-item-0')).toBeVisible()
    await expect(page.getByTestId('quiz-result-item-1')).toBeVisible()
    await expect(page.getByTestId('quiz-result-item-2')).toBeVisible()
  })

  test('shows correct MC answer with points', async ({ page }) => {
    const item0 = page.getByTestId('quiz-result-item-0')
    await expect(item0).toContainText('What is the primary goal of sprint planning?')
    await expect(item0).toContainText('Define sprint backlog')
    await expect(item0).toContainText('10 / 10')
  })

  test('shows correct TF answer with points', async ({ page }) => {
    const item1 = page.getByTestId('quiz-result-item-1')
    await expect(item1).toContainText('Daily standups should be limited to 15 minutes.')
    await expect(item1).toContainText('True')
    await expect(item1).toContainText('5 / 5')
  })

  test('shows LLM feedback for open-ended question', async ({ page }) => {
    const item2 = page.getByTestId('quiz-result-item-2')
    await expect(item2).toContainText('Explain why retrospectives are important for team improvement.')
    await expect(item2).toContainText('15 / 20')

    // AI Score label
    await expect(item2).toContainText('AI Score: 15 / 20')

    // Feedback narrative
    await expect(item2).toContainText('Good understanding of retrospectives')

    // Strengths
    await expect(item2).toContainText('Strengths')
    await expect(item2).toContainText('Clear explanation of purpose')
    await expect(item2).toContainText('Good use of examples')

    // Improvements
    await expect(item2).toContainText('Areas for Improvement')
    await expect(item2).toContainText('Discuss specific retrospective formats')
    await expect(item2).toContainText('Include metrics for measuring improvement')
  })

  test('shows Retake Quiz button that switches to player mode', async ({ page }) => {
    const retakeBtn = page.getByRole('button', { name: 'Retake Quiz' })
    await expect(retakeBtn).toBeVisible()
    await retakeBtn.click()

    // Should switch to player mode
    await expect(page.getByTestId('quiz-player')).toBeVisible()
  })

  test('shows Back to Lesson link with correct href', async ({ page }) => {
    const link = page.getByRole('link', { name: 'Back to Lesson' })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/training/test-course/test-lesson')
  })

  test('shows Next Lesson link when passed', async ({ page }) => {
    const link = page.getByRole('link', { name: 'Next Lesson' })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/training/test-course')
  })
})

test.describe('Quiz Results - Failed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-quiz-player')
    await page.getByTestId('mode-results-fail').click()
    await page.getByTestId('quiz-results').waitFor()
  })

  test('shows failing score with Not Passed status', async ({ page }) => {
    const badge = page.getByTestId('quiz-score-badge')
    await expect(badge).toBeVisible()
    await expect(badge).toContainText('45')
    await expect(page.getByText('Not Passed')).toBeVisible()
  })

  test('shows attempt number for failed attempt', async ({ page }) => {
    await expect(page.getByText(/Attempt #2/)).toBeVisible()
  })

  test('shows correct answer for wrong MC response', async ({ page }) => {
    const item0 = page.getByTestId('quiz-result-item-0')
    await expect(item0).toContainText('Your answer:')
    await expect(item0).toContainText('Deploy to production')
    await expect(item0).toContainText('Correct answer:')
    await expect(item0).toContainText('Define sprint backlog')
    await expect(item0).toContainText('0 / 10')
  })

  test('shows correct answer for wrong TF response', async ({ page }) => {
    const item1 = page.getByTestId('quiz-result-item-1')
    await expect(item1).toContainText('Your answer:')
    await expect(item1).toContainText('False')
    await expect(item1).toContainText('Correct answer:')
    await expect(item1).toContainText('True')
    await expect(item1).toContainText('0 / 5')
  })

  test('does not show Next Lesson link when failed', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Next Lesson' })).not.toBeVisible()
  })

  test('still shows Retake Quiz and Back to Lesson', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Retake Quiz' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to Lesson' })).toBeVisible()
  })

  test('shows LLM feedback with no strengths listed', async ({ page }) => {
    const item2 = page.getByTestId('quiz-result-item-2')
    await expect(item2).toContainText('AI Score: 5 / 20')
    await expect(item2).toContainText('The answer is too brief and lacks substance.')
    // Improvements should still show
    await expect(item2).toContainText('Areas for Improvement')
    await expect(item2).toContainText('Provide more detail')
  })
})
