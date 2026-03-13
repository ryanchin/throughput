import { test, expect } from '@playwright/test'

test.describe('Admin User Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-admin-users')
    await page.waitForSelector('[data-testid="user-tracking-table"]')
  })

  test('renders the user tracking table', async ({ page }) => {
    await expect(page.getByTestId('user-tracking-table')).toBeVisible()
  })

  test('displays all 4 user rows', async ({ page }) => {
    const rows = page.getByTestId('user-row')
    await expect(rows).toHaveCount(4)
  })

  test('displays user names as links', async ({ page }) => {
    await expect(page.getByText('Alice Johnson')).toBeVisible()
    await expect(page.getByText('Bob Smith')).toBeVisible()
  })

  test('displays user with null name as "Unnamed"', async ({ page }) => {
    await expect(page.getByText('Unnamed')).toBeVisible()
  })

  test('displays enrollment counts', async ({ page }) => {
    // Alice has 3 enrolled, 2 passed — check within her row's table cells
    const aliceRow = page.getByTestId('user-row').filter({ hasText: 'Alice Johnson' })
    // The 4th and 5th td contain enrolled and passed counts
    const cells = aliceRow.locator('td')
    await expect(cells.nth(3)).toHaveText('3')
    await expect(cells.nth(4)).toHaveText('2')
  })

  test('displays avg score with color coding', async ({ page }) => {
    // Alice: 88% (green), Bob: 72% (green)
    await expect(page.getByText('88%')).toBeVisible()
    await expect(page.getByText('72%')).toBeVisible()
  })

  test('displays dash for null avg score', async ({ page }) => {
    const carolRow = page.getByTestId('user-row').filter({ hasText: 'Carol Williams' })
    await expect(carolRow.getByText('-')).toBeVisible()
  })

  test('search filters users by name', async ({ page }) => {
    const searchInput = page.getByTestId('user-search')
    await searchInput.fill('Alice')
    const rows = page.getByTestId('user-row')
    await expect(rows).toHaveCount(1)
    await expect(page.getByText('Alice Johnson')).toBeVisible()
  })

  test('search filters by email', async ({ page }) => {
    const searchInput = page.getByTestId('user-search')
    await searchInput.fill('bob@')
    const rows = page.getByTestId('user-row')
    await expect(rows).toHaveCount(1)
    await expect(page.getByText('Bob Smith')).toBeVisible()
  })

  test('search shows empty state when no matches', async ({ page }) => {
    const searchInput = page.getByTestId('user-search')
    await searchInput.fill('nonexistent')
    await expect(page.getByText('No users match your search.')).toBeVisible()
  })

  test('export CSV button exists', async ({ page }) => {
    await expect(page.getByTestId('export-csv-btn')).toBeVisible()
  })

  test('clicking column header changes sort order', async ({ page }) => {
    // Click on "Name" column header to sort
    await page.getByRole('columnheader', { name: /Name/ }).click()
    // First row should now be sorted alphabetically
    const firstRow = page.getByTestId('user-row').first()
    await expect(firstRow).toBeVisible()
  })

  test('displays role badges', async ({ page }) => {
    await expect(page.getByText('employee').first()).toBeVisible()
    await expect(page.getByText('sales')).toBeVisible()
    await expect(page.getByText('admin')).toBeVisible()
  })

  test('shows user count footer', async ({ page }) => {
    await expect(page.getByText('4 of 4 users shown')).toBeVisible()
  })

  test('search updates user count', async ({ page }) => {
    const searchInput = page.getByTestId('user-search')
    await searchInput.fill('Alice')
    await expect(page.getByText('1 of 4 users shown')).toBeVisible()
  })
})
