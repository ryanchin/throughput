import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the Supabase server client before importing the route
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

// Helper to create a NextRequest for PATCH
function createPatchRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/content/status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Creates a chainable mock that supports arbitrary .method() chains
 * and resolves to the given value at the end of the chain.
 */
function createChainMock(resolveValue: unknown) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') {
        // Make it thenable — resolve with the value
        return (resolve: (v: unknown) => void) => resolve(resolveValue)
      }
      // Any method call returns another chainable proxy
      return (..._args: unknown[]) => new Proxy({}, handler)
    },
  }
  return new Proxy({}, handler)
}

interface MockSupabaseOptions {
  user?: { id: string } | null
  authError?: { message: string } | null
  profile?: { role: string } | null
  lessons?: Array<{ id: string; title: string; status: string }> | null
  lessonsError?: { message: string } | null
  track?: { questions_per_exam: number } | null
  trackError?: { message: string } | null
  questionCount?: number
  questionCountError?: { message: string } | null
  updateError?: { message: string } | null
}

function setupMockSupabase(options: MockSupabaseOptions = {}) {
  const {
    user = { id: 'admin-id' },
    authError = null,
    profile = { role: 'admin' },
    lessons = [],
    lessonsError = null,
    track = { questions_per_exam: 30 },
    trackError = null,
    questionCount = 0,
    questionCountError = null,
    updateError = null,
  } = options

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'profiles') {
      return createChainMock({ data: profile, error: null })
    }
    if (table === 'lessons') {
      // Could be a select (for validation) or an update
      // We need to differentiate: select returns lessons data, update returns updateError
      // Use a proxy that tracks calls
      return {
        select: () => createChainMock({ data: lessons, error: lessonsError }),
        update: () => createChainMock({ error: updateError }),
      }
    }
    if (table === 'certification_tracks') {
      return {
        select: () => createChainMock({ data: track, error: trackError }),
        update: () => createChainMock({ error: updateError }),
      }
    }
    if (table === 'cert_questions') {
      return createChainMock({ count: questionCount, error: questionCountError })
    }
    // Default tables: courses, docs_pages — only update is used
    return {
      select: () => createChainMock({ data: [], error: null }),
      update: () => createChainMock({ error: updateError }),
    }
  })

  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: authError,
      }),
    },
    from: mockFrom,
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

describe('PATCH /api/admin/content/status', () => {
  let PATCH: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@/app/api/admin/content/status/route')
    PATCH = mod.PATCH
  })

  it('returns 401 for unauthenticated user', async () => {
    setupMockSupabase({ user: null, authError: { message: 'Not auth' } })
    const req = createPatchRequest({
      contentType: 'lesson',
      contentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: 'published',
    })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'employee' } })
    const req = createPatchRequest({
      contentType: 'lesson',
      contentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: 'published',
    })
    const res = await PATCH(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid content type', async () => {
    setupMockSupabase()
    const req = createPatchRequest({
      contentType: 'invalid',
      contentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: 'published',
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid UUID', async () => {
    setupMockSupabase()
    const req = createPatchRequest({
      contentType: 'lesson',
      contentId: 'not-a-uuid',
      status: 'published',
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid status', async () => {
    setupMockSupabase()
    const req = createPatchRequest({
      contentType: 'lesson',
      contentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: 'archived',
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })

  it('publishes a lesson successfully', async () => {
    setupMockSupabase()
    const req = createPatchRequest({
      contentType: 'lesson',
      contentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: 'published',
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.status).toBe('published')
  })

  it('unpublishes a lesson successfully', async () => {
    setupMockSupabase()
    const req = createPatchRequest({
      contentType: 'lesson',
      contentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: 'draft',
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
  })

  it('publishes a docs_page successfully', async () => {
    setupMockSupabase()
    const req = createPatchRequest({
      contentType: 'docs_page',
      contentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: 'published',
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
  })

  it('returns 422 when publishing course with no published lessons', async () => {
    setupMockSupabase({
      lessons: [
        { id: '1', title: 'Lesson 1', status: 'draft' },
        { id: '2', title: 'Lesson 2', status: 'draft' },
      ],
    })
    const req = createPatchRequest({
      contentType: 'course',
      contentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: 'published',
    })
    const res = await PATCH(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toContain('no published lessons')
  })

  it('publishes a course when it has published lessons', async () => {
    setupMockSupabase({
      lessons: [
        { id: '1', title: 'Lesson 1', status: 'published' },
        { id: '2', title: 'Lesson 2', status: 'draft' },
      ],
    })
    const req = createPatchRequest({
      contentType: 'course',
      contentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: 'published',
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
  })

  it('returns 422 when publishing cert track with insufficient questions', async () => {
    setupMockSupabase({
      track: { questions_per_exam: 30 },
      questionCount: 10,
    })
    const req = createPatchRequest({
      contentType: 'certification_track',
      contentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: 'published',
    })
    const res = await PATCH(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toContain('need at least 30 questions')
  })

  it('publishes a cert track when it has sufficient questions', async () => {
    setupMockSupabase({
      track: { questions_per_exam: 30 },
      questionCount: 50,
    })
    const req = createPatchRequest({
      contentType: 'certification_track',
      contentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: 'published',
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
  })

  it('allows unpublishing a course without validation', async () => {
    setupMockSupabase()
    const req = createPatchRequest({
      contentType: 'course',
      contentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: 'draft',
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
  })
})
