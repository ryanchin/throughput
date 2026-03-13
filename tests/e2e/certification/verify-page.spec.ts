import { test, expect } from '@playwright/test'

test.describe('Certificate Verification - Valid', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-verify-valid')
    await page.waitForSelector('[data-testid="verify-page"]')
  })

  test('renders verification page', async ({ page }) => {
    await expect(page.getByTestId('verify-page')).toBeVisible()
  })

  test('shows verified status text', async ({ page }) => {
    await expect(page.getByTestId('verify-valid')).toContainText(
      'Certificate Verified'
    )
  })

  test('shows valid indicator', async ({ page }) => {
    await expect(page.getByTestId('verify-valid')).toBeVisible()
  })

  test('shows recipient name', async ({ page }) => {
    await expect(page.getByTestId('verify-page')).toContainText('Jane Doe')
  })

  test('shows certification name', async ({ page }) => {
    await expect(page.getByTestId('verify-page')).toContainText('AAVA Practitioner')
  })

  test('shows certificate number', async ({ page }) => {
    await expect(page.getByTestId('verify-page')).toContainText('AAVA-2026-000042')
  })

  test('shows issue date', async ({ page }) => {
    await expect(page.getByTestId('verify-page')).toContainText('January 15, 2026')
  })

  test('shows authenticity message', async ({ page }) => {
    await expect(page.getByTestId('verify-page')).toContainText(
      'This certificate is authentic'
    )
  })
})

test.describe('Certificate Verification - Revoked', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-verify-revoked')
    await page.waitForSelector('[data-testid="verify-page"]')
  })

  test('renders verification page', async ({ page }) => {
    await expect(page.getByTestId('verify-page')).toBeVisible()
  })

  test('shows revoked status text', async ({ page }) => {
    await expect(page.getByTestId('verify-revoked')).toContainText(
      'Certificate Revoked'
    )
  })

  test('shows revoked indicator', async ({ page }) => {
    await expect(page.getByTestId('verify-revoked')).toBeVisible()
  })

  test('shows recipient name', async ({ page }) => {
    await expect(page.getByTestId('verify-page')).toContainText('Jane Doe')
  })

  test('shows certification name', async ({ page }) => {
    await expect(page.getByTestId('verify-page')).toContainText('AAVA Practitioner')
  })

  test('shows revocation date', async ({ page }) => {
    await expect(page.getByTestId('verify-page')).toContainText('March 10, 2026')
  })

  test('shows certificate number', async ({ page }) => {
    await expect(page.getByTestId('verify-page')).toContainText('AAVA-2026-000042')
  })

  test('does not show valid indicator', async ({ page }) => {
    await expect(page.getByTestId('verify-valid')).not.toBeVisible()
  })
})
