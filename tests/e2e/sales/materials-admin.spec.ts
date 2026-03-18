import { test, expect } from '@playwright/test'

test.describe('Admin Sales Materials List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-admin-sales-materials')
    await expect(page.getByTestId('test-admin-sales-materials')).toBeVisible({
      timeout: 10000,
    })
  })

  test('page renders heading and description', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Sales Materials', level: 1 })
    ).toBeVisible()
    await expect(
      page.getByText('Manage prospect-facing collateral and resources.')
    ).toBeVisible()
  })

  test('New Material button is visible', async ({ page }) => {
    await expect(page.getByTestId('new-material-button')).toBeVisible()
    await expect(page.getByTestId('new-material-button')).toContainText('New Material')
  })

  test('New Material button links to the create page', async ({ page }) => {
    await expect(page.getByTestId('new-material-button')).toHaveAttribute(
      'href',
      '/admin/sales-materials/new'
    )
  })

  test('materials table is visible with rows', async ({ page }) => {
    const table = page.getByTestId('materials-table')
    await expect(table).toBeVisible()
  })

  test('materials table displays correct column headers', async ({ page }) => {
    const table = page.getByTestId('materials-table')
    await expect(table.getByText('Title')).toBeVisible()
    await expect(table.getByText('Type')).toBeVisible()
    await expect(table.getByText('Category')).toBeVisible()
    await expect(table.getByText('Status')).toBeVisible()
    await expect(table.getByText('Shareable')).toBeVisible()
    await expect(table.getByText('Updated')).toBeVisible()
    await expect(table.getByText('Actions')).toBeVisible()
  })

  test('material rows are rendered with correct slugs', async ({ page }) => {
    await expect(page.getByTestId('material-row-enterprise-battle-card')).toBeVisible()
    await expect(page.getByTestId('material-row-healthcare-case-study')).toBeVisible()
    await expect(page.getByTestId('material-row-product-overview-deck')).toBeVisible()
  })

  test('material rows display titles', async ({ page }) => {
    const row1 = page.getByTestId('material-row-enterprise-battle-card')
    await expect(row1).toContainText('Enterprise Battle Card')

    const row2 = page.getByTestId('material-row-healthcare-case-study')
    await expect(row2).toContainText('Healthcare Case Study')

    const row3 = page.getByTestId('material-row-product-overview-deck')
    await expect(row3).toContainText('Product Overview Deck')
  })

  test('material rows display file names when present', async ({ page }) => {
    const row1 = page.getByTestId('material-row-enterprise-battle-card')
    await expect(row1).toContainText('enterprise-battle-card.pdf')

    // Product Overview Deck has no file_name
    const row3 = page.getByTestId('material-row-product-overview-deck')
    await expect(row3).not.toContainText('.pdf')
    await expect(row3).not.toContainText('.pptx')
  })

  test('material rows display type badges', async ({ page }) => {
    const row1 = page.getByTestId('material-row-enterprise-battle-card')
    await expect(row1).toContainText('Battle Card')

    const row2 = page.getByTestId('material-row-healthcare-case-study')
    await expect(row2).toContainText('Case Study')

    const row3 = page.getByTestId('material-row-product-overview-deck')
    await expect(row3).toContainText('Slide Deck')
  })

  test('material rows display category or dash', async ({ page }) => {
    const row1 = page.getByTestId('material-row-enterprise-battle-card')
    await expect(row1).toContainText('Enterprise')

    const row2 = page.getByTestId('material-row-healthcare-case-study')
    await expect(row2).toContainText('Healthcare')

    // Product Overview Deck has null category, should show em dash
    const row3 = page.getByTestId('material-row-product-overview-deck')
    await expect(row3).toContainText('\u2014')
  })

  test('material rows display status badges', async ({ page }) => {
    const publishedRow = page.getByTestId('material-row-enterprise-battle-card')
    await expect(publishedRow.getByTestId('status-badge-published')).toBeVisible()

    const draftRow = page.getByTestId('material-row-healthcare-case-study')
    await expect(draftRow.getByTestId('status-badge-draft')).toBeVisible()
  })

  test('material rows display shareable indicator', async ({ page }) => {
    const shareableRow = page.getByTestId('material-row-enterprise-battle-card')
    await expect(shareableRow).toContainText('\u2713')

    const notShareableRow = page.getByTestId('material-row-healthcare-case-study')
    await expect(notShareableRow).toContainText('\u2014')
  })

  test('material rows have Edit and Archive action links', async ({ page }) => {
    await expect(page.getByTestId('edit-material-enterprise-battle-card')).toBeVisible()
    await expect(page.getByTestId('edit-material-enterprise-battle-card')).toContainText('Edit')
    await expect(page.getByTestId('edit-material-enterprise-battle-card')).toHaveAttribute(
      'href',
      '/admin/sales-materials/mat-1/edit'
    )

    await expect(page.getByTestId('archive-material-enterprise-battle-card')).toBeVisible()
    await expect(page.getByTestId('archive-material-enterprise-battle-card')).toContainText('Archive')
  })
})

