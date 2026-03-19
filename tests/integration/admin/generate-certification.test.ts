import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/requireAdmin', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/generate/context-builder', () => ({
  buildContext: vi.fn(),
}))

vi.mock('@/lib/generate/log-generation', () => ({
  logGeneration: vi.fn(),
}))

import { requireAdmin } from '@/lib/auth/requireAdmin'
import { buildContext } from '@/lib/generate/context-builder'
import { logGeneration } from '@/lib/generate/log-generation'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockBuildContext = vi.mocked(buildContext)
const mockLogGeneration = vi.mocked(logGeneration)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(body?: unknown): NextRequest {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new NextRequest('http://localhost:3000/api/admin/generate/certification', init)
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
  trackTitle: 'AAVA Practitioner Certification',
  trackDescription: 'Tests foundational knowledge of AAVA methodology',
  questionCount: 5,
  questionTypes: ['multiple_choice', 'open_ended'],
}

const VALID_LLM_RESPONSE = {
  questions: [
    {
      question_text: 'What is the primary purpose of sprint planning?',
      question_type: 'multiple_choice',
      options: [
        { text: 'To define what can be delivered in the sprint', is_correct: true },
        { text: 'To evaluate team performance', is_correct: false },
        { text: 'To assign blame for missed deadlines', is_correct: false },
        { text: 'To plan the entire project timeline', is_correct: false },
      ],
      correct_answer: 'To define what can be delivered in the sprint',
      rubric: null,
      difficulty: 'easy',
      max_points: 10,
    },
    {
      question_text: 'Explain the difference between velocity and throughput.',
      question_type: 'open_ended',
      options: null,
      correct_answer: null,
      rubric: 'Full marks: clearly distinguishes velocity (story points per sprint) from throughput (items completed per time). Partial: mentions both but conflates them.',
      difficulty: 'medium',
      max_points: 10,
    },
    {
      question_text: 'Which metric best measures team predictability?',
      question_type: 'multiple_choice',
      options: [
        { text: 'Sprint velocity variance', is_correct: true },
        { text: 'Total story points completed', is_correct: false },
        { text: 'Number of bugs found', is_correct: false },
        { text: 'Lines of code written', is_correct: false },
      ],
      correct_answer: 'Sprint velocity variance',
      rubric: null,
      difficulty: 'medium',
      max_points: 10,
    },
  ],
}

function setupAdminAuth() {
  mockRequireAdmin.mockResolvedValue({
    profile: ADMIN_PROFILE as never,
    error: null,
    supabase: {} as never,
  })
}

