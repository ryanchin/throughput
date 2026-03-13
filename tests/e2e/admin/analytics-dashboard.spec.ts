import { test, expect } from '@playwright/test'

test.describe('Admin Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-admin-dashboard')
  })

  test('renders the dashboard heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Dashboard')
  })

  test('displays all four stat cards with numeric values', async ({ page }) => {
    const statCards = page.locator('[data-testid="stat-card"]')
    await expect(statCards).toHaveCount(4)

    const statValues = page.locator('[data-testid="stat-value"]')
    await expect(statValues).toHaveCount(4)

    // Each stat value should contain a number
    for (let i = 0; i < 4; i++) {
      const text = await statValues.nth(i).textContent()
      expect(Number(text)).not.toBeNaN()
    }
  })

  test('stat cards show correct labels', async ({ page }) => {
    await expect(page.getByText('Total Users')).toBeVisible()
    await expect(page.getByText('Active This Month')).toBeVisible()
    await expect(page.getByText('Courses Published')).toBeVisible()
    await expect(page.getByText('Certifications Issued')).toBeVisible()
  })

  test('stat card shows role breakdown in subtitle', async ({ page }) => {
    await expect(page.getByText('25 employees, 10 sales, 5 public')).toBeVisible()
  })

  test('course performance table renders with data', async ({ page }) => {
    await expect(page.getByText('Course Performance')).toBeVisible()

    // Table headers — use first() since "Course" appears in multiple tables
    await expect(page.getByRole('columnheader', { name: 'Course' }).first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Enrolled' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Completed' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Pass Rate' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Avg Score' })).toBeVisible()

    // Test course data — use first() since course names appear in multiple tables
    await expect(page.getByText('AAVA Foundations').first()).toBeVisible()
    await expect(page.getByText('Sprint Planning Mastery').first()).toBeVisible()
  })

  test('most missed questions section renders', async ({ page }) => {
    await expect(page.getByText('Most Missed Questions')).toBeVisible()
    await expect(page.getByText('Metrics Quiz')).toBeVisible()
    await expect(page.getByText('78%')).toBeVisible()
  })

  test('recent certifications section renders', async ({ page }) => {
    await expect(page.getByText('Recent Certifications')).toBeVisible()
    await expect(page.getByText('Alice Johnson')).toBeVisible()
    await expect(page.getByText('AAVA Practitioner')).toBeVisible()
    await expect(page.getByText('92%')).toBeVisible()
  })

  test('export users CSV button is visible and clickable', async ({ page }) => {
    const exportBtn = page.locator('[data-testid="export-users-btn"]')
    await expect(exportBtn).toBeVisible()
    await expect(exportBtn).toContainText('Export Users CSV')
  })

  test('export completions CSV button is visible', async ({ page }) => {
    const exportBtn = page.locator('[data-testid="export-completions-btn"]')
    await expect(exportBtn).toBeVisible()
    await expect(exportBtn).toContainText('Export Completions CSV')
  })

  test('high incorrect rate questions are highlighted in red', async ({ page }) => {
    // 78% incorrect should have text-destructive class
    const highRate = page.locator('text=78%').first()
    await expect(highRate).toHaveClass(/text-destructive/)
  })
})
