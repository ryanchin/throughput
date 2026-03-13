import { test, expect } from '@playwright/test'

test.describe('Course Catalog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-training-catalog')
    await expect(page.getByTestId('test-training-catalog')).toBeVisible({
      timeout: 10000,
    })
  })

  test('renders course grid with all courses', async ({ page }) => {
    const grid = page.getByTestId('course-grid')
    await expect(grid).toBeVisible()

    const cards = grid.getByTestId('course-card')
    await expect(cards).toHaveCount(3)
  })

  test('shows "Start Course" for unenrolled course', async ({ page }) => {
    const card = page
      .getByTestId('course-card')
      .filter({ has: page.locator('[data-course-slug="getting-started"]') })
      .first()
    // The data-course-slug is on the same element as data-testid, so use locator
    const gettingStartedCard = page.locator(
      '[data-testid="course-card"][data-course-slug="getting-started"]'
    )
    await expect(gettingStartedCard).toBeVisible()
    await expect(gettingStartedCard.getByText('Start Course')).toBeVisible()
  })

  test('shows progress and "Continue" for in-progress course', async ({
    page,
  }) => {
    const card = page.locator(
      '[data-testid="course-card"][data-course-slug="sprint-planning"]'
    )
    await expect(card).toBeVisible()
    await expect(card.getByText('Continue')).toBeVisible()
    // Should show progress info (3/8 lessons)
    await expect(card.getByText('3/8 lessons')).toBeVisible()
    // Should show percentage
    await expect(card.getByText('38%')).toBeVisible()
  })

  test('shows "Completed" for finished course', async ({ page }) => {
    const card = page.locator(
      '[data-testid="course-card"][data-course-slug="sales-fundamentals"]'
    )
    await expect(card).toBeVisible()
    await expect(card.getByText('Completed')).toBeVisible()
  })

  test('shows zone badges correctly', async ({ page }) => {
    // Training zone
    const trainingCard = page.locator(
      '[data-testid="course-card"][data-course-slug="getting-started"]'
    )
    await expect(trainingCard.getByText('Training')).toBeVisible()

    // Sales zone
    const salesCard = page.locator(
      '[data-testid="course-card"][data-course-slug="sales-fundamentals"]'
    )
    await expect(salesCard.getByText('Sales', { exact: true })).toBeVisible()
  })

  test('shows lesson count and duration', async ({ page }) => {
    const card = page.locator(
      '[data-testid="course-card"][data-course-slug="getting-started"]'
    )
    await expect(card.getByText('5 lessons')).toBeVisible()
    await expect(card.getByText('2h')).toBeVisible()
  })

  test('course cards link to correct URLs', async ({ page }) => {
    const card = page.locator(
      '[data-testid="course-card"][data-course-slug="getting-started"]'
    )
    await expect(card).toHaveAttribute('href', '/training/getting-started')
  })

  test('progress rings render correctly', async ({ page }) => {
    const rings = page.getByTestId('progress-rings')
    await expect(rings).toBeVisible()

    const progressRings = rings.getByTestId('progress-ring')
    await expect(progressRings).toHaveCount(3)
  })

  test('progress rings show correct values', async ({ page }) => {
    const rings = page.getByTestId('progress-rings')
    const progressRings = rings.getByTestId('progress-ring')

    // First ring: 0/5
    await expect(progressRings.nth(0)).toHaveAttribute(
      'aria-label',
      '0 of 5 complete (0%)'
    )
    // Second ring: 3/8
    await expect(progressRings.nth(1)).toHaveAttribute(
      'aria-label',
      '3 of 8 complete (38%)'
    )
    // Third ring: 5/5 (100%)
    await expect(progressRings.nth(2)).toHaveAttribute(
      'aria-label',
      '5 of 5 complete (100%)'
    )
  })

  test('completed course does not show progress bar', async ({ page }) => {
    const card = page.locator(
      '[data-testid="course-card"][data-course-slug="sales-fundamentals"]'
    )
    // Completed courses should not show the in-progress bar
    await expect(card.getByText('Continue')).not.toBeVisible()
    await expect(card.getByText('Start Course')).not.toBeVisible()
  })

  test('in-progress course shows duration info', async ({ page }) => {
    const card = page.locator(
      '[data-testid="course-card"][data-course-slug="sprint-planning"]'
    )
    await expect(card.getByText('8 lessons').first()).toBeVisible()
    await expect(card.getByText('4h')).toBeVisible() // 240 min = 4h
  })
})

