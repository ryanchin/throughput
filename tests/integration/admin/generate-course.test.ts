import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the route
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/requireAdmin', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockCreateServiceClient = vi.mocked(createServiceClient)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createRequest(body?: unknown): NextRequest {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new NextRequest('http://localhost:3000/api/admin/generate/course', init)
}

const ADMIN_PROFILE = {
  id: 'admin-id',
  role: 'admin',
  full_name: 'Test Admin',
  email: 'admin@example.com',
  avatar_url: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

const VALID_REQUEST_BODY = {
  title: 'Sprint Planning Fundamentals',
  zone: 'training',
  description: 'A comprehensive course about sprint planning techniques and best practices',
  lessonCount: 2,
  includeQuizzes: true,
}

const VALID_LLM_RESPONSE = {
  title: 'Sprint Planning Fundamentals',
  description: 'A course about sprint planning.',
  learning_objectives: [
    'Understand sprint planning basics',
    'Apply estimation techniques',
  ],
  lessons: [
    {
      title: 'Introduction to Sprint Planning',
      summary: 'Learn the basics of sprint planning.',
      key_topics: ['What is sprint planning', 'Sprint goals'],
      content_outline: '# Introduction\n\nThis is the introduction.',
      quiz: {
        questions: [
          {
            type: 'multiple_choice',
            question_text: 'What is a sprint?',
            options: [
              { text: 'A time-boxed iteration', is_correct: true },
              { text: 'A type of meeting', is_correct: false },
            ],
            rubric: '',
          },
        ],
      },
    },
    {
      title: 'Estimation Techniques',
      summary: 'Learn about estimation.',
      key_topics: ['Story points', 'T-shirt sizing'],
      content_outline: '# Estimation\n\nEstimation techniques overview.',
      quiz: {
        questions: [
          {
            type: 'true_false',
            question_text: 'Story points measure effort.',
            options: [
              { text: 'True', is_correct: true },
              { text: 'False', is_correct: false },
            ],
            rubric: '',
          },
        ],
      },
    },
  ],
}

function mockOpenRouterResponse(content: unknown) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        choices: [
          { message: { content: JSON.stringify(content) } },
        ],
      }),
    text: () => Promise.resolve(''),
  }
}

function mockOpenRouterFailure(status: number, body: string) {
  return {
    ok: false,
    status,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve({}),
  }
}

/**
 * Creates a chainable mock that supports arbitrary .method() chains
 * and resolves to the given value at the end of the chain.
 */
function createChainMock(resolveValue: unknown) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve(resolveValue)
      }
      return (..._args: unknown[]) => new Proxy({}, handler)
    },
  }
  return new Proxy({}, handler)
}

// ---------------------------------------------------------------------------
// Service client mock builder
// ---------------------------------------------------------------------------

interface TableInsertResult {
  data: unknown
  error: unknown
}

