import { test, expect } from '@playwright/test'

test.describe('Docs Site — Navigation', () => {
  test('intro page loads at root', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/AAVA/)
    await expect(page.locator('h1')).toContainText('Welcome to AAVA')
  })

  test('Getting Started section loads', async ({ page }) => {
    await page.goto('/getting-started/what-is-aava')
    await expect(page.locator('h1')).toContainText('What is AAVA')
  })

  test('Methodology section loads', async ({ page }) => {
    await page.goto('/methodology/goals-and-okrs/overview')
    await expect(page.locator('h1')).toContainText('Goals & OKRs')
  })

  test('Certifications section loads', async ({ page }) => {
    await page.goto('/certifications/overview')
    await expect(page.locator('h1')).toContainText('Certifications')
  })

  test('methodology sub-pages load without 404', async ({ page }) => {
    const pages = [
      '/methodology/goals-and-okrs/goal-extraction',
      '/methodology/research/overview',
      '/methodology/ideation/overview',
      '/methodology/roadmapping/overview',
      '/methodology/sprint-planning/overview',
      '/methodology/execution/overview',
      '/methodology/retrospective/overview',
    ]

    for (const path of pages) {
      const response = await page.goto(path)
      expect(response?.status()).toBe(200)
    }
  })

  test('certification tier pages load', async ({ page }) => {
    const pages = [
      '/certifications/foundations',
      '/certifications/practitioner',
      '/certifications/specialist',
      '/certifications/domain-certifications',
    ]

    for (const path of pages) {
      const response = await page.goto(path)
      expect(response?.status()).toBe(200)
    }
  })
})

test.describe('Docs Site — Sidebar', () => {
  test('sidebar shows main sections', async ({ page }) => {
    await page.goto('/')
    const sidebar = page.locator('.theme-doc-sidebar-container')
    await expect(sidebar).toBeVisible()
    await expect(sidebar).toContainText('Getting Started')
    await expect(sidebar).toContainText('AAVA Methodology')
    await expect(sidebar).toContainText('Certifications')
  })
})

test.describe('Docs Site — Content', () => {
  test('intro page has quick links', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'What is AAVA?', exact: true })).toBeVisible()
  })

  test('what-is-aava page has lifecycle table', async ({ page }) => {
    await page.goto('/getting-started/what-is-aava')
    await expect(page.locator('table')).toBeVisible()
    await expect(page.locator('table')).toContainText('Goals & OKRs')
    await expect(page.locator('table')).toContainText('Sprint Planning')
  })

  test('certification overview has tier table', async ({ page }) => {
    await page.goto('/getting-started/certification-overview')
    await expect(page.locator('table')).toBeVisible()
    await expect(page.locator('table')).toContainText('Foundations')
    await expect(page.locator('table')).toContainText('Practitioner')
    await expect(page.locator('table')).toContainText('Specialist')
  })
})

test.describe('Docs Site — Embed Component', () => {
  test('embedding guide page loads', async ({ page }) => {
    await page.goto('/guides/embedding-content')
    await expect(page.locator('h1')).toContainText('Embed')
  })
})

test.describe('Docs Site — Dark Mode', () => {
  test('loads in dark mode by default', async ({ page }) => {
    await page.goto('/')
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'dark')
  })
})

test.describe('Docs Site — Navbar', () => {
  test('navbar shows AAVA Docs title', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.navbar__title')).toContainText('AAVA Docs')
  })

  test('navbar has Throughput link', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('a[href="https://throughput.aava.ai"]')).toBeVisible()
  })
})
