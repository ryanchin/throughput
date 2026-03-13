import { test, expect } from '@playwright/test'

test.describe('Certification Exam - Pre-exam State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-cert-exam')
    await page.waitForSelector('[data-testid="cert-exam-player"]')
  })

  test('renders exam info card', async ({ page }) => {
    await expect(page.getByTestId('cert-exam-player')).toBeVisible()
  })

  test('shows number of questions', async ({ page }) => {
    await expect(page.getByTestId('cert-exam-player')).toContainText('30')
  })

  test('shows time limit', async ({ page }) => {
    await expect(page.getByTestId('cert-exam-player')).toContainText('60')
  })

  test('shows passing score', async ({ page }) => {
    await expect(page.getByTestId('cert-exam-player')).toContainText('80%')
  })

  test('shows attempt count', async ({ page }) => {
    await expect(page.getByTestId('cert-exam-player')).toContainText('1 / 3')
  })

  test('shows start exam button enabled', async ({ page }) => {
    await expect(page.getByTestId('exam-start-btn')).toBeVisible()
    await expect(page.getByTestId('exam-start-btn')).toBeEnabled()
  })

  test('start button says Start Exam', async ({ page }) => {
    await expect(page.getByTestId('exam-start-btn')).toContainText('Start Exam')
  })

  test('shows track title', async ({ page }) => {
    await expect(page.getByTestId('cert-exam-player')).toContainText('AAVA Foundations')
  })

  test('shows exam rules', async ({ page }) => {
    await expect(page.getByTestId('cert-exam-player')).toContainText('Exam Rules')
    await expect(page.getByTestId('cert-exam-player')).toContainText('auto-submit')
  })

  test('shows back to track link', async ({ page }) => {
    const link = page.getByRole('link', { name: /Back to Track/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/certifications/aava-foundations')
  })
})

test.describe('Certification Exam - Max Attempts with Cooldown', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-cert-exam-maxed')
    await page.waitForSelector('[data-testid="cert-exam-player"]')
  })

  test('shows disabled start button', async ({ page }) => {
    const startBtn = page.getByTestId('exam-start-btn')
    await expect(startBtn).toBeVisible()
    await expect(startBtn).toBeDisabled()
  })

  test('shows attempt count as maxed', async ({ page }) => {
    await expect(page.getByTestId('cert-exam-player')).toContainText('3 / 3')
  })

  test('shows cooldown information', async ({ page }) => {
    const player = page.getByTestId('cert-exam-player')
    // Cooldown is set to 12h from now, so it should show the "Next attempt available in" message
    await expect(player).toContainText('Next attempt available in')
  })

  test('still shows exam details', async ({ page }) => {
    const player = page.getByTestId('cert-exam-player')
    await expect(player).toContainText('30')
    await expect(player).toContainText('60')
    await expect(player).toContainText('80%')
  })
})