function setupDefaultContext(contextText = '') {
  mockBuildContext.mockResolvedValue({
    contextText,
    totalWords: contextText.split(/\s+/).filter(Boolean).length,
    wasSummarized: false,
  })
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/generate/certification', () => {
  let POST: (request: NextRequest) => Promise<Response>
  let originalFetch: typeof global.fetch
  let originalEnv: string | undefined

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    originalFetch = global.fetch
    originalEnv = process.env.OPENROUTER_API_KEY
    process.env.OPENROUTER_API_KEY = 'test-api-key'

    setupDefaultContext()

    const mod = await import('@/app/api/admin/generate/certification/route')
    POST = mod.POST
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.OPENROUTER_API_KEY = originalEnv
  })

  // -------------------------------------------------------------------------
  // Success cases
  // -------------------------------------------------------------------------
  it('generates certification questions and returns them', async () => {
    setupAdminAuth()
    global.fetch = vi.fn().mockResolvedValue(mockOpenRouterResponse(VALID_LLM_RESPONSE))

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.questions).toBeDefined()
    expect(body.questions).toHaveLength(3)

    // Verify question structure
    const mcQuestion = body.questions[0]
    expect(mcQuestion.question_type).toBe('multiple_choice')
    expect(mcQuestion.options).toHaveLength(4)
    expect(mcQuestion.correct_answer).toBe('To define what can be delivered in the sprint')

    const oeQuestion = body.questions[1]
    expect(oeQuestion.question_type).toBe('open_ended')
    expect(oeQuestion.rubric).toBeTruthy()

    // Verify generation was logged
    expect(mockLogGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: 'admin-id',
        generationType: 'certification',
        status: 'success',
        outputSummary: expect.stringContaining('3 certification questions'),
      })
    )
  })

  it('does not write to database (questions returned to caller)', async () => {
    setupAdminAuth()
    global.fetch = vi.fn().mockResolvedValue(mockOpenRouterResponse(VALID_LLM_RESPONSE))

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(200)
    // No DB mocks were set up — if the route tried to write, it would fail
  })

  // -------------------------------------------------------------------------
  // Auth failures
  // -------------------------------------------------------------------------
  it('returns 401 for unauthenticated request', async () => {
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
  })

  // -------------------------------------------------------------------------
  // Validation failures
  // -------------------------------------------------------------------------
  it('returns 400 when trackTitle is missing', async () => {
    setupAdminAuth()

    const req = createRequest({
      questionCount: 10,
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  it('returns 400 when questionCount exceeds 100', async () => {
    setupAdminAuth()

    const req = createRequest({
      trackTitle: 'Test Track',
      questionCount: 101,
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  it('returns 400 when questionCount is 0', async () => {
    setupAdminAuth()

    const req = createRequest({
      trackTitle: 'Test Track',
      questionCount: 0,
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  it('returns 400 when questionTypes contains invalid type', async () => {
    setupAdminAuth()

    const req = createRequest({
      trackTitle: 'Test Track',
      questionTypes: ['multiple_choice', 'true_false'],
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  it('returns 400 for invalid JSON body', async () => {
    setupAdminAuth()

    const req = new NextRequest(
      'http://localhost:3000/api/admin/generate/certification',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      }
    )
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid JSON')
  })

  it('returns 400 when preset is invalid', async () => {
    setupAdminAuth()

    const req = createRequest({
      ...VALID_REQUEST_BODY,
      preset: 'nonexistent',
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  it('returns 400 when courseIds contains non-UUID strings', async () => {
    setupAdminAuth()

    const req = createRequest({
      ...VALID_REQUEST_BODY,
      courseIds: ['not-a-uuid'],
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  // -------------------------------------------------------------------------
  // LLM failures
  // -------------------------------------------------------------------------
  it('returns 500 when LLM call fails', async () => {
    setupAdminAuth()
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Failed to call LLM')

    // Verify error was logged
    expect(mockLogGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        errorMessage: expect.stringContaining('Network error'),
      })
    )
  })

  it('returns 500 when OPENROUTER_API_KEY is not set', async () => {
    setupAdminAuth()
    delete process.env.OPENROUTER_API_KEY

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Failed to call LLM')
  })

  it('returns 500 when LLM returns invalid JSON', async () => {
    setupAdminAuth()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            { message: { content: 'This is not valid JSON' } },
          ],
        }),
    })

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Failed to parse LLM response')
  })

  it('returns 500 when LLM returns JSON missing questions array', async () => {
    setupAdminAuth()
    global.fetch = vi.fn().mockResolvedValue(
      mockOpenRouterResponse({ someOtherField: 'value' })
    )

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Failed to parse LLM response')
  })

  it('returns 500 when LLM returns empty questions array', async () => {
    setupAdminAuth()
    global.fetch = vi.fn().mockResolvedValue(
      mockOpenRouterResponse({ questions: [] })
    )

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Failed to parse LLM response')
  })

  // -------------------------------------------------------------------------
  // Context integration
  // -------------------------------------------------------------------------
  it('passes context fields to buildContext when provided', async () => {
    setupAdminAuth()
    setupDefaultContext('Reference material for question generation')
    global.fetch = vi.fn().mockResolvedValue(mockOpenRouterResponse(VALID_LLM_RESPONSE))

    const req = createRequest({
      ...VALID_REQUEST_BODY,
      instructions: 'Focus on sprint metrics',
      preset: 'assessment',
      fileText: 'Extracted study guide text',
      fileName: 'study-guide.pdf',
      courseIds: ['123e4567-e89b-12d3-a456-426614174000'],
    })
    const res = await POST(req)

    expect(res.status).toBe(200)

    expect(mockBuildContext).toHaveBeenCalledWith({
      instructions: 'Focus on sprint metrics',
      preset: 'assessment',
      fileText: 'Extracted study guide text',
      fileName: 'study-guide.pdf',
      fileWordCount: expect.any(Number),
      courseIds: ['123e4567-e89b-12d3-a456-426614174000'],
    })
  })

  it('returns 500 when buildContext fails', async () => {
    setupAdminAuth()
    mockBuildContext.mockRejectedValue(new Error('Context build failed'))

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Failed to build context')
  })

  it('works without any context fields', async () => {
    setupAdminAuth()
    setupDefaultContext('')
    global.fetch = vi.fn().mockResolvedValue(mockOpenRouterResponse(VALID_LLM_RESPONSE))

    const req = createRequest({
      trackTitle: 'AAVA Foundations',
    })
    const res = await POST(req)

    expect(res.status).toBe(200)

    expect(mockBuildContext).toHaveBeenCalledWith({
      instructions: null,
      preset: null,
      fileText: null,
      fileName: null,
      fileWordCount: 0,
      courseIds: [],
    })
  })

  // -------------------------------------------------------------------------
  // Defaults
  // -------------------------------------------------------------------------
  it('uses default questionCount of 30 when not provided', async () => {
    setupAdminAuth()
    setupDefaultContext('')
    global.fetch = vi.fn().mockResolvedValue(mockOpenRouterResponse(VALID_LLM_RESPONSE))

    const req = createRequest({
      trackTitle: 'AAVA Foundations',
    })
    await POST(req)

    // Verify the prompt includes the default count
    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const requestBody = JSON.parse(fetchCall[1].body)
    const userMessage = requestBody.messages.find((m: { role: string }) => m.role === 'user')
    expect(userMessage.content).toContain('30 certification exam questions')
  })

  it('uses default questionTypes of both when not provided', async () => {
    setupAdminAuth()
    setupDefaultContext('')
    global.fetch = vi.fn().mockResolvedValue(mockOpenRouterResponse(VALID_LLM_RESPONSE))

    const req = createRequest({
      trackTitle: 'AAVA Foundations',
    })
    await POST(req)

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const requestBody = JSON.parse(fetchCall[1].body)
    const userMessage = requestBody.messages.find((m: { role: string }) => m.role === 'user')
    expect(userMessage.content).toContain('multiple_choice, open_ended')
  })

  it('handles LLM response wrapped in markdown code fences', async () => {
    setupAdminAuth()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: '```json\n' + JSON.stringify(VALID_LLM_RESPONSE) + '\n```',
              },
            },
          ],
        }),
    })

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.questions).toHaveLength(3)
  })
})
