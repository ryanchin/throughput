import { test, expect } from '@playwright/test'

test.describe('Certification Public Browse', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-certifications')
    await page.waitForSelector('[data-testid="tier-card-aava-foundations"]')
  })

  test('renders tiered certification cards', async ({ page }) => {
    await expect(page.getByTestId('tier-card-aava-foundations')).toBeVisible()
    await expect(page.getByTestId('tier-card-aava-practitioner')).toBeVisible()
    await expect(page.getByTestId('tier-card-aava-specialist')).toBeVisible()
  })

  test('shows earned badge on completed certification', async ({ page }) => {
    const card = page.getByTestId('tier-card-aava-foundations')
    await expect(card.getByTestId('earned-badge')).toBeVisible()
    await expect(card.getByTestId('earned-badge')).toContainText('Certified')
  })

  test('does not show earned badge on incomplete certifications', async ({ page }) => {
    const practitioner = page.getByTestId('tier-card-aava-practitioner')
    await expect(practitioner.getByTestId('earned-badge')).not.toBeVisible()

    const specialist = page.getByTestId('tier-card-aava-specialist')
    await expect(specialist.getByTestId('earned-badge')).not.toBeVisible()
  })

  test('shows tier badges with correct labels', async ({ page }) => {
    const foundations = page.getByTestId('tier-card-aava-foundations')
    await expect(foundations).toContainText('Foundations')

    const practitioner = page.getByTestId('tier-card-aava-practitioner')
    await expect(practitioner).toContainText('Practitioner')

    const specialist = page.getByTestId('tier-card-aava-specialist')
    await expect(specialist).toContainText('Specialist')
  })

  test('shows exam info on cards', async ({ page }) => {
    const card = page.getByTestId('tier-card-aava-foundations')
    await expect(card).toContainText('30 questions')
    await expect(card).toContainText('60 minutes')
    await expect(card).toContainText('80% to pass')
  })

  test('shows different exam durations per track', async ({ page }) => {
    const practitioner = page.getByTestId('tier-card-aava-practitioner')
    await expect(practitioner).toContainText('40 questions')
    await expect(practitioner).toContainText('90 minutes')

    const specialist = page.getByTestId('tier-card-aava-specialist')
    await expect(specialist).toContainText('50 questions')
    await expect(specialist).toContainText('120 minutes')
  })

  test('shows prerequisite met status', async ({ page }) => {
    const practitioner = page.getByTestId('tier-card-aava-practitioner')
    const prereq = practitioner.getByTestId('prerequisite-status')
    await expect(prereq).toContainText('Prerequisite met')
    await expect(prereq).toContainText('AAVA Foundations')
  })

  test('shows prerequisite not met with lock', async ({ page }) => {
    const specialist = page.getByTestId('tier-card-aava-specialist')
    const prereq = specialist.getByTestId('prerequisite-status')
    await expect(prereq).toContainText('Complete')
    await expect(prereq).toContainText('AAVA Practitioner')
    await expect(prereq).toContainText('first')
  })

  test('no prerequisite indicator on Foundations (no prerequisite)', async ({ page }) => {
    const foundations = page.getByTestId('tier-card-aava-foundations')
    await expect(foundations.getByTestId('prerequisite-status')).not.toBeVisible()
  })

  test('shows domain certification cards', async ({ page }) => {
    const domainCard = page.getByTestId('tier-card-sprint-planning')
    await expect(domainCard).toBeVisible()
    await expect(domainCard).toContainText('Sprint Planning Expert')
  })

  test('domain card shows domain tier badge', async ({ page }) => {
    const domainCard = page.getByTestId('tier-card-sprint-planning')
    await expect(domainCard).toContainText('Domain: sprint planning')
  })

  test('View Track buttons link to track pages', async ({ page }) => {
    const card = page.getByTestId('tier-card-aava-foundations')
    const link = card.getByRole('link', { name: /View Track/i })
    await expect(link).toHaveAttribute('href', '/certifications/aava-foundations')
  })

  test('all cards have View Track links with correct hrefs', async ({ page }) => {
    const practitioner = page.getByTestId('tier-card-aava-practitioner')
    await expect(practitioner.getByRole('link', { name: /View Track/i })).toHaveAttribute(
      'href',
      '/certifications/aava-practitioner'
    )

    const domain = page.getByTestId('tier-card-sprint-planning')
    await expect(domain.getByRole('link', { name: /View Track/i })).toHaveAttribute(
      'href',
      '/certifications/sprint-planning'
    )
  })

  test('displays description on cards', async ({ page }) => {
    const card = page.getByTestId('tier-card-aava-foundations')
    await expect(card).toContainText('Master the fundamentals')
  })

  test('displays section headings', async ({ page }) => {
    await expect(page.getByText('Certification Path')).toBeVisible()
    await expect(page.getByText('Domain Certifications')).toBeVisible()
  })

  test('prerequisite not met links to prerequisite track', async ({ page }) => {
    const specialist = page.getByTestId('tier-card-aava-specialist')
    const prereq = specialist.getByTestId('prerequisite-status')
    const link = prereq.getByRole('link', { name: 'AAVA Practitioner' })
    await expect(link).toHaveAttribute('href', '/certifications/aava-practitioner')
  })
})
