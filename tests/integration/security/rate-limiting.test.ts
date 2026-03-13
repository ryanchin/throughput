import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the routes
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn()
const mockAuthFrom = vi.fn()
const mockServiceFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockAuthFrom,
    })
  ),
  createServiceClient: vi.fn(() => ({
    from: mockServiceFrom,
  })),
}))

vi.mock('@/lib/openrouter/grader', () => ({
  gradeOpenEndedResponse: vi.fn(),
}))

// Mock the rate-limiter module directly
const mockCheckRateLimit = vi.fn()

vi.mock('@/lib/security/rate-limiter', () => ({
  rateLimiters: {
    quizSubmit: 'mock-quiz-limiter',
    certSubmit: 'mock-cert-limiter',
    generateCourse: 'mock-gen-course-limiter',
    generateLesson: 'mock-gen-lesson-limiter',
    authSignup: 'mock-auth-signup-limiter',
  },
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

// Must import after mocks
import { POST as quizSubmit } from '@/app/api/quiz/submit/route'
import { POST as certSubmit } from '@/app/api/certifications/submit/route'

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
    gte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
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
      count: Array.isArray(terminalData) ? terminalData.length : terminalData ? 1 : 0,
    })
  return chain
}

const USER_ID = 'a1111111-1111-4111-a111-111111111111'

function makeRequest(path: string, body: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function make429Response() {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': '3600',
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Date.now() + 3600000),
      },
    }
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Rate limiting — quiz submit', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: rate limit passes
    mockCheckRateLimit.mockResolvedValue(null)

    // Authenticated user
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    })
  })

  it('allows requests within the rate limit', async () => {
    // Rate limit passes (returns null)
    mockCheckRateLimit.mockResolvedValue(null)

    const quizData = { id: 'quiz-1', lesson_id: 'lesson-1', title: 'Test', passing_score: 70, max_attempts: null }
    const questions = [
      { id: 'q1', quiz_id: 'quiz-1', question_text: 'Q?', question_type: 'multiple_choice', options: [], correct_answer: 'A', rubric: null, max_points: 10, order_index: 0 },
    ]
    const lessonData = { id: 'lesson-1', course_id: 'course-1' }
    const enrollmentData = { id: 'enrollment-1' }
    const attemptData = { id: 'attempt-1' }

    let authCounter = 0
    mockAuthFrom.mockImplementation(() => {
      authCounter++
      if (authCounter === 1) return createChain(quizData)
      if (authCounter === 2) return createChain(questions)
      if (authCounter === 3) return createChain(lessonData)
      if (authCounter === 4) return createChain(enrollmentData)
      return createChain(null)
    })

    let serviceCounter = 0
    mockServiceFrom.mockImplementation(() => {
      serviceCounter++
      if (serviceCounter === 1) return createChain(null) // count existing attempts
      if (serviceCounter === 2) return createChain(attemptData)
      if (serviceCounter === 3) return createChain(null) // insert response
      if (serviceCounter === 4) return createChain(null) // update attempt
      return createChain(null)
    })

    const body = { quizId: 'b2222222-2222-4222-a222-222222222222', answers: [{ questionId: 'a7777777-7777-4777-a777-777777777777', answer: 'A' }] }
    const req = makeRequest('/api/quiz/submit', body)
    const res = await quizSubmit(req)

    expect(res.status).not.toBe(429)
    // Rate limiter was called with quiz limiter and user ID
    expect(mockCheckRateLimit).toHaveBeenCalledWith('mock-quiz-limiter', USER_ID)
  })

  it('returns 429 on the 11th request (rate limit exceeded)', async () => {
    // Rate limit returns a 429 response
    mockCheckRateLimit.mockResolvedValue(make429Response())

    const body = { quizId: 'b2222222-2222-4222-a222-222222222222', answers: [{ questionId: 'a7777777-7777-4777-a777-777777777777', answer: 'A' }] }
    const req = makeRequest('/api/quiz/submit', body)
    const res = await quizSubmit(req)

    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.error).toContain('Too many requests')
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expect(res.headers.get('X-RateLimit-Limit')).toBe('10')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
  })

  it('checks rate limit before processing the quiz submission', async () => {
    // Rate limit blocks the request
    mockCheckRateLimit.mockResolvedValue(make429Response())

    const body = { quizId: 'b2222222-2222-4222-a222-222222222222', answers: [{ questionId: 'a7777777-7777-4777-a777-777777777777', answer: 'A' }] }
    const req = makeRequest('/api/quiz/submit', body)
    await quizSubmit(req)

    // The rate limiter should be called, but DB should NOT be queried
    expect(mockCheckRateLimit).toHaveBeenCalledTimes(1)
    expect(mockAuthFrom).not.toHaveBeenCalled()
    expect(mockServiceFrom).not.toHaveBeenCalled()
  })
})

