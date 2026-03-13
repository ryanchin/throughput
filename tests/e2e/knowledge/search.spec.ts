import { test, expect } from '@playwright/test'

test.describe('Global Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-knowledge-search')
  })

  test('search bar renders', async ({ page }) => {
    const searchBar = page.locator('[data-testid="search-bar"]')
    await expect(searchBar).toBeVisible()

    const input = searchBar.locator('input')
    await expect(input).toBeVisible()
    await expect(input).toHaveAttribute('placeholder', 'Search...')
  })

  test('shows results when typing a query', async ({ page }) => {
    const input = page.locator('[data-testid="search-bar"] input')
    await input.fill('Throughput')

    // Wait for debounced search to fire and results to render
    const resultItems = page.locator('[data-testid="search-bar"] ul li')
    await expect(resultItems.first()).toBeVisible({ timeout: 5000 })

    // Should find "How to use Throughput" in mocked results
    await expect(page.getByText('How to use Throughput')).toBeVisible()
  })

  test('results display type badges', async ({ page }) => {
    const input = page.locator('[data-testid="search-bar"] input')
    await input.fill('AAVA')

    // Wait for results
    const resultItems = page.locator('[data-testid="search-bar"] ul li')
    await expect(resultItems.first()).toBeVisible({ timeout: 5000 })

    // Should show type badges for different result types
    const badges = page.locator('[data-testid="search-bar"] ul li span.rounded-full')
    await expect(badges.first()).toBeVisible()
    const badgeTexts = await badges.allTextContents()
    expect(badgeTexts.some(t => t === 'course')).toBe(true)
    expect(badgeTexts.some(t => t === 'certification')).toBe(true)
  })

  test('shows multiple result types', async ({ page }) => {
    const input = page.locator('[data-testid="search-bar"] input')
    // "AAVA" matches: AAVA Foundations Course, AAVA Practitioner Certification
    await input.fill('AAVA')

    const resultItems = page.locator('[data-testid="search-bar"] ul li')
    await expect(resultItems).toHaveCount(2, { timeout: 5000 })
  })

  test('shows no results for unmatched query', async ({ page }) => {
    const input = page.locator('[data-testid="search-bar"] input')
    await input.fill('xyznonexistent')

    // Wait for search to complete, should show "No results found"
    await expect(page.getByText('No results found')).toBeVisible({ timeout: 5000 })
  })

  test('clears results on escape', async ({ page }) => {
    const input = page.locator('[data-testid="search-bar"] input')
    await input.fill('Throughput')

    // Wait for results
    await expect(
      page.locator('[data-testid="search-bar"] ul li').first()
    ).toBeVisible({ timeout: 5000 })

    // Press Escape
    await input.press('Escape')

    // Results dropdown should close
    await expect(page.locator('[data-testid="search-bar"] ul')).not.toBeVisible()
  })

  test('search requires minimum 2 characters', async ({ page }) => {
    const input = page.locator('[data-testid="search-bar"] input')
    await input.fill('a')

    // Short pause to verify no results appear
    await page.waitForTimeout(500)

    // No results dropdown should appear for single character
    await expect(page.locator('[data-testid="search-bar"] ul')).not.toBeVisible()
  })
})
