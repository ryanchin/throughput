import { test, expect } from '@playwright/test'

test.describe('Admin Quiz Builder', () => {
  test.describe('Empty State (No Quiz)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/test-quiz-builder')
      await expect(page.getByTestId('quiz-builder')).toBeVisible({ timeout: 10000 })
    })

    test('shows create quiz button when no quiz exists', async ({ page }) => {
      await expect(page.getByTestId('create-quiz-button')).toBeVisible()
      await expect(page.getByText('Create Quiz')).toBeVisible()
    })

    test('shows informational text about quiz builder', async ({ page }) => {
      await expect(page.getByText(/Add a quiz to this lesson/)).toBeVisible()
    })
  })

  test.describe('Quiz Builder with Questions', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/test-quiz-builder')
      await page.getByTestId('view-with-quiz').click()
      await expect(page.getByTestId('quiz-builder')).toBeVisible({ timeout: 10000 })
    })

    test('renders quiz title input with value', async ({ page }) => {
      const titleInput = page.getByTestId('quiz-title-input')
      await expect(titleInput).toBeVisible()
      await expect(titleInput).toHaveValue('Test Quiz')
    })

    test('renders passing score input', async ({ page }) => {
      const passingScore = page.getByTestId('quiz-passing-score-input')
      await expect(passingScore).toBeVisible()
      await expect(passingScore).toHaveValue('70')
    })

    test('displays total points calculator', async ({ page }) => {
      const totalPoints = page.getByTestId('quiz-total-points')
      await expect(totalPoints).toBeVisible()
      // 10 + 5 + 20 = 35
      await expect(totalPoints).toContainText('35')
    })

    test('renders all three question types', async ({ page }) => {
      // MC question
      await expect(
        page.getByTestId('question-card-00000000-0000-0000-0000-000000000301')
      ).toBeVisible()
      await expect(page.getByText('Multiple Choice')).toBeVisible()

      // T/F question
      await expect(
        page.getByTestId('question-card-00000000-0000-0000-0000-000000000302')
      ).toBeVisible()
      await expect(page.getByText('True / False')).toBeVisible()

      // OE question
      await expect(
        page.getByTestId('question-card-00000000-0000-0000-0000-000000000303')
      ).toBeVisible()
      await expect(page.getByText('Open Ended')).toBeVisible()
    })

    test('multiple choice question shows options with correct answer selected', async ({ page }) => {
      const mcCard = page.getByTestId('question-card-00000000-0000-0000-0000-000000000301')
      await expect(mcCard).toBeVisible()

      // Question text
      const questionText = page.getByTestId('question-text-00000000-0000-0000-0000-000000000301')
      await expect(questionText).toHaveValue('What is 2+2?')

      // Options exist
      await expect(page.getByTestId('mc-option-0')).toBeVisible()
      await expect(page.getByTestId('mc-option-1')).toBeVisible()
      await expect(page.getByTestId('mc-option-2')).toBeVisible()

      // Option text values
      await expect(page.getByTestId('mc-option-text-0')).toHaveValue('3')
      await expect(page.getByTestId('mc-option-text-1')).toHaveValue('4')
      await expect(page.getByTestId('mc-option-text-2')).toHaveValue('5')

      // Correct answer radio checked
      await expect(page.getByTestId('mc-option-radio-1')).toBeChecked()
    })

    test('true/false question shows correct answer selected', async ({ page }) => {
      const tfCard = page.getByTestId('question-card-00000000-0000-0000-0000-000000000302')
      await expect(tfCard).toBeVisible()

      const questionText = page.getByTestId('question-text-00000000-0000-0000-0000-000000000302')
      await expect(questionText).toHaveValue('The sky is blue.')

      // True should be checked
      await expect(page.getByTestId('tf-true-00000000-0000-0000-0000-000000000302')).toBeChecked()
      await expect(page.getByTestId('tf-false-00000000-0000-0000-0000-000000000302')).not.toBeChecked()
    })

    test('open ended question shows rubric textarea', async ({ page }) => {
      const oeCard = page.getByTestId('question-card-00000000-0000-0000-0000-000000000303')
      await expect(oeCard).toBeVisible()

      const questionText = page.getByTestId('question-text-00000000-0000-0000-0000-000000000303')
      await expect(questionText).toHaveValue('Explain the water cycle.')

      const rubric = page.getByTestId('question-rubric-00000000-0000-0000-0000-000000000303')
      await expect(rubric).toHaveValue('Should mention evaporation, condensation, and precipitation.')
    })

    test('point values are displayed for each question', async ({ page }) => {
      const mcPoints = page.getByTestId('question-points-00000000-0000-0000-0000-000000000301')
      await expect(mcPoints).toHaveValue('10')

      const tfPoints = page.getByTestId('question-points-00000000-0000-0000-0000-000000000302')
      await expect(tfPoints).toHaveValue('5')

      const oePoints = page.getByTestId('question-points-00000000-0000-0000-0000-000000000303')
      await expect(oePoints).toHaveValue('20')
    })

    test('add question button opens type picker', async ({ page }) => {
      await page.getByTestId('add-question-button').click()
      await expect(page.getByTestId('question-type-picker')).toBeVisible()

      // All three types available
      await expect(page.getByTestId('add-multiple_choice')).toBeVisible()
      await expect(page.getByTestId('add-true_false')).toBeVisible()
      await expect(page.getByTestId('add-open_ended')).toBeVisible()
    })

    test('preview quiz button is visible when questions exist', async ({ page }) => {
      await expect(page.getByTestId('preview-quiz-button')).toBeVisible()
    })

    test('each question has a drag handle', async ({ page }) => {
      await expect(
        page.getByTestId('question-drag-handle-00000000-0000-0000-0000-000000000301')
      ).toBeVisible()
      await expect(
        page.getByTestId('question-drag-handle-00000000-0000-0000-0000-000000000302')
      ).toBeVisible()
      await expect(
        page.getByTestId('question-drag-handle-00000000-0000-0000-0000-000000000303')
      ).toBeVisible()
    })

    test('each question has a delete button', async ({ page }) => {
      await expect(
        page.getByTestId('delete-question-00000000-0000-0000-0000-000000000301')
      ).toBeVisible()
      await expect(
        page.getByTestId('delete-question-00000000-0000-0000-0000-000000000302')
      ).toBeVisible()
      await expect(
        page.getByTestId('delete-question-00000000-0000-0000-0000-000000000303')
      ).toBeVisible()
    })

    test('MC question can add option up to max 6', async ({ page }) => {
      // Should have "Add Option" button since we have 3 options (< 6)
      await expect(page.getByTestId('add-mc-option')).toBeVisible()
    })

    test('MC option can be deleted when more than 2 exist', async ({ page }) => {
      // We have 3 MC options, so delete buttons should be visible
      await expect(page.getByTestId('mc-option-delete-0')).toBeVisible()
      await expect(page.getByTestId('mc-option-delete-1')).toBeVisible()
      await expect(page.getByTestId('mc-option-delete-2')).toBeVisible()
    })
  })

  test.describe('Quiz Preview Mode', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/test-quiz-builder')
      await page.getByTestId('view-preview').click()
      await expect(page.getByTestId('quiz-preview')).toBeVisible({ timeout: 10000 })
    })

    test('shows preview banner', async ({ page }) => {
      await expect(page.getByTestId('preview-banner')).toBeVisible()
      await expect(page.getByText(/Preview Mode/)).toBeVisible()
    })

    test('displays quiz title', async ({ page }) => {
      await expect(page.getByText('Test Quiz')).toBeVisible()
    })

    test('renders all questions in preview format', async ({ page }) => {
      await expect(
        page.getByTestId('preview-question-00000000-0000-0000-0000-000000000301')
      ).toBeVisible()
      await expect(
        page.getByTestId('preview-question-00000000-0000-0000-0000-000000000302')
      ).toBeVisible()
      await expect(
        page.getByTestId('preview-question-00000000-0000-0000-0000-000000000303')
      ).toBeVisible()
    })

    test('MC question options are disabled in preview', async ({ page }) => {
      const mcPreview = page.getByTestId('preview-question-00000000-0000-0000-0000-000000000301')
      const radios = mcPreview.locator('input[type="radio"]')
      const count = await radios.count()
      expect(count).toBe(3)

      for (let i = 0; i < count; i++) {
        await expect(radios.nth(i)).toBeDisabled()
      }
    })

    test('T/F options are disabled in preview', async ({ page }) => {
      const tfPreview = page.getByTestId('preview-question-00000000-0000-0000-0000-000000000302')
      const radios = tfPreview.locator('input[type="radio"]')
      const count = await radios.count()
      expect(count).toBe(2)

      for (let i = 0; i < count; i++) {
        await expect(radios.nth(i)).toBeDisabled()
      }
    })

    test('open ended textarea is disabled in preview', async ({ page }) => {
      const oePreview = page.getByTestId('preview-question-00000000-0000-0000-0000-000000000303')
      const textarea = oePreview.locator('textarea')
      await expect(textarea).toBeDisabled()
    })

    test('shows total points and question count in footer', async ({ page }) => {
      const footer = page.getByTestId('preview-footer')
      await expect(footer).toBeVisible()
      await expect(footer).toContainText('3 questions')
      await expect(footer).toContainText('35 points')
    })

    test('exit preview button returns to quiz builder', async ({ page }) => {
      await page.getByTestId('exit-preview-button').click()
      // Should switch back to with-quiz view (QuizBuilder)
      await expect(page.getByTestId('quiz-builder')).toBeVisible()
    })
  })

  test.describe('Delete Question Confirmation', () => {
    test('shows confirmation dialog before deleting', async ({ page }) => {
      await page.goto('/test-quiz-builder')
      await page.getByTestId('view-with-quiz').click()
      await expect(page.getByTestId('quiz-builder')).toBeVisible({ timeout: 10000 })

      let dialogMessage = ''
      page.on('dialog', async (dialog) => {
        dialogMessage = dialog.message()
        await dialog.dismiss()
      })

      await page.getByTestId('delete-question-00000000-0000-0000-0000-000000000301').click()
      expect(dialogMessage).toContain('cannot be undone')
    })
  })
})
