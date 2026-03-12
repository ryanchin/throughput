import { test, expect } from '@playwright/test'

test.describe('Draft/Published Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-admin-status')
    await expect(page.getByText('Admin: Course Management')).toBeVisible({ timeout: 10000 })
  })

  test('displays course cards with status badges', async ({ page }) => {
    // Draft course
    const draftCard = page.getByTestId('course-card-intro-to-aava')
    await expect(draftCard).toBeVisible()
    await expect(draftCard.getByTestId('status-badge-draft')).toBeVisible()
    await expect(draftCard.getByTestId('status-badge-draft')).toContainText('DRAFT')

    // Published course
    const pubCard = page.getByTestId('course-card-sales-playbook')
    await expect(pubCard).toBeVisible()
    await expect(pubCard.getByTestId('status-badge-published')).toBeVisible()
    await expect(pubCard.getByTestId('status-badge-published')).toContainText('PUBLISHED')
  })

  test('draft course shows Publish button, published shows Unpublish', async ({ page }) => {
    await expect(page.getByTestId('publish-button-intro-to-aava')).toBeVisible()
    await expect(page.getByTestId('unpublish-button-sales-playbook')).toBeVisible()
  })

  test('clicking Publish opens preflight modal', async ({ page }) => {
    await page.getByTestId('publish-button-intro-to-aava').click()

    const modal = page.getByTestId('preflight-modal')
    await expect(modal).toBeVisible({ timeout: 5000 })
    await expect(modal).toContainText('Publish')
    await expect(modal).toContainText('Introduction to AAVA')
  })

  test('preflight modal can be closed with Cancel', async ({ page }) => {
    await page.getByTestId('publish-button-intro-to-aava').click()
    const modal = page.getByTestId('preflight-modal')
    await expect(modal).toBeVisible({ timeout: 5000 })

    await modal.getByText('Cancel').click()
    await expect(modal).not.toBeVisible()
  })

  test('lesson rows display with status badges', async ({ page }) => {
    // Check lesson rows are visible
    const publishedLesson = page.getByTestId('lesson-row-00000000-0000-0000-0000-000000000010')
    await expect(publishedLesson).toBeVisible()
    await expect(publishedLesson).toContainText('What is AAVA?')
    await expect(publishedLesson.getByTestId('status-badge-published')).toBeVisible()

    const draftLesson = page.getByTestId('lesson-row-00000000-0000-0000-0000-000000000011')
    await expect(draftLesson).toBeVisible()
    await expect(draftLesson).toContainText('Core Principles')
    await expect(draftLesson.getByTestId('status-badge-draft')).toBeVisible()
  })

  test('lesson status toggle is visible', async ({ page }) => {
    const toggle = page.getByTestId('status-toggle-00000000-0000-0000-0000-000000000010')
    await expect(toggle).toBeVisible()
    // Published lesson should have aria-checked true
    await expect(toggle).toHaveAttribute('aria-checked', 'true')

    const draftToggle = page.getByTestId('status-toggle-00000000-0000-0000-0000-000000000011')
    await expect(draftToggle).toHaveAttribute('aria-checked', 'false')
  })
})
