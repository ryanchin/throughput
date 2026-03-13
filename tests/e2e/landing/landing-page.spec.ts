import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-landing')
  })

  // Section rendering
  test('renders navigation with logo and CTAs', async ({ page }) => {
    const nav = page.locator('[data-testid="landing-nav"]')
    await expect(nav).toBeVisible()
    await expect(nav.getByText('AAVA')).toBeVisible()
    await expect(page.locator('[data-testid="nav-login"]')).toBeVisible()
    await expect(page.locator('[data-testid="nav-get-certified"]')).toBeVisible()
  })

  test('renders hero section with headline and CTAs', async ({ page }) => {
    const hero = page.locator('[data-testid="hero-section"]')
    await expect(hero).toBeVisible()
    await expect(hero.getByText('PM mastery, verified.')).toBeVisible()
    await expect(page.locator('[data-testid="cta-get-certified"]')).toBeVisible()
    await expect(page.locator('[data-testid="cta-explore"]')).toBeVisible()
  })

  test('renders trust strip with stats', async ({ page }) => {
    const strip = page.locator('[data-testid="trust-strip"]')
    await expect(strip).toBeVisible()
    await expect(strip.getByText('Built on the AAVA Product Methodology')).toBeVisible()
    await expect(strip.getByText('3 certification tracks')).toBeVisible()
    await expect(strip.getByText('12 practitioners certified')).toBeVisible()
  })

  test('renders what you learn section with 3 tier cards', async ({ page }) => {
    const section = page.locator('[data-testid="what-you-learn"]')
    await expect(section).toBeVisible()
    await expect(section.getByText("What you'll learn")).toBeVisible()
    await expect(section.getByRole('heading', { name: 'Foundations' })).toBeVisible()
    await expect(section.getByRole('heading', { name: 'Practitioner' })).toBeVisible()
    await expect(section.getByRole('heading', { name: 'Specialist' })).toBeVisible()
  })

  test('renders how it works section with 3 steps', async ({ page }) => {
    const section = page.locator('[data-testid="how-it-works"]')
    await expect(section).toBeVisible()
    await expect(section.getByText('How it works')).toBeVisible()
    await expect(section.getByText('Study')).toBeVisible()
    await expect(section.getByText('Examine')).toBeVisible()
    await expect(section.getByText('Certify')).toBeVisible()
  })

  test('renders methodology preview with 6 stages', async ({ page }) => {
    const section = page.locator('[data-testid="methodology-preview"]')
    await expect(section).toBeVisible()
    await expect(section.getByText('The AAVA PM Methodology')).toBeVisible()
    await expect(section.getByText('Goals')).toBeVisible()
    await expect(section.getByText('Research')).toBeVisible()
    await expect(section.getByText('Development')).toBeVisible()
  })

  test('renders for teams section with bullet points', async ({ page }) => {
    const section = page.locator('[data-testid="for-teams"]')
    await expect(section).toBeVisible()
    await expect(section.getByText('Training your PM team?')).toBeVisible()
    await expect(section.getByText('Course completion tracking & scoring')).toBeVisible()
    await expect(section.getByText('Role-based access control')).toBeVisible()
    await expect(section.getByText('AI-graded assessments')).toBeVisible()
  })

  test('renders footer with nav links and copyright', async ({ page }) => {
    const footer = page.locator('[data-testid="footer"]')
    await expect(footer).toBeVisible()
    await expect(footer.getByText('Certifications')).toBeVisible()
    await expect(footer.getByText('Methodology')).toBeVisible()
    await expect(footer.getByText('Knowledge')).toBeVisible()
    await expect(footer.getByText('Login')).toBeVisible()
    await expect(footer.getByText('2026 AAVA Product Studio')).toBeVisible()
  })

  // Navigation links
  test('Get Certified CTA links to /certifications', async ({ page }) => {
    const cta = page.locator('[data-testid="cta-get-certified"]')
    await expect(cta).toHaveAttribute('href', '/certifications')
  })

  test('Explore the Methodology CTA links to /docs', async ({ page }) => {
    const cta = page.locator('[data-testid="cta-explore"]')
    await expect(cta).toHaveAttribute('href', '/docs')
  })

  test('Login nav link navigates to /login', async ({ page }) => {
    const login = page.locator('[data-testid="nav-login"]')
    await expect(login).toHaveAttribute('href', '/login')
  })

  // Mobile responsive
  test('page is mobile responsive at 375px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/test-landing')

    // All sections should still be visible
    await expect(page.locator('[data-testid="landing-nav"]')).toBeVisible()
    await expect(page.locator('[data-testid="hero-section"]')).toBeVisible()
    await expect(page.locator('[data-testid="trust-strip"]')).toBeVisible()
    await expect(page.locator('[data-testid="what-you-learn"]')).toBeVisible()
    await expect(page.locator('[data-testid="how-it-works"]')).toBeVisible()
    await expect(page.locator('[data-testid="methodology-preview"]')).toBeVisible()
    await expect(page.locator('[data-testid="for-teams"]')).toBeVisible()
    await expect(page.locator('[data-testid="footer"]')).toBeVisible()
  })

  test('for teams section shows course progress mockup', async ({ page }) => {
    const section = page.locator('[data-testid="for-teams"]')
    await expect(section.getByText('Sprint Planning Fundamentals')).toBeVisible()
    await expect(section.getByText('75%')).toBeVisible()
  })
})
