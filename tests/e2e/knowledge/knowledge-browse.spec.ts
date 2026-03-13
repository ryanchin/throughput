import { test, expect } from '@playwright/test'

test.describe('Knowledge Base', () => {
  test('renders sidebar navigation with sections', async ({ page }) => {
    await page.goto('/test-knowledge')

    const sidebar = page.locator('[data-testid="knowledge-sidebar"]')
    await expect(sidebar).toBeVisible()

    // Verify all three top-level sections are present
    await expect(sidebar.getByText('Getting Started')).toBeVisible()
    await expect(sidebar.getByText('AAVA Methodology')).toBeVisible()
    await expect(sidebar.getByText('Sales Resources')).toBeVisible()
  })

  test('sidebar sections are expandable with children', async ({ page }) => {
    await page.goto('/test-knowledge')

    const sidebar = page.locator('[data-testid="knowledge-sidebar"]')

    // Expand "Getting Started" section
    const expandBtn = sidebar.getByLabel('Expand section').first()
    await expandBtn.click()

    // Children should now be visible
    await expect(sidebar.getByText('How to use Throughput')).toBeVisible()
    await expect(sidebar.getByText('Your Learning Path')).toBeVisible()
  })

  test('renders knowledge home page heading', async ({ page }) => {
    await page.goto('/test-knowledge')

    await expect(page.locator('h1')).toContainText('Knowledge Base')
  })

  test('renders knowledge home page description', async ({ page }) => {
    await page.goto('/test-knowledge')

    await expect(
      page.getByText('Browse guides, references, and how-tos to help you work effectively.')
    ).toBeVisible()
  })

  test('renders Recently Updated section with page cards', async ({ page }) => {
    await page.goto('/test-knowledge')

    await expect(page.getByText('Recently Updated')).toBeVisible()

    const cards = page.locator('[data-testid="knowledge-page-card"]')
    await expect(cards).toHaveCount(5)
  })

  test('page cards display titles', async ({ page }) => {
    await page.goto('/test-knowledge')

    const cards = page.locator('[data-testid="knowledge-page-card"]')

    await expect(cards.filter({ hasText: 'How to use Throughput' })).toHaveCount(1)
    await expect(cards.filter({ hasText: 'Goals & OKRs' })).toHaveCount(1)
    await expect(cards.filter({ hasText: 'Sprint Planning' })).toHaveCount(1)
    await expect(cards.filter({ hasText: 'Pitch Deck Guide' })).toHaveCount(1)
    await expect(cards.filter({ hasText: 'Your Learning Path' })).toHaveCount(1)
  })

  test('page cards display visibility badges', async ({ page }) => {
    await page.goto('/test-knowledge')

    // Check that visibility badges are present on cards
    const cards = page.locator('[data-testid="knowledge-page-card"]')

    // "Public" badge on the first card (How to use Throughput)
    const publicCard = cards.filter({ hasText: 'How to use Throughput' })
    await expect(publicCard.getByText('Public')).toBeVisible()

    // "Internal" badge on Goals & OKRs card
    const internalCard = cards.filter({ hasText: 'Goals & OKRs' })
    await expect(internalCard.getByText('Internal')).toBeVisible()

    // "sales" group badge on Pitch Deck Guide card
    const salesCard = cards.filter({ hasText: 'Pitch Deck Guide' })
    await expect(salesCard.getByText('sales')).toBeVisible()
  })

  test('page cards display updated dates', async ({ page }) => {
    await page.goto('/test-knowledge')

    const cards = page.locator('[data-testid="knowledge-page-card"]')

    // First card should show Mar 12, 2026
    const firstCard = cards.filter({ hasText: 'How to use Throughput' })
    await expect(firstCard.getByText('Mar 12, 2026')).toBeVisible()
  })

  test('renders knowledge page with breadcrumbs', async ({ page }) => {
    await page.goto('/test-knowledge-page')

    const breadcrumbs = page.locator('[data-testid="breadcrumbs"]')
    await expect(breadcrumbs).toBeVisible()

    // Verify breadcrumb trail: Knowledge > Getting Started > How to use Throughput
    await expect(breadcrumbs.getByText('Knowledge')).toBeVisible()
    await expect(breadcrumbs.getByText('Getting Started')).toBeVisible()
    await expect(page.locator('[data-testid="breadcrumb-current"]')).toContainText(
      'How to use Throughput'
    )
  })

  test('renders knowledge page title', async ({ page }) => {
    await page.goto('/test-knowledge-page')

    await expect(page.locator('[data-testid="page-title"]')).toContainText(
      'How to use Throughput'
    )
  })

  test('renders knowledge page content viewer', async ({ page }) => {
    await page.goto('/test-knowledge-page')

    // LessonViewer renders with data-testid="lesson-viewer"
    const viewer = page.locator('[data-testid="lesson-viewer"]')
    await expect(viewer).toBeVisible()

    // Verify actual content renders inside the viewer
    await expect(viewer.getByText('Throughput is your central hub')).toBeVisible()
  })

  test('sidebar highlights active page on knowledge page view', async ({ page }) => {
    await page.goto('/test-knowledge-page')

    const sidebar = page.locator('[data-testid="knowledge-sidebar"]')

    // The active link should have the accent text color class
    const activeLink = sidebar.getByText('How to use Throughput')
    await expect(activeLink).toBeVisible()
    await expect(activeLink).toHaveClass(/text-accent/)
  })

  test('sidebar shows "Knowledge Base" section header', async ({ page }) => {
    await page.goto('/test-knowledge')

    const sidebar = page.locator('[data-testid="knowledge-sidebar"]')
    await expect(sidebar.getByText('Knowledge Base')).toBeVisible()
  })
})
