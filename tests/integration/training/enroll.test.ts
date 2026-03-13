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

import { POST } from '@/app/api/training/enroll/route'

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
  return new NextRequest('http://localhost/api/training/enroll', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/training/enroll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated user', async () => {
    mockUnauthenticated()

    const res = await POST(makeRequest({ courseId: COURSE_ID }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 for public role', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'public' })
    mockFrom.mockReturnValue(profileChain)

    const res = await POST(makeRequest({ courseId: COURSE_ID }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 400 for missing courseId', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    mockFrom.mockReturnValue(profileChain)

    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
    expect(body.details).toBeDefined()
  })

  it('returns 400 for invalid UUID courseId', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    mockFrom.mockReturnValue(profileChain)

    const res = await POST(makeRequest({ courseId: 'not-a-uuid' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
  })

  it('returns 404 for non-existent or draft course', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    // Course lookup returns nothing (not found / draft filtered out)
    const courseChain = createChain(null, { code: 'PGRST116', message: 'No rows' })

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'courses':
          return courseChain
        default:
          return createChain()
      }
    })

    const res = await POST(makeRequest({ courseId: COURSE_ID }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Course not found or not published')
  })

  it('returns 403 when employee tries to enroll in sales course', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    const courseChain = createChain({
      id: COURSE_ID,
      zone: 'sales',
      status: 'published',
    })

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'courses':
          return courseChain
        default:
          return createChain()
      }
    })

    const res = await POST(makeRequest({ courseId: COURSE_ID }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('You do not have access to this course')
  })

  it('returns 201 with enrollment on successful enrollment', async () => {
    mockAuthenticated()

    const enrollment = {
      id: 'enroll-new',
      user_id: USER_ID,
      course_id: COURSE_ID,
      completed_at: null,
      created_at: '2026-03-12T00:00:00Z',
    }

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    const courseChain = createChain({
      id: COURSE_ID,
      zone: 'training',
      status: 'published',
    })
    // Insert chain: .insert().select().single()
    const insertChain = createChain(enrollment)

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'courses':
          return courseChain
        case 'course_enrollments':
          return insertChain
        default:
          return createChain()
      }
    })

    const res = await POST(makeRequest({ courseId: COURSE_ID }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.enrollment).toEqual(enrollment)
  })

  it('returns 200 with existing enrollment on duplicate (unique constraint)', async () => {
    mockAuthenticated()

    const existingEnrollment = {
      id: 'enroll-existing',
      user_id: USER_ID,
      course_id: COURSE_ID,
      completed_at: null,
      created_at: '2026-03-01T00:00:00Z',
    }

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    const courseChain = createChain({
      id: COURSE_ID,
      zone: 'training',
      status: 'published',
    })
    // Insert fails with unique constraint violation
    const insertChain = createChain(null, {
      code: '23505',
      message: 'duplicate key value violates unique constraint',
    })
    // Fetch existing enrollment on duplicate
    const fetchExistingChain = createChain(existingEnrollment)

    let enrollCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'courses':
          return courseChain
        case 'course_enrollments': {
          enrollCallCount++
          // First call: insert (fails with 23505)
          // Second call: select existing
          return enrollCallCount === 1 ? insertChain : fetchExistingChain
        }
        default:
          return createChain()
      }
    })

    const res = await POST(makeRequest({ courseId: COURSE_ID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.enrollment).toEqual(existingEnrollment)
  })

  it('sales user can enroll in sales course', async () => {
    mockAuthenticated()

    const enrollment = {
      id: 'enroll-sales',
      user_id: USER_ID,
      course_id: COURSE_ID,
      completed_at: null,
      created_at: '2026-03-12T00:00:00Z',
    }

    const profileChain = createChain({ id: USER_ID, role: 'sales' })
    const courseChain = createChain({
      id: COURSE_ID,
      zone: 'sales',
      status: 'published',
    })
    const insertChain = createChain(enrollment)

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'courses':
          return courseChain
        case 'course_enrollments':
          return insertChain
        default:
          return createChain()
      }
    })

    const res = await POST(makeRequest({ courseId: COURSE_ID }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.enrollment).toEqual(enrollment)
  })

  it('returns 500 on non-duplicate insert error', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    const courseChain = createChain({
      id: COURSE_ID,
      zone: 'training',
      status: 'published',
    })
    const insertChain = createChain(null, {
      code: '42501',
      message: 'RLS violation',
    })

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'courses':
          return courseChain
        case 'course_enrollments':
          return insertChain
        default:
          return createChain()
      }
    })

    const res = await POST(makeRequest({ courseId: COURSE_ID }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to enroll')
  })
})