test.describe('Admin Sales Materials Empty State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-admin-sales-materials')
    await expect(page.getByTestId('test-admin-sales-materials')).toBeVisible({
      timeout: 10000,
    })
    await page.getByTestId('view-empty').click()
  })

  test('empty state is displayed when no materials exist', async ({ page }) => {
    await expect(page.getByTestId('materials-empty-state')).toBeVisible()
  })

  test('empty state shows appropriate messaging', async ({ page }) => {
    await expect(page.getByText('No materials yet')).toBeVisible()
    await expect(
      page.getByText('Create your first sales material to get started.')
    ).toBeVisible()
  })

  test('empty state has a Create Material button', async ({ page }) => {
    const createButton = page.getByTestId('empty-create-button')
    await expect(createButton).toBeVisible()
    await expect(createButton).toContainText('Create Material')
    await expect(createButton).toHaveAttribute('href', '/admin/sales-materials/new')
  })

  test('New Material button in header is still visible in empty state', async ({ page }) => {
    await expect(page.getByTestId('new-material-button')).toBeVisible()
  })
})

test.describe('Admin Sales Materials New Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-admin-sales-materials')
    await expect(page.getByTestId('test-admin-sales-materials')).toBeVisible({
      timeout: 10000,
    })
    await page.getByTestId('view-new').click()
    await expect(
      page.getByRole('heading', { name: 'New Material', level: 1 })
    ).toBeVisible({ timeout: 5000 })
  })

  test('new material page renders heading and description', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'New Material', level: 1 })
    ).toBeVisible()
    await expect(
      page.getByText('Create a new sales enablement resource.')
    ).toBeVisible()
  })

  test('material form is visible', async ({ page }) => {
    await expect(page.getByTestId('material-form')).toBeVisible()
  })

  test('form renders all required fields', async ({ page }) => {
    await expect(page.getByTestId('title-input')).toBeVisible()
    await expect(page.getByTestId('slug-input')).toBeVisible()
    await expect(page.getByTestId('description-input')).toBeVisible()
    await expect(page.getByTestId('type-select')).toBeVisible()
    await expect(page.getByTestId('category-input')).toBeVisible()
    await expect(page.getByTestId('tags-input')).toBeVisible()
    await expect(page.getByTestId('file-input')).toBeVisible()
    await expect(page.getByTestId('shareable-toggle')).toBeVisible()
    await expect(page.getByTestId('status-toggle')).toBeVisible()
    await expect(page.getByTestId('save-button')).toBeVisible()
  })

  test('title input accepts text', async ({ page }) => {
    const titleInput = page.getByTestId('title-input')
    await titleInput.fill('New Battle Card')
    await expect(titleInput).toHaveValue('New Battle Card')
  })

  test('slug auto-generates from title', async ({ page }) => {
    const titleInput = page.getByTestId('title-input')
    const slugInput = page.getByTestId('slug-input')

    await titleInput.fill('My New Battle Card')
    await expect(slugInput).toHaveValue('my-new-battle-card', { timeout: 3000 })
  })

  test('slug updates when title changes', async ({ page }) => {
    const titleInput = page.getByTestId('title-input')
    const slugInput = page.getByTestId('slug-input')

    await titleInput.fill('First Title')
    await expect(slugInput).toHaveValue('first-title', { timeout: 3000 })

    await titleInput.fill('Second Title')
    await expect(slugInput).toHaveValue('second-title', { timeout: 3000 })
  })

  test('manually editing slug stops auto-generation', async ({ page }) => {
    const titleInput = page.getByTestId('title-input')
    const slugInput = page.getByTestId('slug-input')

    await titleInput.fill('Auto Slug Test')
    await expect(slugInput).toHaveValue('auto-slug-test', { timeout: 3000 })

    // Manually edit the slug
    await slugInput.clear()
    await slugInput.fill('custom-slug')

    // Change title -- slug should NOT update
    await titleInput.fill('Changed Title')
    await page.waitForTimeout(500)
    await expect(slugInput).toHaveValue('custom-slug')
  })

  test('description textarea accepts text', async ({ page }) => {
    const descInput = page.getByTestId('description-input')
    await descInput.fill('A detailed description of the material.')
    await expect(descInput).toHaveValue('A detailed description of the material.')
  })

  test('type selector defaults to "other"', async ({ page }) => {
    const typeSelect = page.getByTestId('type-select')
    await expect(typeSelect).toHaveValue('other')
  })

  test('type selector can be changed to battle_card', async ({ page }) => {
    const typeSelect = page.getByTestId('type-select')
    await typeSelect.selectOption('battle_card')
    await expect(typeSelect).toHaveValue('battle_card')
  })

  test('type selector contains all material types', async ({ page }) => {
    const typeSelect = page.getByTestId('type-select')
    const options = typeSelect.locator('option')
    // 9 material types total
    await expect(options).toHaveCount(9)
  })

  test('category input accepts text', async ({ page }) => {
    const categoryInput = page.getByTestId('category-input')
    await categoryInput.fill('Enterprise')
    await expect(categoryInput).toHaveValue('Enterprise')
  })

  test('tags input accepts comma-separated values', async ({ page }) => {
    const tagsInput = page.getByTestId('tags-input')
    await tagsInput.fill('enterprise, healthcare, q1-2026')
    await expect(tagsInput).toHaveValue('enterprise, healthcare, q1-2026')
  })

  test('shareable toggle is unchecked by default', async ({ page }) => {
    const toggle = page.getByTestId('shareable-toggle')
    await expect(toggle).not.toBeChecked()
  })

  test('shareable toggle can be checked', async ({ page }) => {
    const toggle = page.getByTestId('shareable-toggle')
    await toggle.check()
    await expect(toggle).toBeChecked()
  })

  test('status toggle is unchecked by default (draft)', async ({ page }) => {
    const toggle = page.getByTestId('status-toggle')
    await expect(toggle).not.toBeChecked()
  })

  test('status toggle can be checked (published)', async ({ page }) => {
    const toggle = page.getByTestId('status-toggle')
    await toggle.check()
    await expect(toggle).toBeChecked()
  })

  test('save button shows "Create Material" for new material', async ({ page }) => {
    await expect(page.getByTestId('save-button')).toContainText('Create Material')
  })

  test('cancel button is visible and navigable', async ({ page }) => {
    const cancelButton = page.locator('button[type="button"]', { hasText: 'Cancel' })
    await expect(cancelButton).toBeVisible()
  })

  test('form validates required title on submit', async ({ page }) => {
    // Ensure title is empty and slug is empty
    const titleInput = page.getByTestId('title-input')
    await expect(titleInput).toHaveValue('')

    // Click save button - HTML5 validation should prevent submission
    await page.getByTestId('save-button').click()

    // The title input has `required` attribute, so the browser will show validation
    // We check that the form was NOT submitted (no error message from API)
    // and the title input is still focused/invalid
    const isValid = await titleInput.evaluate((el: HTMLInputElement) => el.validity.valid)
    expect(isValid).toBe(false)
  })

  test('form validates required slug on submit', async ({ page }) => {
    // Fill title but clear slug
    await page.getByTestId('title-input').fill('Test Material')
    await expect(page.getByTestId('slug-input')).toHaveValue('test-material', {
      timeout: 3000,
    })

    // Clear the slug
    await page.getByTestId('slug-input').clear()

    // Click save
    await page.getByTestId('save-button').click()

    const slugInput = page.getByTestId('slug-input')
    const isValid = await slugInput.evaluate((el: HTMLInputElement) => el.validity.valid)
    expect(isValid).toBe(false)
  })

  test('file input accepts file selection', async ({ page }) => {
    const fileInput = page.getByTestId('file-input')
    await expect(fileInput).toBeVisible()
    await expect(fileInput).toHaveAttribute(
      'accept',
      '.pdf,.pptx,.docx,.xlsx,.png,.jpg,.jpeg'
    )
  })

  test('filling all fields does not show errors', async ({ page }) => {
    await page.getByTestId('title-input').fill('Complete Material')
    await expect(page.getByTestId('slug-input')).toHaveValue('complete-material', {
      timeout: 3000,
    })
    await page.getByTestId('description-input').fill('A complete test material.')
    await page.getByTestId('type-select').selectOption('battle_card')
    await page.getByTestId('category-input').fill('Enterprise')
    await page.getByTestId('tags-input').fill('tag1, tag2')

    // No error should be visible
    await expect(page.getByTestId('form-error')).not.toBeVisible()
  })
})
