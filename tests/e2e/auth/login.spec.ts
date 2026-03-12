import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('login page loads', async ({ page }) => {
    const response = await page.goto('/login')
    expect(response?.status()).toBe(200)
    await expect(page.locator('text=AAVA')).toBeVisible()
    await expect(page.locator('text=Sign in to Throughput')).toBeVisible()
  })

  test('login form has email and password fields', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('can switch between password and magic link modes', async ({ page }) => {
    await page.goto('/login')

    // Should start in password mode
    await expect(page.locator('input[type="password"]')).toBeVisible()

    // Switch to magic link
    await page.click('button:has-text("Magic Link")')
    await expect(page.locator('input[type="password"]')).not.toBeVisible()
    await expect(page.locator('button[type="submit"]')).toContainText('Send Magic Link')

    // Switch back
    await page.click('button:has-text("Password")')
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', 'invalid@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show an error (exact message depends on Supabase config)
    // Without a real Supabase instance, the form will show a connection error
    await expect(page.locator('p.text-destructive')).toBeVisible({ timeout: 10000 })
  })

  test('redirects unauthenticated users to login from protected routes', async ({ page }) => {
    await page.goto('/training')
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/)
  })

  test('redirects unauthenticated users to login from admin routes', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login/)
  })
})
