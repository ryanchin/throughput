import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
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

import { GET } from '@/app/api/training/courses/[slug]/results/route'

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
    single: vi.fn().mockResolvedValue({ data: terminalData, error: terminalError }),
    maybeSingle: vi.fn().mockResolvedValue({ data: terminalData, error: terminalError }),
    then: undefined as unknown,
  }
  chain.then = (resolve: (v: unknown) => unknown) =>
    resolve({
      data: Array.isArray(terminalData) ? terminalData : terminalData ? [terminalData] : [],
      error: terminalError,
    })
  return chain
}

const USER_ID = 'a1111111-1111-4111-a111-111111111111'
const COURSE_ID = 'c1111111-1111-4111-a111-111111111111'
const LESSON_ID = 'l1111111-1111-4111-a111-111111111111'
const QUIZ_ID = 'q1111111-1111-4111-a111-111111111111'

const mockCourse = {
  id: COURSE_ID,
  title: 'Test Course',
  slug: 'test-course',
  zone: 'training',
  passing_score: 70,
  cover_image_url: null,
}

const mockEnrollment = {
  id: 'e1',
  status: 'passed',
  final_score: 85,
  enrolled_at: '2026-01-01T00:00:00Z',
  completed_at: '2026-03-12T00:00:00Z',
}

const mockLesson = {
  id: LESSON_ID,
  title: 'Lesson 1',
  slug: 'lesson-1',
  order_index: 0,
}

const mockQuiz = { id: QUIZ_ID, lesson_id: LESSON_ID, title: 'Quiz 1', passing_score: 70 }

const mockAttempt = {
  id: 'att1',
  quiz_id: QUIZ_ID,
  score: 85,
  passed: true,
  submitted_at: '2026-03-12T00:00:00Z',
}

const mockQuestion = { quiz_id: QUIZ_ID, max_points: 10 }

function makeRequest() {
  return new NextRequest('http://localhost:3000/api/training/courses/test-course/results')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/training/courses/[slug]/results', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Not logged in' } })

    const res = await GET(makeRequest(), { params: Promise.resolve({ slug: 'test-course' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when course not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    mockFrom.mockReturnValue(createChain(null, { message: 'Not found' }))

    const res = await GET(makeRequest(), { params: Promise.resolve({ slug: 'nonexistent' }) })
    expect(res.status).toBe(404)
  })

  it('returns 403 when not enrolled', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) return createChain(mockCourse) // courses
      return createChain(null, { message: 'No enrollment' }) // enrollment
    })

    const res = await GET(makeRequest(), { params: Promise.resolve({ slug: 'test-course' }) })
    expect(res.status).toBe(403)
  })

  it('returns scorecard data when enrolled and completed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) return createChain(mockCourse) // courses
      if (fromCallCount === 2) return createChain(mockEnrollment) // enrollment
      if (fromCallCount === 3) return createChain([mockLesson]) // lessons
      if (fromCallCount === 4) return createChain([mockQuiz]) // quizzes
      if (fromCallCount === 5) return createChain([mockAttempt]) // attempts
      if (fromCallCount === 6) return createChain([mockQuestion]) // questions
      return createChain([])
    })

    const res = await GET(makeRequest(), { params: Promise.resolve({ slug: 'test-course' }) })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.course.title).toBe('Test Course')
    expect(data.enrollment.status).toBe('passed')
    expect(data.enrollment.finalScore).toBe(85)
    expect(data.breakdown).toBeDefined()
    expect(data.finalScore).toBe(85)
  })

  it('returns basic data when course has no quizzes', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) return createChain(mockCourse) // courses
      if (fromCallCount === 2) return createChain(mockEnrollment) // enrollment
      if (fromCallCount === 3) return createChain([mockLesson]) // lessons
      if (fromCallCount === 4) return createChain([]) // quizzes (empty)
      return createChain([])
    })

    const res = await GET(makeRequest(), { params: Promise.resolve({ slug: 'test-course' }) })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.breakdown).toEqual([])
  })

  it('returns 404 when course has no published lessons', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) return createChain(mockCourse) // courses
      if (fromCallCount === 2) return createChain(mockEnrollment) // enrollment
      if (fromCallCount === 3) return createChain([]) // lessons (empty)
      return createChain([])
    })

    const res = await GET(makeRequest(), { params: Promise.resolve({ slug: 'test-course' }) })
    expect(res.status).toBe(404)
  })
})
