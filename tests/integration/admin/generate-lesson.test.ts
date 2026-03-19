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
  return new NextRequest('http://localhost:3000/api/admin/generate/lesson', init)
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
  courseTitle: 'Sprint Planning Fundamentals',
  lessonTitle: 'Introduction to Sprint Planning',
  courseDescription: 'A course about sprint planning.',
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

function mockLlmMarkdownResponse(markdown: string) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        choices: [{ message: { content: markdown } }],
      }),
    text: () => Promise.resolve(''),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/generate/lesson', () => {
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

    const mod = await import('@/app/api/admin/generate/lesson/route')
    POST = mod.POST
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.OPENROUTER_API_KEY = originalEnv
  })

  it('generates lesson content and returns Tiptap JSON', async () => {
    setupAdminAuth()
    global.fetch = vi.fn().mockResolvedValue(
      mockLlmMarkdownResponse('# Introduction\n\nThis is the lesson content.')
    )

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.content).toBeDefined()
    expect(body.content.type).toBe('doc')
    expect(body.content.content).toBeInstanceOf(Array)

    // Verify generation was logged
    expect(mockLogGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: 'admin-id',
        generationType: 'lesson',
        status: 'success',
      })
    )
  })

  it('returns 401 for unauthenticated request', async () => {
    mockRequireAdmin.mockResolvedValue({
      profile: null,
      error: { message: 'Unauthorized', status: 401 },
      supabase: {} as never,
    })

    const req = createRequest(VALID_REQUEST_BODY)
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('returns 400 when lessonTitle is missing', async () => {
    setupAdminAuth()

    const req = createRequest({
      courseTitle: 'Test Course',
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  it('returns 400 when courseTitle is missing', async () => {
    setupAdminAuth()

    const req = createRequest({
      lessonTitle: 'Test Lesson',
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  it('returns 400 for invalid JSON body', async () => {
    setupAdminAuth()

    const req = new NextRequest(
      'http://localhost:3000/api/admin/generate/lesson',
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
      preset: 'invalid_preset',
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

  it('passes context fields to buildContext when provided', async () => {
    setupAdminAuth()
    setupDefaultContext('Reference material from uploaded file')
    global.fetch = vi.fn().mockResolvedValue(
      mockLlmMarkdownResponse('# Content\n\nGenerated from context.')
    )

    const req = createRequest({
      ...VALID_REQUEST_BODY,
      instructions: 'Write for advanced users',
      preset: 'technical',
      fileText: 'Extracted document text',
      fileName: 'reference.pdf',
      courseIds: ['123e4567-e89b-12d3-a456-426614174000'],
    })
    const res = await POST(req)

    expect(res.status).toBe(200)

    expect(mockBuildContext).toHaveBeenCalledWith({
      instructions: 'Write for advanced users',
      preset: 'technical',
      fileText: 'Extracted document text',
      fileName: 'reference.pdf',
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

  it('works without any context fields (backward compatible)', async () => {
    setupAdminAuth()
    setupDefaultContext('')
    global.fetch = vi.fn().mockResolvedValue(
      mockLlmMarkdownResponse('# Lesson\n\nContent here.')
    )

    const req = createRequest(VALID_REQUEST_BODY)
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
})
