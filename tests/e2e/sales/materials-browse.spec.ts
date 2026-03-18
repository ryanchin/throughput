import { test, expect } from '@playwright/test'

test.describe('Sales Materials Browse', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-sales-browse')
    await expect(page.getByTestId('test-sales-browse')).toBeVisible({
      timeout: 10000,
    })
  })

  test('sales page renders hero heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Sales Enablement', level: 1 })
    ).toBeVisible()
  })

  test('sales page renders subtitle', async ({ page }) => {
    await expect(
      page.getByText('Courses, battle cards, and collateral to close deals faster')
    ).toBeVisible()
  })

  test('sales tabs container is visible', async ({ page }) => {
    await expect(page.getByTestId('sales-tabs')).toBeVisible()
  })

  test('both Courses and Materials tab triggers are visible', async ({ page }) => {
    await expect(page.getByTestId('courses-tab')).toBeVisible()
    await expect(page.getByTestId('materials-tab')).toBeVisible()
  })

  test('Courses tab is active by default', async ({ page }) => {
    const coursesTab = page.getByTestId('courses-tab')
    await expect(coursesTab).toHaveAttribute('aria-selected', 'true')
  })

  test('Courses tab shows course count', async ({ page }) => {
    const coursesTab = page.getByTestId('courses-tab')
    await expect(coursesTab).toContainText('(2)')
  })

  test('Materials tab shows material count', async ({ page }) => {
    const materialsTab = page.getByTestId('materials-tab')
    await expect(materialsTab).toContainText('(4)')
  })

  test('course cards are visible in the default Courses tab', async ({ page }) => {
    await expect(page.getByText('Sales Fundamentals')).toBeVisible()
    await expect(page.getByText('Enterprise Closing')).toBeVisible()
  })
})

test.describe('Sales Materials Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-sales-browse?tab=materials')
    await expect(page.getByTestId('test-sales-browse')).toBeVisible({
      timeout: 10000,
    })
  })

  test('clicking Materials tab shows materials library', async ({ page }) => {
    await expect(page.getByTestId('materials-library')).toBeVisible()
  })

  test('Materials tab is active', async ({ page }) => {
    const materialsTab = page.getByTestId('materials-tab')
    await expect(materialsTab).toHaveAttribute('aria-selected', 'true')
  })

  test('materials library renders material cards', async ({ page }) => {
    const cards = page.getByTestId('material-card')
    await expect(cards).toHaveCount(4)
  })

  test('material cards display titles', async ({ page }) => {
    await expect(page.getByText('Enterprise Battle Card')).toBeVisible()
    await expect(page.getByText('Healthcare Case Study')).toBeVisible()
    await expect(page.getByText('Product Overview Deck')).toBeVisible()
    await expect(page.getByText('ROI Calculator Spreadsheet')).toBeVisible()
  })

  test('material cards display type badges', async ({ page }) => {
    // Case Study type badge on the healthcare card (exact match to avoid matching the title)
    const caseStudyMaterial = page.locator(
      '[data-testid="material-card"][data-material-slug="healthcare-case-study"]'
    )
    await expect(caseStudyMaterial.getByText('Case Study', { exact: true })).toBeVisible()

    // Slide Deck type badge
    const slideDeckMaterial = page.locator(
      '[data-testid="material-card"][data-material-slug="product-overview-deck"]'
    )
    await expect(slideDeckMaterial.getByText('Slide Deck', { exact: true })).toBeVisible()

    // ROI Calculator type badge
    const roiMaterial = page.locator(
      '[data-testid="material-card"][data-material-slug="roi-calculator-spreadsheet"]'
    )
    await expect(roiMaterial.getByText('ROI Calculator', { exact: true })).toBeVisible()
  })

  test('material cards display descriptions', async ({ page }) => {
    await expect(
      page.getByText('Competitive positioning against Acme Corp for enterprise deals.')
    ).toBeVisible()
    await expect(
      page.getByText('How Acme Health reduced costs by 40% with our platform.')
    ).toBeVisible()
  })

  test('material cards display category badges', async ({ page }) => {
    // Healthcare card has a "Healthcare" category badge that doesn't collide with its title
    const healthcareCard = page.locator(
      '[data-testid="material-card"][data-material-slug="healthcare-case-study"]'
    )
    await expect(healthcareCard.getByText('Healthcare', { exact: true })).toBeVisible()

    // General category on product overview card
    const generalCard = page.locator(
      '[data-testid="material-card"][data-material-slug="product-overview-deck"]'
    )
    await expect(generalCard.getByText('General')).toBeVisible()
  })

  test('material cards link to correct detail URL', async ({ page }) => {
    const cards = page.getByTestId('material-card')
    const firstCard = cards.filter({ hasText: 'Enterprise Battle Card' })
    const link = firstCard.locator('a')
    await expect(link).toHaveAttribute('href', '/sales/materials/enterprise-battle-card')
  })

  test('shareable materials display share button', async ({ page }) => {
    // Enterprise Battle Card is shareable
    const shareableCard = page.locator(
      '[data-testid="material-card"][data-material-slug="enterprise-battle-card"]'
    )
    await expect(shareableCard.getByTestId('share-button')).toBeVisible()
  })

  test('non-shareable materials do not display share button', async ({ page }) => {
    // Product Overview Deck is not shareable
    const nonShareableCard = page.locator(
      '[data-testid="material-card"][data-material-slug="product-overview-deck"]'
    )
    await expect(nonShareableCard.getByTestId('share-button')).not.toBeVisible()
  })

  test('share button opens share dialog', async ({ page }) => {
    const shareableCard = page.locator(
      '[data-testid="material-card"][data-material-slug="enterprise-battle-card"]'
    )
    await shareableCard.getByTestId('share-button').click()

    // Dialog should appear
    await expect(page.getByText('Share with Prospect')).toBeVisible()
    await expect(page.getByTestId('share-url-input')).toBeVisible()
    await expect(page.getByTestId('copy-share-link')).toBeVisible()
  })

  test('share dialog shows correct share URL', async ({ page }) => {
    const shareableCard = page.locator(
      '[data-testid="material-card"][data-material-slug="enterprise-battle-card"]'
    )
    await shareableCard.getByTestId('share-button').click()

    const shareInput = page.getByTestId('share-url-input')
    await expect(shareInput).toHaveValue(/\/share\/materials\/abc123-share-token$/)
  })

  test('share dialog mentions the material title', async ({ page }) => {
    const shareableCard = page.locator(
      '[data-testid="material-card"][data-material-slug="enterprise-battle-card"]'
    )
    await shareableCard.getByTestId('share-button').click()

    // The dialog description mentions the material title
    await expect(
      page.getByText(/Enterprise Battle Card/)
    ).toHaveCount(2) // Once in card title, once in dialog description
  })
})

