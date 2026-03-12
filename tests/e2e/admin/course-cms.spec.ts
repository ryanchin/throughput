import { test, expect } from '@playwright/test'

test.describe('Admin Course CMS', () => {
  test.describe('Courses List', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/test-course-cms')
      // Default view is courses-list; wait for the table
      await expect(page.getByTestId('courses-table')).toBeVisible({
        timeout: 10000,
      })
    })

    test('courses page loads with title and New Course button', async ({ page }) => {
      await expect(
        page.getByRole('heading', { name: 'Courses', level: 1 })
      ).toBeVisible()
      await expect(page.getByTestId('new-course-button')).toBeVisible()
      await expect(page.getByTestId('new-course-button')).toContainText('New Course')
    })

    test('courses table displays course rows with metadata', async ({ page }) => {
      const table = page.getByTestId('courses-table')
      await expect(table).toBeVisible()

      // Verify table headers
      await expect(table.getByText('Title')).toBeVisible()
      await expect(table.getByText('Zone')).toBeVisible()
      await expect(table.getByText('Status')).toBeVisible()
      await expect(table.getByText('Lessons')).toBeVisible()

      // Verify the test course row
      const courseRow = page.getByTestId('course-row-test-course-alpha')
      await expect(courseRow).toBeVisible()
      await expect(courseRow).toContainText('Test Course Alpha')
      await expect(courseRow).toContainText('A test course for E2E testing.')
    })

    test('course row displays zone badge', async ({ page }) => {
      const zoneBadge = page.getByTestId('zone-badge-training')
      await expect(zoneBadge).toBeVisible()
      await expect(zoneBadge).toContainText('training')
    })

    test('course row displays status badge', async ({ page }) => {
      const courseRow = page.getByTestId('course-row-test-course-alpha')
      const statusBadge = courseRow.getByTestId('status-badge-draft')
      await expect(statusBadge).toBeVisible()
      await expect(statusBadge).toContainText('DRAFT')
    })

    test('course row shows lesson count', async ({ page }) => {
      const courseRow = page.getByTestId('course-row-test-course-alpha')
      await expect(courseRow).toContainText('2')
    })

    test('course row has Edit and Delete action buttons', async ({ page }) => {
      const editButton = page.getByTestId(
        'edit-course-00000000-0000-0000-0000-000000000099'
      )
      const deleteButton = page.getByTestId(
        'delete-course-00000000-0000-0000-0000-000000000099'
      )

      await expect(editButton).toBeVisible()
      await expect(editButton).toContainText('Edit')
      await expect(deleteButton).toBeVisible()
      await expect(deleteButton).toContainText('Delete')
    })

    test('clicking New Course navigates to the new course form', async ({ page }) => {
      await page.getByTestId('new-course-button').click()

      // Should now show the CourseForm in create mode
      await expect(
        page.getByRole('heading', { name: 'Create Course' })
      ).toBeVisible({ timeout: 5000 })
    })

    test('clicking Edit navigates to the edit course view', async ({ page }) => {
      await page
        .getByTestId('edit-course-00000000-0000-0000-0000-000000000099')
        .click()

      // Should now show the CourseForm in edit mode
      await expect(
        page.getByRole('heading', { name: 'Edit Course' })
      ).toBeVisible({ timeout: 5000 })
      await expect(page.getByTestId('back-to-courses')).toBeVisible()
    })
  })

  test.describe('New Course Form', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/test-course-cms')
      await page.getByTestId('view-new-course').click()
      await expect(
        page.getByRole('heading', { name: 'Create Course' })
      ).toBeVisible({ timeout: 10000 })
    })

    test('new course form renders all fields', async ({ page }) => {
      await expect(page.locator('label', { hasText: 'Title' }).first()).toBeVisible()
      await expect(page.locator('label', { hasText: 'Slug' })).toBeVisible()
      await expect(page.locator('label', { hasText: 'Description' })).toBeVisible()
      await expect(page.locator('label', { hasText: 'Zone' })).toBeVisible()
      await expect(
        page.locator('label', { hasText: 'Passing Score' })
      ).toBeVisible()
      await expect(
        page.locator('label', { hasText: 'Cover Image URL' })
      ).toBeVisible()
    })

    test('slug auto-generates from title', async ({ page }) => {
      const titleInput = page.locator('#title')
      const slugInput = page.locator('#slug')

      await titleInput.fill('My New Training Course')

      // Slug should auto-generate after a brief delay
      await expect(slugInput).toHaveValue('my-new-training-course', {
        timeout: 3000,
      })
    })

    test('slug updates when title changes', async ({ page }) => {
      const titleInput = page.locator('#title')
      const slugInput = page.locator('#slug')

      await titleInput.fill('First Title')
      await expect(slugInput).toHaveValue('first-title', { timeout: 3000 })

      await titleInput.fill('Second Title')
      await expect(slugInput).toHaveValue('second-title', { timeout: 3000 })
    })

    test('manually editing slug stops auto-generation', async ({ page }) => {
      const titleInput = page.locator('#title')
      const slugInput = page.locator('#slug')

      await titleInput.fill('Auto Slug Test')
      await expect(slugInput).toHaveValue('auto-slug-test', { timeout: 3000 })

      // Manually edit the slug
      await slugInput.clear()
      await slugInput.fill('custom-slug')

      // Change title -- slug should NOT update now
      await titleInput.fill('Changed Title')
      // Wait a bit to ensure auto-generation does not fire
      await page.waitForTimeout(500)
      await expect(slugInput).toHaveValue('custom-slug')
    })

    test('zone selector defaults to training', async ({ page }) => {
      const zoneSelect = page.locator('#zone')
      await expect(zoneSelect).toHaveValue('training')
    })

    test('zone selector can be changed to sales', async ({ page }) => {
      const zoneSelect = page.locator('#zone')
      await zoneSelect.selectOption('sales')
      await expect(zoneSelect).toHaveValue('sales')
    })

    test('description textarea has character counter', async ({ page }) => {
      await expect(page.getByText('0/2000')).toBeVisible()

      const descriptionInput = page.locator('#description')
      await descriptionInput.fill('Hello World')
      await expect(page.getByText('11/2000')).toBeVisible()
    })

    test('form has Create Course submit button and Cancel button', async ({ page }) => {
      await expect(
        page.locator('button[type="submit"]', { hasText: 'Create Course' })
      ).toBeVisible()
      await expect(
        page.locator('button[type="button"]', { hasText: 'Cancel' })
      ).toBeVisible()
    })

    test('empty title shows validation error on submit', async ({ page }) => {
      // Leave title empty, click submit
      await page
        .locator('button[type="submit"]', { hasText: 'Create Course' })
        .click()

      await expect(page.getByText('Title is required')).toBeVisible()
    })
  })

  test.describe('Edit Course', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/test-course-cms')
      await page.getByTestId('view-edit-course').click()
      await expect(
        page.getByRole('heading', { name: 'Edit Course' })
      ).toBeVisible({ timeout: 10000 })
    })

    test('edit course form is pre-filled with course data', async ({ page }) => {
      const titleInput = page.locator('#title')
      const slugInput = page.locator('#slug')
      const descriptionInput = page.locator('#description')
      const zoneSelect = page.locator('#zone')

      await expect(titleInput).toHaveValue('Test Course Alpha')
      await expect(slugInput).toHaveValue('test-course-alpha')
      await expect(descriptionInput).toHaveValue(
        'A test course for E2E testing.'
      )
      await expect(zoneSelect).toHaveValue('training')
    })

    test('edit form shows Save Changes button instead of Create', async ({
      page,
    }) => {
      await expect(
        page.locator('button[type="submit"]', { hasText: 'Save Changes' })
      ).toBeVisible()
    })

    test('title can be modified in the edit form', async ({ page }) => {
      const titleInput = page.locator('#title')
      await titleInput.clear()
      await titleInput.fill('Updated Course Title')
      await expect(titleInput).toHaveValue('Updated Course Title')
    })

    test('back to courses link is visible', async ({ page }) => {
      await expect(page.getByTestId('back-to-courses')).toBeVisible()
      await expect(page.getByTestId('back-to-courses')).toContainText(
        'Back to Courses'
      )
    })

    test('back to courses link navigates to courses list', async ({ page }) => {
      await page.getByTestId('back-to-courses').click()

      // Should now show the courses list
      await expect(page.getByTestId('courses-table')).toBeVisible({
        timeout: 5000,
      })
    })
  })

  test.describe('Lesson List', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/test-course-cms')
      await page.getByTestId('view-edit-course').click()
      await expect(page.getByTestId('lesson-list')).toBeVisible({
        timeout: 10000,
      })
    })

    test('lesson list section displays with heading', async ({ page }) => {
      await expect(
        page.getByRole('heading', { name: 'Lessons' })
      ).toBeVisible()
    })

    test('existing lessons are displayed in order', async ({ page }) => {
      const lessonOne = page.getByTestId(
        'lesson-row-00000000-0000-0000-0000-000000000101'
      )
      const lessonTwo = page.getByTestId(
        'lesson-row-00000000-0000-0000-0000-000000000102'
      )

      await expect(lessonOne).toBeVisible()
      await expect(lessonOne).toContainText('Lesson One')
      await expect(lessonTwo).toBeVisible()
      await expect(lessonTwo).toContainText('Lesson Two')
    })

    test('lessons display status badges', async ({ page }) => {
      const lessonOne = page.getByTestId(
        'lesson-row-00000000-0000-0000-0000-000000000101'
      )
      await expect(
        lessonOne.getByTestId('status-badge-published')
      ).toBeVisible()

      const lessonTwo = page.getByTestId(
        'lesson-row-00000000-0000-0000-0000-000000000102'
      )
      await expect(lessonTwo.getByTestId('status-badge-draft')).toBeVisible()
    })

    test('lessons have edit and delete buttons', async ({ page }) => {
      await expect(
        page.getByTestId(
          'edit-lesson-00000000-0000-0000-0000-000000000101'
        )
      ).toBeVisible()
      await expect(
        page.getByTestId(
          'delete-lesson-00000000-0000-0000-0000-000000000101'
        )
      ).toBeVisible()
    })

    test('lessons have drag handle for reordering', async ({ page }) => {
      await expect(
        page.getByTestId(
          'drag-handle-00000000-0000-0000-0000-000000000101'
        )
      ).toBeVisible()
    })

    test('lessons display order index numbers', async ({ page }) => {
      const lessonOne = page.getByTestId(
        'lesson-row-00000000-0000-0000-0000-000000000101'
      )
      const lessonTwo = page.getByTestId(
        'lesson-row-00000000-0000-0000-0000-000000000102'
      )

      // order_index 0 -> displayed as 1, order_index 1 -> displayed as 2
      await expect(lessonOne).toContainText('1')
      await expect(lessonTwo).toContainText('2')
    })

    test('lesson status toggle is visible and reflects status', async ({
      page,
    }) => {
      const publishedToggle = page.getByTestId(
        'lesson-status-toggle-00000000-0000-0000-0000-000000000101'
      )
      await expect(publishedToggle).toBeVisible()
      await expect(publishedToggle).toHaveAttribute('aria-checked', 'true')

      const draftToggle = page.getByTestId(
        'lesson-status-toggle-00000000-0000-0000-0000-000000000102'
      )
      await expect(draftToggle).toBeVisible()
      await expect(draftToggle).toHaveAttribute('aria-checked', 'false')
    })

    test('Add Lesson button is visible', async ({ page }) => {
      await expect(page.getByTestId('add-lesson-button')).toBeVisible()
      await expect(page.getByTestId('add-lesson-button')).toContainText(
        'Add Lesson'
      )
    })

    test('clicking Add Lesson shows the add lesson form', async ({ page }) => {
      await page.getByTestId('add-lesson-button').click()

      await expect(page.getByTestId('add-lesson-form')).toBeVisible()
      await expect(page.getByTestId('new-lesson-title-input')).toBeVisible()
      await expect(page.getByTestId('create-lesson-button')).toBeVisible()
      await expect(page.getByTestId('cancel-add-lesson')).toBeVisible()
    })

    test('add lesson form input gets focus automatically', async ({ page }) => {
      await page.getByTestId('add-lesson-button').click()

      const input = page.getByTestId('new-lesson-title-input')
      await expect(input).toBeVisible()
      await expect(input).toBeFocused()
    })

    test('cancel button hides the add lesson form', async ({ page }) => {
      await page.getByTestId('add-lesson-button').click()
      await expect(page.getByTestId('add-lesson-form')).toBeVisible()

      await page.getByTestId('cancel-add-lesson').click()
      await expect(page.getByTestId('add-lesson-form')).not.toBeVisible()
      await expect(page.getByTestId('add-lesson-button')).toBeVisible()
    })

    test('Escape key hides the add lesson form', async ({ page }) => {
      await page.getByTestId('add-lesson-button').click()
      const input = page.getByTestId('new-lesson-title-input')
      await expect(input).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(page.getByTestId('add-lesson-form')).not.toBeVisible()
    })

    test('create lesson button is disabled when title is empty', async ({
      page,
    }) => {
      await page.getByTestId('add-lesson-button').click()

      const createButton = page.getByTestId('create-lesson-button')
      await expect(createButton).toBeDisabled()
    })

    test('create lesson button is enabled when title has text', async ({
      page,
    }) => {
      await page.getByTestId('add-lesson-button').click()

      const input = page.getByTestId('new-lesson-title-input')
      await input.fill('New Lesson Title')

      const createButton = page.getByTestId('create-lesson-button')
      await expect(createButton).toBeEnabled()
    })

    test('delete lesson button triggers a confirm dialog', async ({
      page,
    }) => {
      // Set up a dialog handler to capture the confirm
      let dialogMessage = ''
      page.on('dialog', async (dialog) => {
        dialogMessage = dialog.message()
        await dialog.dismiss()
      })

      await page
        .getByTestId(
          'delete-lesson-00000000-0000-0000-0000-000000000101'
        )
        .click()

      // The LessonList component uses window.confirm
      expect(dialogMessage).toContain('Lesson One')
      expect(dialogMessage).toContain('cannot be undone')
    })
  })

  test.describe('Empty State', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/test-course-cms')
      await page.getByTestId('view-empty-state').click()
      await expect(page.getByTestId('courses-empty-state')).toBeVisible({
        timeout: 10000,
      })
    })

    test('empty state displays when no courses exist', async ({ page }) => {
      await expect(page.getByTestId('courses-empty-state')).toBeVisible()
      await expect(page.getByText('No courses yet')).toBeVisible()
      await expect(
        page.getByText('Get started by creating your first training course.')
      ).toBeVisible()
    })

    test('empty state has a Create Course button', async ({ page }) => {
      const createButton = page.getByTestId('empty-new-course-button')
      await expect(createButton).toBeVisible()
      await expect(createButton).toContainText('Create Course')
    })

    test('empty state Create Course button navigates to new course form', async ({
      page,
    }) => {
      await page.getByTestId('empty-new-course-button').click()
      await expect(
        page.getByRole('heading', { name: 'Create Course' })
      ).toBeVisible({ timeout: 5000 })
    })

    test('page header still shows New Course button in empty state', async ({
      page,
    }) => {
      await expect(page.getByTestId('new-course-button')).toBeVisible()
    })
  })
})
