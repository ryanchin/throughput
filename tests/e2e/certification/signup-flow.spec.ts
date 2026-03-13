import { test, expect } from '@playwright/test'

test.describe('Certification Signup Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-cert-signup')
    await page.waitForSelector('[data-testid="cert-signup-form"]')
  })

  test('renders signup form with all fields', async ({ page }) => {
    await expect(page.getByTestId('cert-signup-form')).toBeVisible()
    await expect(page.getByTestId('signup-name')).toBeVisible()
    await expect(page.getByTestId('signup-email')).toBeVisible()
    await expect(page.getByTestId('signup-password')).toBeVisible()
    await expect(page.getByTestId('signup-submit')).toBeVisible()
  })

  test('displays correct field labels', async ({ page }) => {
    await expect(page.getByText('Full Name')).toBeVisible()
    await expect(page.getByText('Email')).toBeVisible()
    await expect(page.getByText('Password')).toBeVisible()
  })

  test('displays correct placeholder text', async ({ page }) => {
    await expect(page.getByTestId('signup-name')).toHaveAttribute('placeholder', 'Jane Doe')
    await expect(page.getByTestId('signup-email')).toHaveAttribute('placeholder', 'jane@example.com')
    await expect(page.getByTestId('signup-password')).toHaveAttribute('placeholder', 'Min. 8 characters')
  })

  test('submit button shows correct text', async ({ page }) => {
    await expect(page.getByTestId('signup-submit')).toHaveText('Create Account')
  })

  test('fills form fields correctly', async ({ page }) => {
    await page.getByTestId('signup-name').fill('Jane Doe')
    await page.getByTestId('signup-email').fill('jane@example.com')
    await page.getByTestId('signup-password').fill('securepassword123')

    await expect(page.getByTestId('signup-name')).toHaveValue('Jane Doe')
    await expect(page.getByTestId('signup-email')).toHaveValue('jane@example.com')
    await expect(page.getByTestId('signup-password')).toHaveValue('securepassword123')
  })

  test('password field is of type password', async ({ page }) => {
    await expect(page.getByTestId('signup-password')).toHaveAttribute('type', 'password')
  })

  test('email field is of type email', async ({ page }) => {
    await expect(page.getByTestId('signup-email')).toHaveAttribute('type', 'email')
  })

  test('all fields are required', async ({ page }) => {
    await expect(page.getByTestId('signup-name')).toHaveAttribute('required', '')
    await expect(page.getByTestId('signup-email')).toHaveAttribute('required', '')
    await expect(page.getByTestId('signup-password')).toHaveAttribute('required', '')
  })

  test('password has minimum length of 8', async ({ page }) => {
    await expect(page.getByTestId('signup-password')).toHaveAttribute('minlength', '8')
  })

  test('submit button is not disabled initially', async ({ page }) => {
    await expect(page.getByTestId('signup-submit')).not.toBeDisabled()
  })
})