test.describe('Sales Materials Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-sales-browse?tab=materials')
    await expect(page.getByTestId('materials-library')).toBeVisible({
      timeout: 10000,
    })
  })

  test('filter toolbar is visible on materials tab', async ({ page }) => {
    await expect(page.getByTestId('material-filters')).toBeVisible()
  })

  test('search input is visible', async ({ page }) => {
    const search = page.getByTestId('materials-search')
    await expect(search).toBeVisible()
    await expect(search).toHaveAttribute('placeholder', 'Search materials...')
  })

  test('type filter dropdown is visible with "All Types" default', async ({ page }) => {
    const typeFilter = page.getByTestId('type-filter')
    await expect(typeFilter).toBeVisible()
    // Default should be "All Types"
    await expect(typeFilter).toHaveValue('')
  })

  test('type filter contains all material types', async ({ page }) => {
    const typeFilter = page.getByTestId('type-filter')
    const options = typeFilter.locator('option')

    // "All Types" + 9 material types
    await expect(options).toHaveCount(10)
  })

  test('category filter dropdown is visible', async ({ page }) => {
    const categoryFilter = page.getByTestId('category-filter')
    await expect(categoryFilter).toBeVisible()
    await expect(categoryFilter).toHaveValue('')
  })

  test('category filter contains mock categories', async ({ page }) => {
    const categoryFilter = page.getByTestId('category-filter')
    const options = categoryFilter.locator('option')

    // "All Categories" + 3 categories
    await expect(options).toHaveCount(4)
  })

  test('search input accepts text', async ({ page }) => {
    const search = page.getByTestId('materials-search')
    await search.fill('battle card')
    await expect(search).toHaveValue('battle card')
  })

  test('type filter can be changed and updates URL', async ({ page }) => {
    const typeFilter = page.getByTestId('type-filter')
    await typeFilter.selectOption('battle_card')

    // The filter triggers a URL update with the type param
    await page.waitForURL(/type=battle_card/, { timeout: 5000 })
  })

  test('category filter can be changed and updates URL', async ({ page }) => {
    const categoryFilter = page.getByTestId('category-filter')
    await categoryFilter.selectOption('Enterprise')

    // The filter triggers a URL update with the category param
    await page.waitForURL(/category=Enterprise/, { timeout: 5000 })
  })
})

test.describe('Sales Materials Tab Switch', () => {
  test('clicking Materials tab triggers navigation to materials tab', async ({ page }) => {
    await page.goto('/test-sales-browse')
    await expect(page.getByTestId('test-sales-browse')).toBeVisible({
      timeout: 10000,
    })

    // Courses should be active initially
    await expect(page.getByTestId('courses-tab')).toHaveAttribute('aria-selected', 'true')

    // Click Materials tab — the SalesTabs component navigates via router.replace
    await page.getByTestId('materials-tab').click()

    // URL should update to include tab=materials
    await page.waitForURL(/tab=materials/, { timeout: 5000 })
  })

  test('clicking Courses tab triggers navigation to courses tab', async ({ page }) => {
    await page.goto('/test-sales-browse?tab=materials')
    await expect(page.getByTestId('materials-library')).toBeVisible({
      timeout: 10000,
    })

    // Materials tab should be active initially
    await expect(page.getByTestId('materials-tab')).toHaveAttribute('aria-selected', 'true')

    // Click Courses tab
    await page.getByTestId('courses-tab').click()

    // URL should update to include tab=courses
    await page.waitForURL(/tab=courses/, { timeout: 5000 })
  })
})
