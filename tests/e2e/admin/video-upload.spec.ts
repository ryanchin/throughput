import { test, expect } from '@playwright/test'

test.describe('Video Upload Block', () => {
  test.describe('Dropzone State', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/test-video')
      await page.getByTestId('state-dropzone').click()
      await expect(page.getByTestId('block-editor')).toBeVisible({ timeout: 10000 })
    })

    test('renders a video block in the editor', async ({ page }) => {
      const videoBlock = page.locator('[data-testid^="video-block-"]')
      await expect(videoBlock).toBeVisible()
    })

    test('shows the upload dropzone with drag-and-drop text', async ({ page }) => {
      const dropzone = page.getByTestId('video-dropzone')
      await expect(dropzone).toBeVisible()
      await expect(dropzone).toContainText('Drag and drop a video file or click to browse')
    })

    test('shows supported file format info', async ({ page }) => {
      const dropzone = page.getByTestId('video-dropzone')
      await expect(dropzone).toContainText('MP4, MOV, WebM (max 10 GB)')
    })

    test('has a hidden file input for video selection', async ({ page }) => {
      const fileInput = page.getByTestId('video-file-input')
      await expect(fileInput).toBeAttached()
      await expect(fileInput).toHaveAttribute('type', 'file')
      await expect(fileInput).toHaveAttribute('accept', 'video/*')
    })
  })

  test.describe('Uploading State', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/test-video')
      await page.getByTestId('state-uploading').click()
      await expect(page.getByTestId('block-editor')).toBeVisible({ timeout: 10000 })
    })

    test('renders a video block with upload-specific test id', async ({ page }) => {
      await expect(page.getByTestId('video-block-test-upload-123')).toBeVisible()
    })

    test('shows uploading percentage text', async ({ page }) => {
      const videoBlock = page.getByTestId('video-block-test-upload-123')
      await expect(videoBlock).toContainText('Uploading... 65%')
    })

    test('displays the upload progress bar', async ({ page }) => {
      const progressBar = page.getByTestId('upload-progress-bar')
      await expect(progressBar).toBeVisible()
    })

    test('progress bar has correct width style', async ({ page }) => {
      const progressBar = page.getByTestId('upload-progress-bar')
      await expect(progressBar).toHaveCSS('width', /\d+/)
    })

    test('does not show dropzone while uploading', async ({ page }) => {
      await expect(page.getByTestId('video-dropzone')).not.toBeVisible()
    })

    test('does not show iframe player while uploading', async ({ page }) => {
      await expect(page.getByTestId('video-player-iframe')).not.toBeVisible()
    })
  })

  test.describe('Processing State', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/test-video')
      await page.getByTestId('state-processing').click()
      await expect(page.getByTestId('block-editor')).toBeVisible({ timeout: 10000 })
    })

    test('renders a video block with processing-specific test id', async ({ page }) => {
      await expect(page.getByTestId('video-block-test-processing-456')).toBeVisible()
    })

    test('shows the processing spinner element', async ({ page }) => {
      const processingEl = page.getByTestId('video-processing')
      await expect(processingEl).toBeVisible()
    })

    test('shows processing text', async ({ page }) => {
      const processingEl = page.getByTestId('video-processing')
      await expect(processingEl).toContainText('Processing video...')
    })

    test('shows video title input during processing', async ({ page }) => {
      const titleInput = page.getByTestId('video-title-input')
      await expect(titleInput).toBeVisible()
      await expect(titleInput).toHaveAttribute('placeholder', 'Video title...')
    })

    test('does not show iframe player while processing', async ({ page }) => {
      await expect(page.getByTestId('video-player-iframe')).not.toBeVisible()
    })

    test('does not show dropzone while processing', async ({ page }) => {
      await expect(page.getByTestId('video-dropzone')).not.toBeVisible()
    })
  })

  test.describe('Ready State', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/test-video')
      await page.getByTestId('state-ready').click()
      await expect(page.getByTestId('block-editor')).toBeVisible({ timeout: 10000 })
    })

    test('renders a video block with ready-specific test id', async ({ page }) => {
      await expect(page.getByTestId('video-block-test-ready-789')).toBeVisible()
    })

    test('shows the iframe player with correct src', async ({ page }) => {
      const iframe = page.getByTestId('video-player-iframe')
      await expect(iframe).toBeVisible()
      const src = await iframe.getAttribute('src')
      expect(src).toContain('iframe.mediadelivery.net/embed/')
      expect(src).toContain('test-ready-789')
    })

    test('iframe has correct dimensions', async ({ page }) => {
      const iframe = page.getByTestId('video-player-iframe')
      await expect(iframe).toHaveAttribute('width', '100%')
      await expect(iframe).toHaveAttribute('height', '360')
    })

    test('iframe has allowfullscreen attribute', async ({ page }) => {
      const iframe = page.getByTestId('video-player-iframe')
      await expect(iframe).toHaveAttribute('allowfullscreen', 'true')
    })

    test('shows video title input with pre-filled value', async ({ page }) => {
      const titleInput = page.getByTestId('video-title-input')
      await expect(titleInput).toBeVisible()
      await expect(titleInput).toHaveValue('Introduction to AAVA')
    })

    test('video title input is editable', async ({ page }) => {
      const titleInput = page.getByTestId('video-title-input')
      await titleInput.clear()
      await titleInput.fill('Updated Video Title')
      await expect(titleInput).toHaveValue('Updated Video Title')
    })

    test('does not show dropzone when ready', async ({ page }) => {
      await expect(page.getByTestId('video-dropzone')).not.toBeVisible()
    })

    test('does not show processing spinner when ready', async ({ page }) => {
      await expect(page.getByTestId('video-processing')).not.toBeVisible()
    })
  })

  test.describe('Error State', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/test-video')
      await page.getByTestId('state-error').click()
      await expect(page.getByTestId('block-editor')).toBeVisible({ timeout: 10000 })
    })

    test('renders a video block in error state', async ({ page }) => {
      const videoBlock = page.locator('[data-testid^="video-block-"]')
      await expect(videoBlock).toBeVisible()
    })

    test('shows error message text', async ({ page }) => {
      const videoBlock = page.locator('[data-testid^="video-block-"]')
      await expect(videoBlock).toContainText('Video upload failed. Try again.')
    })

    test('does not show dropzone in error state', async ({ page }) => {
      await expect(page.getByTestId('video-dropzone')).not.toBeVisible()
    })

    test('does not show iframe player in error state', async ({ page }) => {
      await expect(page.getByTestId('video-player-iframe')).not.toBeVisible()
    })

    test('does not show processing spinner in error state', async ({ page }) => {
      await expect(page.getByTestId('video-processing')).not.toBeVisible()
    })

    test('does not show title input in error state', async ({ page }) => {
      await expect(page.getByTestId('video-title-input')).not.toBeVisible()
    })
  })

  test.describe('State Switching', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/test-video')
      await expect(page.getByTestId('block-editor')).toBeVisible({ timeout: 10000 })
    })

    test('state switcher buttons are visible', async ({ page }) => {
      await expect(page.getByTestId('state-switcher')).toBeVisible()
      await expect(page.getByTestId('state-dropzone')).toBeVisible()
      await expect(page.getByTestId('state-uploading')).toBeVisible()
      await expect(page.getByTestId('state-processing')).toBeVisible()
      await expect(page.getByTestId('state-ready')).toBeVisible()
      await expect(page.getByTestId('state-error')).toBeVisible()
    })

    test('active state label updates when switching', async ({ page }) => {
      const label = page.getByTestId('active-state-label')
      await expect(label).toContainText('dropzone')

      await page.getByTestId('state-ready').click()
      await expect(label).toContainText('ready')

      await page.getByTestId('state-error').click()
      await expect(label).toContainText('error')
    })

    test('switching from dropzone to uploading changes the block content', async ({ page }) => {
      await expect(page.getByTestId('video-dropzone')).toBeVisible()

      await page.getByTestId('state-uploading').click()
      await expect(page.getByTestId('block-editor')).toBeVisible({ timeout: 10000 })

      await expect(page.getByTestId('video-dropzone')).not.toBeVisible()
      await expect(page.getByTestId('upload-progress-bar')).toBeVisible()
    })

    test('switching from uploading to ready changes the block content', async ({ page }) => {
      await page.getByTestId('state-uploading').click()
      await expect(page.getByTestId('upload-progress-bar')).toBeVisible()

      await page.getByTestId('state-ready').click()
      await expect(page.getByTestId('block-editor')).toBeVisible({ timeout: 10000 })

      await expect(page.getByTestId('upload-progress-bar')).not.toBeVisible()
      await expect(page.getByTestId('video-player-iframe')).toBeVisible()
    })
  })
})
