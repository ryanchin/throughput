import { test, expect } from '@playwright/test'

test.describe('Certificate Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-certificate')
    await page.waitForSelector('[data-testid="certificate-page"]')
  })

  test('renders certificate card', async ({ page }) => {
    await expect(page.getByTestId('certificate-page')).toBeVisible()
  })

  test('shows recipient name', async ({ page }) => {
    await expect(page.getByTestId('cert-recipient')).toContainText('Jane Doe')
  })

  test('shows certification title', async ({ page }) => {
    await expect(page.getByTestId('cert-title')).toContainText(
      'AAVA Practitioner Certification'
    )
  })

  test('shows certificate number', async ({ page }) => {
    await expect(page.getByTestId('cert-number')).toContainText('AAVA-2026-000042')
  })

  test('shows verified status', async ({ page }) => {
    await expect(page.getByTestId('cert-verified')).toContainText('Verified')
  })

  test('shows issuer name', async ({ page }) => {
    await expect(page.getByTestId('certificate-page')).toContainText(
      'AAVA Product Studio'
    )
  })

  test('shows issue date', async ({ page }) => {
    await expect(page.getByTestId('certificate-page')).toContainText(
      'January 15, 2026'
    )
  })

  test('shows LinkedIn button', async ({ page }) => {
    await expect(page.getByTestId('linkedin-btn')).toBeVisible()
  })

  test('LinkedIn button has correct href', async ({ page }) => {
    const btn = page.getByTestId('linkedin-btn')
    const href = await btn.getAttribute('href')
    expect(href).toContain('linkedin.com/profile/add')
    expect(href).toContain('AAVA')
    expect(href).toContain('AAVA-2026-000042')
  })

  test('LinkedIn button contains Add to LinkedIn text', async ({ page }) => {
    await expect(page.getByTestId('linkedin-btn')).toContainText('Add to LinkedIn')
  })

  test('shows download button', async ({ page }) => {
    await expect(page.getByTestId('download-btn')).toBeVisible()
    await expect(page.getByTestId('download-btn')).toContainText('Download PDF')
  })

  test('shows share link button', async ({ page }) => {
    await expect(page.getByTestId('share-btn')).toBeVisible()
    await expect(page.getByTestId('share-btn')).toContainText('Share Link')
  })
})