function setupServiceClient(options: {
  courseInsert?: TableInsertResult
  lessonInserts?: TableInsertResult[]
  quizInserts?: TableInsertResult[]
  questionInserts?: TableInsertResult[]
  deleteResult?: { error: unknown }
} = {}) {
  const {
    courseInsert = { data: { id: 'generated-course-id' }, error: null },
    lessonInserts = [
      { data: { id: 'lesson-1-id' }, error: null },
      { data: { id: 'lesson-2-id' }, error: null },
    ],
    quizInserts = [
      { data: { id: 'quiz-1-id' }, error: null },
      { data: { id: 'quiz-2-id' }, error: null },
    ],
    questionInserts = [
      { error: null },
      { error: null },
    ],
    deleteResult = { error: null },
  } = options

  let lessonIdx = 0
  let quizIdx = 0
  let questionIdx = 0

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'courses') {
      return {
        insert: () => createChainMock(courseInsert),
        delete: () => createChainMock(deleteResult),
      }
    }
    if (table === 'lessons') {
      return {
        insert: () => {
          const result = lessonInserts[lessonIdx] ?? { data: null, error: { message: 'No mock' } }
          lessonIdx++
          return createChainMock(result)
        },
      }
    }
    if (table === 'quizzes') {
      return {
        insert: () => {
          const result = quizInserts[quizIdx] ?? { data: null, error: { message: 'No mock' } }
          quizIdx++
          return createChainMock(result)
        },
      }
    }
    if (table === 'questions') {
      return {
        insert: () => {
          const result = questionInserts[questionIdx] ?? { error: null }
          questionIdx++
          return createChainMock(result)
        },
      }
    }
    return createChainMock({ data: null, error: null })
  })

  mockCreateServiceClient.mockReturnValue({ from: mockFrom } as never)

  return { mockFrom }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/generate/course', () => {
  let POST: (request: NextRequest) => Promise<Response>
  let originalFetch: typeof global.fetch
  let originalEnv: string | undefined

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Save originals
    originalFetch = global.fetch
    originalEnv = process.env.OPENROUTER_API_KEY

    // Set API key for tests
    process.env.OPENROUTER_API_KEY = 'test-api-key'

    // Re-import the route to pick up fresh mocks
    const mod = await import('@/app/api/admin/generate/course/route')
    POST = mod.POST
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.OPENROUTER_API_KEY = originalEnv
  })

  // -------------------------------------------------------------------------
  // 1. Successful generation
  // -------------------------------------------------------------------------
  it('generates a course and returns 201 with courseId', async () => {
    mockRequireAdmin.mockResolvedValue({
      profile: ADMIN_PROFILE as never,
      error: null,
      supabase: {} as never,
    })

    global.fetch = vi.fn().mockResolvedValue(mockOpenRouterResponse(VALID_LLM_RESPONSE))

    const { mockFrom } = setupServiceClient()

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.courseId).toBe('generated-course-id')

    // Verify course insert was called
    expect(mockFrom).toHaveBeenCalledWith('courses')

    // Verify lessons were inserted (one per LLM lesson)
    const lessonCalls = mockFrom.mock.calls.filter(
      (c: string[]) => c[0] === 'lessons'
    )
    expect(lessonCalls).toHaveLength(2)

    // Verify quizzes were inserted
    const quizCalls = mockFrom.mock.calls.filter(
      (c: string[]) => c[0] === 'quizzes'
    )
    expect(quizCalls).toHaveLength(2)
  })

  // -------------------------------------------------------------------------
  // 2. Auth failure
  // -------------------------------------------------------------------------
  it('returns 401 when requireAdmin returns auth error', async () => {
    mockRequireAdmin.mockResolvedValue({
      profile: null,
      error: { message: 'Unauthorized', status: 401 },
      supabase: {} as never,
    })

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 for non-admin user', async () => {
    mockRequireAdmin.mockResolvedValue({
      profile: { ...ADMIN_PROFILE, role: 'employee' } as never,
      error: { message: 'Forbidden: admin access required', status: 403 },
      supabase: {} as never,
    })

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('Forbidden')
  })

  // -------------------------------------------------------------------------
  // 3. Validation failures
  // -------------------------------------------------------------------------
  it('returns 400 when title is missing', async () => {
    mockRequireAdmin.mockResolvedValue({
      profile: ADMIN_PROFILE as never,
      error: null,
      supabase: {} as never,
    })

    const req = createRequest({
      zone: 'training',
      description: 'A valid description here',
      lessonCount: 5,
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  it('returns 400 when description is under 10 characters', async () => {
    mockRequireAdmin.mockResolvedValue({
      profile: ADMIN_PROFILE as never,
      error: null,
      supabase: {} as never,
    })

    const req = createRequest({
      title: 'Test Course',
      description: 'Short',
      lessonCount: 5,
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
    const descIssue = body.details?.find(
      (d: { path: string[] }) => d.path?.includes('description')
    )
    expect(descIssue).toBeDefined()
  })

  it('returns 400 when lessonCount is 0', async () => {
    mockRequireAdmin.mockResolvedValue({
      profile: ADMIN_PROFILE as never,
      error: null,
      supabase: {} as never,
    })

    const req = createRequest({
      title: 'Test Course',
      description: 'A valid description here',
      lessonCount: 0,
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  it('returns 400 when lessonCount is 21', async () => {
    mockRequireAdmin.mockResolvedValue({
      profile: ADMIN_PROFILE as never,
      error: null,
      supabase: {} as never,
    })

    const req = createRequest({
      title: 'Test Course',
      description: 'A valid description here',
      lessonCount: 21,
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  it('returns 400 for invalid JSON body', async () => {
    mockRequireAdmin.mockResolvedValue({
      profile: ADMIN_PROFILE as never,
      error: null,
      supabase: {} as never,
    })

    const req = new NextRequest(
      'http://localhost:3000/api/admin/generate/course',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json{{{',
      }
    )
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid JSON')
  })

  // -------------------------------------------------------------------------
  // 4. LLM returns invalid JSON
  // -------------------------------------------------------------------------
  it('returns 500 when LLM returns non-JSON text', async () => {
    mockRequireAdmin.mockResolvedValue({
      profile: ADMIN_PROFILE as never,
      error: null,
      supabase: {} as never,
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            { message: { content: 'This is not valid JSON at all!!!' } },
          ],
        }),
    })

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Failed to parse LLM response')
  })

  // -------------------------------------------------------------------------
  // 5. LLM returns valid JSON but missing required fields
  // -------------------------------------------------------------------------
  it('returns 500 when LLM returns empty JSON object', async () => {
    mockRequireAdmin.mockResolvedValue({
      profile: ADMIN_PROFILE as never,
      error: null,
      supabase: {} as never,
    })

    global.fetch = vi.fn().mockResolvedValue(mockOpenRouterResponse({}))

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Failed to parse LLM response')
  })

  it('returns 500 when LLM returns JSON with missing lessons array', async () => {
    mockRequireAdmin.mockResolvedValue({
      profile: ADMIN_PROFILE as never,
      error: null,
      supabase: {} as never,
    })

    global.fetch = vi.fn().mockResolvedValue(
      mockOpenRouterResponse({
        title: 'A Course',
        description: 'Desc',
        learning_objectives: ['One'],
        // no lessons
      })
    )

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Failed to parse LLM response')
  })

  // -------------------------------------------------------------------------
  // 6. LLM API failure
  // -------------------------------------------------------------------------
  it('returns 500 when OpenRouter API returns an error status', async () => {
    mockRequireAdmin.mockResolvedValue({
      profile: ADMIN_PROFILE as never,
      error: null,
      supabase: {} as never,
    })

    global.fetch = vi.fn().mockResolvedValue(
      mockOpenRouterFailure(429, 'Rate limit exceeded')
    )

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('LLM request failed')
    expect(body.error).toContain('429')
  })

  it('returns 500 when LLM returns empty content', async () => {
    mockRequireAdmin.mockResolvedValue({
      profile: ADMIN_PROFILE as never,
      error: null,
      supabase: {} as never,
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: null } }],
        }),
    })

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('empty response')
  })

  // -------------------------------------------------------------------------
  // 7. Missing API key
  // -------------------------------------------------------------------------
  it('returns 500 when OPENROUTER_API_KEY is not set', async () => {
    mockRequireAdmin.mockResolvedValue({
      profile: ADMIN_PROFILE as never,
      error: null,
      supabase: {} as never,
    })

    delete process.env.OPENROUTER_API_KEY

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('API key is not configured')
  })

  // -------------------------------------------------------------------------
  // 8. DB insert failure triggers cleanup
  // -------------------------------------------------------------------------
  it('returns 500 and cleans up when lesson insert fails', async () => {
    mockRequireAdmin.mockResolvedValue({
      profile: ADMIN_PROFILE as never,
      error: null,
      supabase: {} as never,
    })

    global.fetch = vi.fn().mockResolvedValue(mockOpenRouterResponse(VALID_LLM_RESPONSE))

    const { mockFrom } = setupServiceClient({
      courseInsert: { data: { id: 'cleanup-course-id' }, error: null },
      lessonInserts: [
        { data: null, error: { message: 'DB insert failed' } },
      ],
    })

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Failed to save generated course')

    // Verify cleanup: course delete was called
    const courseCalls = mockFrom.mock.calls.filter(
      (c: string[]) => c[0] === 'courses'
    )
    // First call for insert, second call for cleanup delete
    expect(courseCalls.length).toBeGreaterThanOrEqual(2)
  })

  // -------------------------------------------------------------------------
  // 9. Course insert failure
  // -------------------------------------------------------------------------
  it('returns 500 when course insert fails', async () => {
    mockRequireAdmin.mockResolvedValue({
      profile: ADMIN_PROFILE as never,
      error: null,
      supabase: {} as never,
    })

    global.fetch = vi.fn().mockResolvedValue(mockOpenRouterResponse(VALID_LLM_RESPONSE))

    setupServiceClient({
      courseInsert: { data: null, error: { message: 'Unique constraint violation' } },
    })

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Failed to create course')
  })

  // -------------------------------------------------------------------------
  // 10. Network error calling LLM
  // -------------------------------------------------------------------------
  it('returns 500 when fetch to OpenRouter throws a network error', async () => {
    mockRequireAdmin.mockResolvedValue({
      profile: ADMIN_PROFILE as never,
      error: null,
      supabase: {} as never,
    })

    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Failed to call LLM')
  })
})
