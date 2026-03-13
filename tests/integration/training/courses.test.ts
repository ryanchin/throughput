import { describe, it, expect, vi, beforeEach } from 'vitest'

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

import { GET } from '@/app/api/training/courses/route'

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

const COURSE_A = {
  id: 'aaaaaaaa-1111-4111-a111-111111111111',
  title: 'Training Course A',
  slug: 'training-a',
  description: 'A training course',
  zone: 'training',
  status: 'published',
  cover_image_url: null,
  learning_objectives: [],
  passing_score: 70,
  created_at: '2026-01-01T00:00:00Z',
}

const COURSE_B_SALES = {
  id: 'bbbbbbbb-2222-4222-a222-222222222222',
  title: 'Sales Course B',
  slug: 'sales-b',
  description: 'A sales course',
  zone: 'sales',
  status: 'published',
  cover_image_url: null,
  learning_objectives: [],
  passing_score: 70,
  created_at: '2026-01-02T00:00:00Z',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/training/courses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated user', async () => {
    mockUnauthenticated()

    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 for public role user', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'public' })
    mockFrom.mockReturnValue(profileChain)

    const res = await GET()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns published training courses for employee role with enrichment', async () => {
    mockAuthenticated()

    const lessonA1 = { id: 'cccccccc-1111-4111-a111-111111111111', course_id: 'aaaaaaaa-1111-4111-a111-111111111111', duration_minutes: 15 }
    const lessonA2 = { id: 'cccccccc-2222-4222-a222-222222222222', course_id: 'aaaaaaaa-1111-4111-a111-111111111111', duration_minutes: 20 }
    const enrollment = {
      id: 'eeeeeeee-1111-4111-a111-111111111111',
      user_id: USER_ID,
      course_id: 'aaaaaaaa-1111-4111-a111-111111111111',
      completed_at: null,
    }
    const progressItem = { lesson_id: 'cccccccc-1111-4111-a111-111111111111', completed_at: '2026-01-05T00:00:00Z' }

    // Call 1: profiles
    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    // Call 2: courses query (awaited directly — thenable)
    const coursesChain = createChain([COURSE_A])
    // Call 3–5: parallel batch queries (lessons, enrollments, progress) — all thenable
    const lessonsChain = createChain([lessonA1, lessonA2])
    const enrollmentsChain = createChain([enrollment])
    const progressChain = createChain([progressItem])

    let fromCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'courses':
          return coursesChain
        case 'lessons':
          // lessons is called in the batch
          return lessonsChain
        case 'course_enrollments':
          return enrollmentsChain
        case 'lesson_progress':
          return progressChain
        default:
          fromCallCount++
          return createChain([])
      }
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.courses).toHaveLength(1)

    const course = body.courses[0]
    expect(course.id).toBe('aaaaaaaa-1111-4111-a111-111111111111')
    expect(course.lesson_count).toBe(2)
    expect(course.total_duration_minutes).toBe(35)
    expect(course.completed_lesson_count).toBe(1)
    expect(course.enrollment).toEqual(enrollment)
  })

  it('employee does NOT see sales zone courses', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    // The coursesChain is thenable — resolves with only training courses
    // because the route adds .eq('zone', 'training') for employee role
    const coursesChain = createChain([COURSE_A])
    const lessonsChain = createChain([])
    const enrollmentsChain = createChain([])
    const progressChain = createChain([])

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'courses':
          return coursesChain
        case 'lessons':
          return lessonsChain
        case 'course_enrollments':
          return enrollmentsChain
        case 'lesson_progress':
          return progressChain
        default:
          return createChain([])
      }
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    // Verify the courses chain had .eq('zone', 'training') called on it
    expect(coursesChain.eq).toHaveBeenCalledWith('zone', 'training')
    // Only training courses returned
    expect(body.courses.every((c: { zone: string }) => c.zone === 'training')).toBe(true)
  })

  it('sales role sees both training and sales courses', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'sales' })
    const coursesChain = createChain([COURSE_A, COURSE_B_SALES])
    const lessonsChain = createChain([])
    const enrollmentsChain = createChain([])
    const progressChain = createChain([])

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'courses':
          return coursesChain
        case 'lessons':
          return lessonsChain
        case 'course_enrollments':
          return enrollmentsChain
        case 'lesson_progress':
          return progressChain
        default:
          return createChain([])
      }
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.courses).toHaveLength(2)

    // For sales role, the route should NOT call .eq('zone', ...) — no zone filter
    // The courses chain .eq is called for status='published', but NOT for zone
    const eqCalls = (coursesChain.eq as ReturnType<typeof vi.fn>).mock.calls
    const zoneFilterCalls = eqCalls.filter(
      (call: unknown[]) => call[0] === 'zone'
    )
    expect(zoneFilterCalls).toHaveLength(0)
  })

  it('admin sees all courses', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'admin' })
    const coursesChain = createChain([COURSE_A, COURSE_B_SALES])
    const lessonsChain = createChain([])
    const enrollmentsChain = createChain([])
    const progressChain = createChain([])

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'courses':
          return coursesChain
        case 'lessons':
          return lessonsChain
        case 'course_enrollments':
          return enrollmentsChain
        case 'lesson_progress':
          return progressChain
        default:
          return createChain([])
      }
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.courses).toHaveLength(2)

    // Admin should NOT have zone filter applied
    const eqCalls = (coursesChain.eq as ReturnType<typeof vi.fn>).mock.calls
    const zoneFilterCalls = eqCalls.filter(
      (call: unknown[]) => call[0] === 'zone'
    )
    expect(zoneFilterCalls).toHaveLength(0)
  })

  it('returns empty array when no courses exist', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    // Empty courses — the route checks courses.length === 0 and returns early
    const coursesChain = createChain([])

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'courses':
          return coursesChain
        default:
          return createChain([])
      }
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.courses).toEqual([])
  })

  it('returns 500 on Supabase error fetching courses', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    const coursesChain = createChain(null, { message: 'DB error', code: 'PGRST' })

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'courses':
          return coursesChain
        default:
          return createChain([])
      }
    })

    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to fetch courses')
  })

  it('returns 500 on Supabase error fetching batch details', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    const coursesChain = createChain([COURSE_A])
    // Lessons query errors
    const lessonsChain = createChain(null, { message: 'DB error' })
    const enrollmentsChain = createChain([])
    const progressChain = createChain([])

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'courses':
          return coursesChain
        case 'lessons':
          return lessonsChain
        case 'course_enrollments':
          return enrollmentsChain
        case 'lesson_progress':
          return progressChain
        default:
          return createChain([])
      }
    })

    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to fetch course details')
  })
})