describe('Rate limiting — cert submit', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: rate limit passes
    mockCheckRateLimit.mockResolvedValue(null)

    // Authenticated user
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    })
  })

  it('returns 429 on the 6th certification submit request', async () => {
    mockCheckRateLimit.mockResolvedValue(
      NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': '86400',
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Date.now() + 86400000),
          },
        }
      )
    )

    const body = {
      attemptId: 'b2222222-2222-4222-a222-222222222222',
      answers: [{ questionId: 'a7777777-7777-4777-a777-777777777777', answer: 'A' }],
    }
    const req = makeRequest('/api/certifications/submit', body)
    const res = await certSubmit(req)

    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.error).toContain('Too many requests')
    expect(mockCheckRateLimit).toHaveBeenCalledWith('mock-cert-limiter', USER_ID)
  })

  it('allows the first 5 requests within the rate limit window', async () => {
    mockCheckRateLimit.mockResolvedValue(null)

    const attemptData = {
      id: 'attempt-1',
      user_id: USER_ID,
      track_id: 'track-1',
      attempt_number: 1,
      question_ids: ['q1'],
      submitted_at: null,
    }
    const trackData = { id: 'track-1', title: 'Test Track', passing_score: 80 }
    const questionsData = [
      { id: 'q1', question_text: 'Q?', question_type: 'multiple_choice', options: [], correct_answer: 'A', rubric: null, max_points: 10 },
    ]

    let serviceCounter = 0
    mockServiceFrom.mockImplementation(() => {
      serviceCounter++
      if (serviceCounter === 1) return createChain(attemptData)
      if (serviceCounter === 2) return createChain(trackData)
      if (serviceCounter === 3) return createChain(questionsData)
      if (serviceCounter === 4) return createChain(null)
      return createChain(null)
    })

    const body = {
      attemptId: 'b2222222-2222-4222-a222-222222222222',
      answers: [{ questionId: 'a7777777-7777-4777-a777-777777777777', answer: 'A' }],
    }
    const req = makeRequest('/api/certifications/submit', body)
    const res = await certSubmit(req)

    expect(res.status).not.toBe(429)
  })

  it('checks rate limit before processing the cert submission', async () => {
    mockCheckRateLimit.mockResolvedValue(make429Response())

    const body = {
      attemptId: 'b2222222-2222-4222-a222-222222222222',
      answers: [{ questionId: 'a7777777-7777-4777-a777-777777777777', answer: 'A' }],
    }
    const req = makeRequest('/api/certifications/submit', body)
    await certSubmit(req)

    // The rate limiter should be called, but service DB should NOT be queried
    expect(mockCheckRateLimit).toHaveBeenCalledTimes(1)
    expect(mockServiceFrom).not.toHaveBeenCalled()
  })
})

describe('Rate limiting — unauthenticated requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue(null)
  })

  it('returns 401 before rate limiting for unauthenticated quiz submit', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    const body = { quizId: 'b2222222-2222-4222-a222-222222222222', answers: [{ questionId: 'a7777777-7777-4777-a777-777777777777', answer: 'A' }] }
    const req = makeRequest('/api/quiz/submit', body)
    const res = await quizSubmit(req)

    expect(res.status).toBe(401)
    // Rate limiter should NOT be called for unauthenticated requests
    expect(mockCheckRateLimit).not.toHaveBeenCalled()
  })
})
