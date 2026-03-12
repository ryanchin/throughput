import { test, expect } from '@playwright/test'

test.describe('Block Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-editor')
    // Wait for the editor to render (it uses immediatelyRender: false)
    await expect(page.getByTestId('block-editor')).toBeVisible({ timeout: 10000 })
  })

  test('editor loads with placeholder text', async ({ page }) => {
    // The editor should render with the Tiptap contenteditable area
    const editor = page.locator('.tiptap')
    await expect(editor).toBeVisible()
  })

  test('can type text into the editor', async ({ page }) => {
    const editor = page.locator('.tiptap')
    await editor.click()
    await page.keyboard.type('Hello, Throughput!')
    await expect(editor).toContainText('Hello, Throughput!')
  })

  test('slash menu appears when typing /', async ({ page }) => {
    const editor = page.locator('.tiptap')
    await editor.click()
    await page.keyboard.type('/')

    // Slash menu should appear
    const slashMenu = page.getByTestId('slash-menu')
    await expect(slashMenu).toBeVisible({ timeout: 3000 })
  })

  test('slash menu shows block type options', async ({ page }) => {
    const editor = page.locator('.tiptap')
    await editor.click()
    await page.keyboard.type('/')

    const slashMenu = page.getByTestId('slash-menu')
    await expect(slashMenu).toBeVisible({ timeout: 3000 })

    // Should show standard block types
    await expect(slashMenu.getByText('Heading 1')).toBeVisible()
    await expect(slashMenu.getByText('Bullet List')).toBeVisible()
    await expect(slashMenu.getByText('Code Block')).toBeVisible()
    await expect(slashMenu.getByText('Embed')).toBeVisible()
  })

  test('selecting Heading 1 from slash menu creates a heading', async ({ page }) => {
    const editor = page.locator('.tiptap')
    await editor.click()
    await page.keyboard.type('/')

    const slashMenu = page.getByTestId('slash-menu')
    await expect(slashMenu).toBeVisible({ timeout: 3000 })

    // Click Heading 1
    await slashMenu.getByText('Heading 1').click()

    // Wait for slash menu to close and focus to return to editor
    await expect(slashMenu).not.toBeVisible()
    await editor.locator('h1').click()
    await page.keyboard.type('My Heading')

    // Verify the h1 contains the typed text
    const h1 = editor.locator('h1')
    await expect(h1).toContainText('My Heading')
  })

  test('slash menu closes on Escape', async ({ page }) => {
    const editor = page.locator('.tiptap')
    await editor.click()
    await page.keyboard.type('/')

    const slashMenu = page.getByTestId('slash-menu')
    await expect(slashMenu).toBeVisible({ timeout: 3000 })

    await page.keyboard.press('Escape')
    await expect(slashMenu).not.toBeVisible()
  })

  test('Paste Markdown button opens import modal', async ({ page }) => {
    const toolbar = page.getByText('Paste Markdown')
    await expect(toolbar).toBeVisible()
    await toolbar.click()

    // Modal should open
    const textarea = page.getByTestId('markdown-import-textarea')
    await expect(textarea).toBeVisible()
  })

  test('markdown import converts markdown to editor blocks', async ({ page }) => {
    // Open the markdown import modal
    await page.getByText('Paste Markdown').click()

    const textarea = page.getByTestId('markdown-import-textarea')
    await expect(textarea).toBeVisible()

    // Type markdown content
    await textarea.fill('# Hello World\n\nThis is a **paragraph**.\n\n- Item one\n- Item two')

    // Click Import
    await page.getByTestId('markdown-import-button').click()

    // Verify the content was imported into the editor
    const editor = page.locator('.tiptap')
    await expect(editor).toContainText('Hello World')
    await expect(editor).toContainText('This is a')
  })

  test('embed panel shows when triggered from slash menu', async ({ page }) => {
    const editor = page.locator('.tiptap')
    await editor.click()
    await page.keyboard.type('/')

    const slashMenu = page.getByTestId('slash-menu')
    await expect(slashMenu).toBeVisible({ timeout: 3000 })

    // Click Embed
    await slashMenu.getByText('Embed').click()

    // Embed panel should appear
    const embedPanel = page.getByTestId('embed-input-panel')
    await expect(embedPanel).toBeVisible()
  })

  test('embed panel inserts YouTube embed', async ({ page }) => {
    const editor = page.locator('.tiptap')
    await editor.click()
    await page.keyboard.type('/')

    const slashMenu = page.getByTestId('slash-menu')
    await expect(slashMenu).toBeVisible({ timeout: 3000 })
    await slashMenu.getByText('Embed').click()

    const embedInput = page.getByTestId('embed-url-input')
    await expect(embedInput).toBeVisible()

    // Enter a YouTube URL
    await embedInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    await page.getByTestId('embed-submit-button').click()

    // Verify an iframe was inserted with the correct src
    const iframe = editor.locator('iframe')
    await expect(iframe).toBeVisible({ timeout: 3000 })
    await expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  test('save status indicator shows Saving... and then Saved', async ({ page }) => {
    const editor = page.locator('.tiptap')
    await editor.click()
    await page.keyboard.type('Some content to trigger save')

    // Should show "Saving..." during debounce
    const saveStatus = page.getByTestId('save-status')
    await expect(saveStatus).toContainText('Saving...')

    // After debounce (2s), should show "Saved"
    await expect(saveStatus).toContainText('Saved', { timeout: 5000 })
  })

  test('preview toggle shows LessonViewer with content', async ({ page }) => {
    const editor = page.locator('.tiptap')
    await editor.click()
    await page.keyboard.type('Preview test content')

    // Wait for auto-save
    await expect(page.getByTestId('save-status')).toContainText('Saved', { timeout: 5000 })

    // Toggle to preview
    await page.getByTestId('toggle-preview').click()

    // Should show the lesson viewer
    const viewer = page.getByTestId('lesson-viewer')
    await expect(viewer).toBeVisible()
    await expect(viewer).toContainText('Preview test content')
  })
})
