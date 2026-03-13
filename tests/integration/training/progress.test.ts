import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the route
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    })
  ),
}))

import { PATCH } from '@/app/api/training/progress/route'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createChain(terminalData: unknown = null, terminalError: unknown = null) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi
      .fn()
      .mockResolvedValue({ data: terminalData, error: terminalError }),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: terminalData, error: terminalError }),
    then: undefined as unknown,
  }
  chain.then = (resolve: (v: unknown) => unknown) =>
    resolve({
      data: Array.isArray(terminalData)
        ? terminalData
        : terminalData
          ? [terminalData]
          : [],
      error: terminalError,
    })
  return chain
}

const USER_ID = 'a1111111-1111-4111-a111-111111111111'
const LESSON_ID = 'c3333333-3333-4333-a333-333333333333'
const COURSE_ID = 'b2222222-2222-4222-a222-222222222222'

function mockUnauthenticated() {
  mockGetUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  })
}

function mockAuthenticated(userId = USER_ID) {
  mockGetUser.mockResolvedValue({
    data: { user: { id: userId, email: 'test@example.com' } },
    error: null,
  })
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/training/progress', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const LESSON = {
  id: LESSON_ID,
  course_id: COURSE_ID,
  order_index: 0,
  slug: 'lesson-one',
}

