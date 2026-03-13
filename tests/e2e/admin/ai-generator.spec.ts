import { test, expect } from '@playwright/test'

test.describe('AI Course Generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-ai-generator')
    await expect(
      page.getByRole('heading', { name: 'Create Course' })
    ).toBeVisible({ timeout: 10000 })
  })

  test('AI mode toggle is visible on new course form', async ({ page }) => {
    await expect(page.getByTestId('ai-mode-toggle')).toBeVisible()
  })

  test('toggling AI mode shows additional fields', async ({ page }) => {
    await page.getByTestId('ai-mode-toggle').click()
    await expect(page.getByTestId('lesson-count-input')).toBeVisible()
    await expect(page.getByTestId('include-quizzes-toggle')).toBeVisible()
  })

  test('lesson count input defaults to 5', async ({ page }) => {
    await page.getByTestId('ai-mode-toggle').click()
    await expect(page.getByTestId('lesson-count-input')).toHaveValue('5')
  })

  test('AI mode requires description', async ({ page }) => {
    await page.getByTestId('ai-mode-toggle').click()
    // Fill title but not description
    await page.locator('#title').fill('Test Course')
    // Try to submit
    await page.locator('button[type="submit"]').click()
    // Should show validation error for description
    await expect(
      page.getByText(/description is required/i)
    ).toBeVisible()
  })

  test('submit button text changes in AI mode', async ({ page }) => {
    // Default: "Create Course"
    await expect(
      page.locator('button[type="submit"]')
    ).toContainText('Create Course')

    // Toggle AI mode
    await page.getByTestId('ai-mode-toggle').click()
    await expect(
      page.locator('button[type="submit"]')
    ).toContainText('Generate Course')
  })

  test('toggling AI mode off hides AI-specific fields', async ({ page }) => {
    await page.getByTestId('ai-mode-toggle').click()
    await expect(page.getByTestId('lesson-count-input')).toBeVisible()

    await page.getByTestId('ai-mode-toggle').click()
    await expect(page.getByTestId('lesson-count-input')).not.toBeVisible()
  })

  test('include quizzes toggle defaults to on', async ({ page }) => {
    await page.getByTestId('ai-mode-toggle').click()
    const toggle = page.getByTestId('include-quizzes-toggle')
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  test('include quizzes toggle can be turned off', async ({ page }) => {
    await page.getByTestId('ai-mode-toggle').click()
    const toggle = page.getByTestId('include-quizzes-toggle')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  test('lesson count can be changed', async ({ page }) => {
    await page.getByTestId('ai-mode-toggle').click()
    const input = page.getByTestId('lesson-count-input')
    await input.fill('10')
    await expect(input).toHaveValue('10')
  })

  test('AI mode toggle has switch role', async ({ page }) => {
    const toggle = page.getByTestId('ai-mode-toggle')
    await expect(toggle).toHaveRole('switch')
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  test('AI mode toggle aria-checked updates on click', async ({ page }) => {
    const toggle = page.getByTestId('ai-mode-toggle')
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  test('form still has standard fields when AI mode is on', async ({
    page,
  }) => {
    await page.getByTestId('ai-mode-toggle').click()
    await expect(page.locator('#title')).toBeVisible()
    await expect(page.locator('#slug')).toBeVisible()
    await expect(page.locator('#description')).toBeVisible()
    await expect(page.locator('#zone')).toBeVisible()
  })

  test('description not required in non-AI mode', async ({ page }) => {
    // Fill only title — description should not be required
    await page.locator('#title').fill('Test Course')
    await page.locator('button[type="submit"]').click()
    // Should NOT show description required error
    await expect(
      page.getByText(/description is required/i)
    ).not.toBeVisible()
  })
})