test.describe('Lesson Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-lesson-nav')
    await expect(page.getByTestId('test-lesson-nav')).toBeVisible({
      timeout: 10000,
    })
  })

  test('renders all lessons in sequential nav', async ({ page }) => {
    const nav = page.getByTestId('sequential-nav')
    await expect(
      nav.getByTestId('lesson-nav-item-introduction')
    ).toBeVisible()
    await expect(
      nav.getByTestId('lesson-nav-item-core-concepts')
    ).toBeVisible()
    await expect(
      nav.getByTestId('lesson-nav-item-advanced-topics')
    ).toBeVisible()
    await expect(
      nav.getByTestId('lesson-nav-item-final-review')
    ).toBeVisible()
  })

  test('completed lesson is clickable in sequential mode', async ({
    page,
  }) => {
    const nav = page.getByTestId('sequential-nav')
    const completedItem = nav.getByTestId('lesson-nav-item-introduction')
    // Completed + not current = should be a link
    const link = completedItem.locator('a')
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute(
      'href',
      '/training/test-course/introduction'
    )
  })

  test('current lesson is not a link (rendered inline)', async ({ page }) => {
    const nav = page.getByTestId('sequential-nav')
    const currentItem = nav.getByTestId('lesson-nav-item-core-concepts')
    await expect(currentItem).toBeVisible()
    // Current lesson is NOT wrapped in a link
    const links = currentItem.locator('a')
    await expect(links).toHaveCount(0)
  })

  test('current lesson has accent styling', async ({ page }) => {
    const nav = page.getByTestId('sequential-nav')
    const currentItem = nav.getByTestId('lesson-nav-item-core-concepts')
    // The inner div should have the accent-muted background class
    const innerDiv = currentItem.locator('div').first()
    await expect(innerDiv).toHaveClass(/bg-accent-muted/)
  })

  test('locked lessons are not clickable in sequential mode', async ({
    page,
  }) => {
    const nav = page.getByTestId('sequential-nav')
    // advanced-topics (index 2) is locked because core-concepts (index 1) is not completed
    const lockedItem = nav.getByTestId('lesson-nav-item-advanced-topics')
    const links = lockedItem.locator('a')
    await expect(links).toHaveCount(0)

    // final-review (index 3) is also locked
    const lockedItem2 = nav.getByTestId('lesson-nav-item-final-review')
    const links2 = lockedItem2.locator('a')
    await expect(links2).toHaveCount(0)
  })

  test('all lessons are clickable in free mode', async ({ page }) => {
    const nav = page.getByTestId('free-nav')
    // In free mode, all non-current lessons should be links
    // introduction (completed, not current) = link
    const introLink = nav
      .getByTestId('lesson-nav-item-introduction')
      .locator('a')
    await expect(introLink).toBeVisible()

    // core-concepts is current, so NOT a link even in free mode
    const currentLinks = nav
      .getByTestId('lesson-nav-item-core-concepts')
      .locator('a')
    await expect(currentLinks).toHaveCount(0)

    // advanced-topics (not completed, not current, free mode) = link
    const advancedLink = nav
      .getByTestId('lesson-nav-item-advanced-topics')
      .locator('a')
    await expect(advancedLink).toBeVisible()

    // final-review = link in free mode
    const finalLink = nav
      .getByTestId('lesson-nav-item-final-review')
      .locator('a')
    await expect(finalLink).toBeVisible()
  })

  test('lesson numbers are displayed correctly', async ({ page }) => {
    const nav = page.getByTestId('sequential-nav')
    await expect(nav.getByText('1.')).toBeVisible()
    await expect(nav.getByText('2.')).toBeVisible()
    await expect(nav.getByText('3.')).toBeVisible()
    await expect(nav.getByText('4.')).toBeVisible()
  })

  test('quiz badge shows on lesson with quiz', async ({ page }) => {
    const nav = page.getByTestId('sequential-nav')
    const quizLesson = nav.getByTestId('lesson-nav-item-advanced-topics')
    await expect(quizLesson.getByText('Quiz')).toBeVisible()

    // Lessons without quiz should not show badge
    const noQuizLesson = nav.getByTestId('lesson-nav-item-introduction')
    await expect(noQuizLesson.getByText('Quiz')).not.toBeVisible()
  })

  test('lesson complete button shows "Lesson Completed" for completed lesson', async ({
    page,
  }) => {
    const completedBtn = page.getByTestId('completed-button')
    await expect(completedBtn.getByText('Lesson Completed')).toBeVisible()
  })

  test('lesson complete button shows "Complete Quiz First" when quiz not passed', async ({
    page,
  }) => {
    const quizBtn = page.getByTestId('quiz-gate-button')
    await expect(quizBtn.getByText('Complete Quiz First')).toBeVisible()
    // Button should be disabled
    const button = quizBtn.locator('button')
    await expect(button).toBeDisabled()
  })

  test('lesson complete button shows "Mark as Complete" for available lesson', async ({
    page,
  }) => {
    const availableBtn = page.getByTestId('available-button')
    await expect(availableBtn.getByText('Mark as Complete')).toBeVisible()
    // Button should be enabled
    const button = availableBtn.locator('button')
    await expect(button).toBeEnabled()
  })

  test('completed lesson button is disabled', async ({ page }) => {
    const completedBtn = page.getByTestId('completed-button')
    const button = completedBtn.locator('button')
    await expect(button).toBeDisabled()
  })

  test('free nav links have correct hrefs', async ({ page }) => {
    const nav = page.getByTestId('free-nav')
    const advancedLink = nav
      .getByTestId('lesson-nav-item-advanced-topics')
      .locator('a')
    await expect(advancedLink).toHaveAttribute(
      'href',
      '/training/test-course/advanced-topics'
    )
    const finalLink = nav
      .getByTestId('lesson-nav-item-final-review')
      .locator('a')
    await expect(finalLink).toHaveAttribute(
      'href',
      '/training/test-course/final-review'
    )
  })
})
