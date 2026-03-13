import { test, expect } from '@playwright/test'

test.describe('Course Completion Scorecard', () => {
  test.describe('Passed Scenario', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/test-course-scorecard')
      await page.waitForSelector('[data-testid="course-scorecard"]')
    })

    test('renders the scorecard container', async ({ page }) => {
      await expect(page.getByTestId('course-scorecard')).toBeVisible()
    })

    test('displays Course Complete heading', async ({ page }) => {
      await expect(page.getByText('Course Complete')).toBeVisible()
    })

    test('displays course title', async ({ page }) => {
      await expect(page.getByText('AAVA Foundations Course')).toBeVisible()
    })

    test('displays PASSED badge', async ({ page }) => {
      const badge = page.getByTestId('pass-fail-badge')
      await expect(badge).toBeVisible()
      await expect(badge).toHaveText('PASSED')
    })

    test('displays completion date', async ({ page }) => {
      await expect(page.getByText(/March 12, 2026/)).toBeVisible()
    })

    test('shows animated score that reaches final value', async ({ page }) => {
      const scoreEl = page.getByTestId('final-score')
      await expect(scoreEl).toBeVisible()
      // Wait for animation to complete (1.5s + buffer)
      await page.waitForTimeout(2000)
      await expect(scoreEl).toHaveText('82')
    })

    test('displays quiz breakdown table with 3 rows', async ({ page }) => {
      const table = page.getByTestId('quiz-breakdown-table')
      await expect(table).toBeVisible()
      const rows = page.getByTestId('breakdown-row')
      await expect(rows).toHaveCount(3)
    })

    test('shows quiz titles in breakdown', async ({ page }) => {
      await expect(page.getByText('Quiz 1: Foundations')).toBeVisible()
      await expect(page.getByText('Quiz 2: Deep Dive')).toBeVisible()
      await expect(page.getByText('Quiz 3: Applied')).toBeVisible()
    })

    test('shows LinkedIn share button', async ({ page }) => {
      const btn = page.getByTestId('linkedin-share-btn')
      await expect(btn).toBeVisible()
      await expect(btn).toHaveText(/Share to LinkedIn/)
    })

    test('shows Browse More Courses button', async ({ page }) => {
      const btn = page.getByTestId('browse-courses-btn')
      await expect(btn).toBeVisible()
      await expect(btn).toHaveAttribute('href', '/training')
    })

    test('renders confetti canvas', async ({ page }) => {
      await expect(page.getByTestId('confetti-canvas')).toBeVisible()
    })

    test('does not show encouragement message', async ({ page }) => {
      await expect(page.getByText(/needed.*to pass/)).not.toBeVisible()
    })
  })

  test.describe('Failed Scenario', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/test-course-scorecard')
      await page.waitForSelector('[data-testid="course-scorecard"]')
      await page.getByTestId('btn-failed').click()
      await page.waitForTimeout(500)
    })

    test('displays NOT PASSED badge', async ({ page }) => {
      const badge = page.getByTestId('pass-fail-badge')
      await expect(badge).toHaveText('NOT PASSED')
    })

    test('shows encouragement message', async ({ page }) => {
      await expect(page.getByText(/needed 70% to pass/)).toBeVisible()
    })

    test('does not show LinkedIn share button', async ({ page }) => {
      await expect(page.getByTestId('linkedin-share-btn')).not.toBeVisible()
    })

    test('shows animated score reaching 55', async ({ page }) => {
      const scoreEl = page.getByTestId('final-score')
      await page.waitForTimeout(2000)
      await expect(scoreEl).toHaveText('55')
    })

    test('shows 2 breakdown rows for failed scenario', async ({ page }) => {
      const rows = page.getByTestId('breakdown-row')
      await expect(rows).toHaveCount(2)
    })

    test('still shows Browse More Courses button', async ({ page }) => {
      await expect(page.getByTestId('browse-courses-btn')).toBeVisible()
    })
  })
})