const ENROLLMENT = { id: 'enroll-1' }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PATCH /api/training/progress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated user', async () => {
    mockUnauthenticated()

    const res = await PATCH(makeRequest({ lessonId: LESSON_ID }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 for public role', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'public' })
    mockFrom.mockReturnValue(profileChain)

    const res = await PATCH(makeRequest({ lessonId: LESSON_ID }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 400 for invalid body (missing lessonId)', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    mockFrom.mockReturnValue(profileChain)

    const res = await PATCH(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
  })

  it('returns 400 for invalid UUID lessonId', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    mockFrom.mockReturnValue(profileChain)

    const res = await PATCH(makeRequest({ lessonId: 'bad-uuid' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
  })

  it('returns 404 for non-existent or draft lesson', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    const lessonChain = createChain(null, { code: 'PGRST116', message: 'No rows' })

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'lessons':
          return lessonChain
        default:
          return createChain()
      }
    })

    const res = await PATCH(makeRequest({ lessonId: LESSON_ID }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Lesson not found or not published')
  })

  it('returns 403 if user not enrolled in the course', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    const lessonChain = createChain(LESSON)
    const enrollmentChain = createChain(null, {
      code: 'PGRST116',
      message: 'No rows',
    })

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'lessons':
          return lessonChain
        case 'course_enrollments':
          return enrollmentChain
        default:
          return createChain()
      }
    })

    const res = await PATCH(makeRequest({ lessonId: LESSON_ID }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('enrolled')
  })

  it('returns 422 if lesson has quiz and user has not passed it', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    const lessonChain = createChain(LESSON)
    const enrollmentChain = createChain(ENROLLMENT)
    // quizzes returns a quiz for this lesson (thenable, returns array)
    const quizzesChain = createChain([{ id: 'quiz-1' }])
    // quiz_attempts returns no passing attempts (thenable, returns empty array)
    const attemptsChain = createChain([])

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'lessons':
          return lessonChain
        case 'course_enrollments':
          return enrollmentChain
        case 'quizzes':
          return quizzesChain
        case 'quiz_attempts':
          return attemptsChain
        default:
          return createChain()
      }
    })

    const res = await PATCH(makeRequest({ lessonId: LESSON_ID }))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toContain('quiz')
  })

  it('returns 200 with progress on success (creates new progress row)', async () => {
    mockAuthenticated()

    const now = new Date().toISOString()
    const newProgress = {
      id: 'progress-1',
      user_id: USER_ID,
      lesson_id: LESSON_ID,
      started_at: now,
      completed_at: now,
    }

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    const lessonChain = createChain(LESSON)
    const enrollmentChain = createChain(ENROLLMENT)
    // No quizzes for this lesson
    const quizzesChain = createChain([])
    // No existing progress (single returns null/error)
    const existingProgressChain = createChain(null, {
      code: 'PGRST116',
      message: 'No rows',
    })
    // Insert progress succeeds
    const insertProgressChain = createChain(newProgress)
    // All published lessons (just this one)
    const allLessonsChain = createChain([{ id: LESSON_ID }])
    // Completed lessons includes this one now
    const completedChain = createChain([{ lesson_id: LESSON_ID }])
    // Course enrollment update (for course completion)
    const updateEnrollmentChain = createChain(null)
    // Next lesson — none (last lesson)
    const nextLessonChain = createChain(null, {
      code: 'PGRST116',
      message: 'No rows',
    })

    // Track calls per table to return different chains on subsequent calls
    const callCounts: Record<string, number> = {}
    mockFrom.mockImplementation((table: string) => {
      callCounts[table] = (callCounts[table] || 0) + 1
      switch (table) {
        case 'profiles':
          return profileChain
        case 'lessons':
          // Call 1: lesson lookup (single)
          // Call 2: all published lessons for course completion check (thenable)
          // Call 3: next lesson query (single)
          if (callCounts[table] === 1) return lessonChain
          if (callCounts[table] === 2) return allLessonsChain
          return nextLessonChain
        case 'course_enrollments':
          // Call 1: enrollment check (single)
          // Call 2: update for course completion
          if (callCounts[table] === 1) return enrollmentChain
          return updateEnrollmentChain
        case 'quizzes':
          return quizzesChain
        case 'lesson_progress':
          // Call 1: check existing progress (single)
          // Call 2: insert new progress (single)
          // Call 3: completed lessons for course check (thenable)
          if (callCounts[table] === 1) return existingProgressChain
          if (callCounts[table] === 2) return insertProgressChain
          return completedChain
        default:
          return createChain()
      }
    })

    const res = await PATCH(makeRequest({ lessonId: LESSON_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.progress).toEqual(newProgress)
    expect(body.courseCompleted).toBe(true)
    expect(body.nextLessonSlug).toBeNull()
  })

  it('returns 200 if lesson already completed (idempotent)', async () => {
    mockAuthenticated()

    const existingProgress = {
      id: 'progress-existing',
      user_id: USER_ID,
      lesson_id: LESSON_ID,
      started_at: '2026-03-01T00:00:00Z',
      completed_at: '2026-03-01T00:00:00Z',
    }

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    const lessonChain = createChain(LESSON)
    const enrollmentChain = createChain(ENROLLMENT)
    const quizzesChain = createChain([])
    // Existing progress found with completed_at set
    const existingProgressChain = createChain(existingProgress)
    const allLessonsChain = createChain([{ id: LESSON_ID }])
    const completedChain = createChain([{ lesson_id: LESSON_ID }])
    const updateEnrollmentChain = createChain(null)
    const nextLessonChain = createChain(null, {
      code: 'PGRST116',
      message: 'No rows',
    })

    const callCounts: Record<string, number> = {}
    mockFrom.mockImplementation((table: string) => {
      callCounts[table] = (callCounts[table] || 0) + 1
      switch (table) {
        case 'profiles':
          return profileChain
        case 'lessons':
          if (callCounts[table] === 1) return lessonChain
          if (callCounts[table] === 2) return allLessonsChain
          return nextLessonChain
        case 'course_enrollments':
          if (callCounts[table] === 1) return enrollmentChain
          return updateEnrollmentChain
        case 'quizzes':
          return quizzesChain
        case 'lesson_progress':
          // Call 1: existing progress found (already completed)
          // Call 2: completed lessons query
          if (callCounts[table] === 1) return existingProgressChain
          return completedChain
        default:
          return createChain()
      }
    })

    const res = await PATCH(makeRequest({ lessonId: LESSON_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.progress).toEqual(existingProgress)
    expect(body.courseCompleted).toBe(true)
  })

  it('sets courseCompleted=true and updates enrollment when all lessons done', async () => {
    mockAuthenticated()

    const LESSON_ID_2 = 'd4444444-4444-4444-a444-444444444444'
    const lesson = { ...LESSON, order_index: 1 }

    const now = new Date().toISOString()
    const newProgress = {
      id: 'progress-2',
      user_id: USER_ID,
      lesson_id: LESSON_ID,
      started_at: now,
      completed_at: now,
    }

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    const lessonChain = createChain(lesson)
    const enrollmentChain = createChain(ENROLLMENT)
    const quizzesChain = createChain([])
    const existingProgressChain = createChain(null, {
      code: 'PGRST116',
      message: 'No rows',
    })
    const insertProgressChain = createChain(newProgress)
    // Two published lessons in this course
    const allLessonsChain = createChain([{ id: LESSON_ID }, { id: LESSON_ID_2 }])
    // Both are completed
    const completedChain = createChain([
      { lesson_id: LESSON_ID },
      { lesson_id: LESSON_ID_2 },
    ])
    const updateEnrollmentChain = createChain(null)
    const nextLessonChain = createChain(null, {
      code: 'PGRST116',
      message: 'No rows',
    })

    const callCounts: Record<string, number> = {}
    mockFrom.mockImplementation((table: string) => {
      callCounts[table] = (callCounts[table] || 0) + 1
      switch (table) {
        case 'profiles':
          return profileChain
        case 'lessons':
          if (callCounts[table] === 1) return lessonChain
          if (callCounts[table] === 2) return allLessonsChain
          return nextLessonChain
        case 'course_enrollments':
          if (callCounts[table] === 1) return enrollmentChain
          return updateEnrollmentChain
        case 'quizzes':
          return quizzesChain
        case 'lesson_progress':
          if (callCounts[table] === 1) return existingProgressChain
          if (callCounts[table] === 2) return insertProgressChain
          return completedChain
        default:
          return createChain()
      }
    })

    const res = await PATCH(makeRequest({ lessonId: LESSON_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.courseCompleted).toBe(true)

    // Verify enrollment was updated (second call to course_enrollments was .update)
    expect(updateEnrollmentChain.update).toHaveBeenCalled()
  })

  it('returns nextLessonSlug for the next lesson', async () => {
    mockAuthenticated()

    const LESSON_ID_2 = 'd4444444-4444-4444-a444-444444444444'
    const now = new Date().toISOString()
    const newProgress = {
      id: 'progress-1',
      user_id: USER_ID,
      lesson_id: LESSON_ID,
      started_at: now,
      completed_at: now,
    }

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    const lessonChain = createChain(LESSON)
    const enrollmentChain = createChain(ENROLLMENT)
    const quizzesChain = createChain([])
    const existingProgressChain = createChain(null, {
      code: 'PGRST116',
      message: 'No rows',
    })
    const insertProgressChain = createChain(newProgress)
    // Two published lessons
    const allLessonsChain = createChain([{ id: LESSON_ID }, { id: LESSON_ID_2 }])
    // Only first lesson completed — course NOT completed
    const completedChain = createChain([{ lesson_id: LESSON_ID }])
    // Next lesson exists
    const nextLessonChain = createChain({ slug: 'lesson-two' })

    const callCounts: Record<string, number> = {}
    mockFrom.mockImplementation((table: string) => {
      callCounts[table] = (callCounts[table] || 0) + 1
      switch (table) {
        case 'profiles':
          return profileChain
        case 'lessons':
          if (callCounts[table] === 1) return lessonChain
          if (callCounts[table] === 2) return allLessonsChain
          return nextLessonChain
        case 'course_enrollments':
          return enrollmentChain
        case 'quizzes':
          return quizzesChain
        case 'lesson_progress':
          if (callCounts[table] === 1) return existingProgressChain
          if (callCounts[table] === 2) return insertProgressChain
          return completedChain
        default:
          return createChain()
      }
    })

    const res = await PATCH(makeRequest({ lessonId: LESSON_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.courseCompleted).toBe(false)
    expect(body.nextLessonSlug).toBe('lesson-two')
  })
})
