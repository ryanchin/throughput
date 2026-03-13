import { test, expect } from '@playwright/test'

test.describe('Admin Knowledge CMS', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-admin-knowledge')
  })

  test('renders page heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Knowledge Pages')
  })

  test('renders page rows', async ({ page }) => {
    const rows = page.locator('[data-testid="knowledge-page-row"]')
    await expect(rows).toHaveCount(7)
  })

  test('page rows display titles', async ({ page }) => {
    await expect(page.getByText('Getting Started')).toBeVisible()
    await expect(page.getByText('How to use Throughput')).toBeVisible()
    await expect(page.getByText('Your Learning Path')).toBeVisible()
    await expect(page.getByText('AAVA Methodology')).toBeVisible()
    await expect(page.getByText('Goals & OKRs')).toBeVisible()
    await expect(page.getByText('Sales Resources')).toBeVisible()
    await expect(page.getByText('Pitch Deck Guide')).toBeVisible()
  })

  test('renders published status badges', async ({ page }) => {
    const publishedBadges = page.locator('[data-testid="status-badge-published"]')
    await expect(publishedBadges).toHaveCount(4)

    // Verify badge text
    const firstPublished = publishedBadges.first()
    await expect(firstPublished).toContainText('PUBLISHED')
  })

  test('renders draft status badges', async ({ page }) => {
    const draftBadges = page.locator('[data-testid="status-badge-draft"]')
    await expect(draftBadges).toHaveCount(3)

    // Verify badge text
    const firstDraft = draftBadges.first()
    await expect(firstDraft).toContainText('DRAFT')
  })

  test('renders visibility badges', async ({ page }) => {
    // Public visibility badges
    await expect(page.getByText('Public').first()).toBeVisible()

    // Internal visibility badges
    await expect(page.getByText('Internal').first()).toBeVisible()

    // Group visibility badge (sales)
    await expect(page.getByText('sales').first()).toBeVisible()
  })

  test('new page button is visible', async ({ page }) => {
    const newBtn = page.locator('[data-testid="new-page-button"]')
    await expect(newBtn).toBeVisible()
    await expect(newBtn).toContainText('New Page')
  })

  test('each row has an edit button', async ({ page }) => {
    const editButtons = page.locator('[data-testid="edit-button"]')
    await expect(editButtons).toHaveCount(7)

    // First edit button should link to admin knowledge page
    const firstEdit = editButtons.first()
    await expect(firstEdit).toContainText('Edit')
    await expect(firstEdit).toHaveAttribute('href', /\/admin\/knowledge\//)
  })

  test('each row has a delete button', async ({ page }) => {
    const deleteButtons = page.locator('[data-testid="delete-button"]')
    await expect(deleteButtons).toHaveCount(7)

    const firstDelete = deleteButtons.first()
    await expect(firstDelete).toContainText('Delete')
  })

  test('delete button shows confirmation on click', async ({ page }) => {
    const firstDelete = page.locator('[data-testid="delete-button"]').first()
    await firstDelete.click()

    // Confirmation button should appear
    const confirmBtn = page.locator('[data-testid="confirm-delete-button"]')
    await expect(confirmBtn).toBeVisible()
    await expect(confirmBtn).toContainText('Confirm')

    // Cancel button should also appear
    await expect(page.getByText('Cancel')).toBeVisible()
  })

  test('table has correct column headers', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Visibility' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Updated' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible()
  })

  test('rows show formatted update dates', async ({ page }) => {
    // Mar 12 should appear for pages updated 2026-03-12
    await expect(page.getByText('Mar 12').first()).toBeVisible()
  })
})
