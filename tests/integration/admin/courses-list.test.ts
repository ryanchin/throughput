import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase server client before importing the route
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

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

const MOCK_COURSES = [
  {
    id: 'course-1',
    title: 'Intro to PM',
    slug: 'intro-to-pm',
    description: 'A beginner course',
    zone: 'training',
    status: 'published',
    cover_image_url: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-06-15T10:00:00Z',
  },
  {
    id: 'course-2',
    title: 'Sales Playbook',
    slug: 'sales-playbook',
    description: null,
    zone: 'sales',
    status: 'draft',
    cover_image_url: null,
    created_at: '2025-02-01T00:00:00Z',
    updated_at: '2025-06-10T10:00:00Z',
  },
]

interface MockSupabaseOptions {
  user?: { id: string } | null
  authError?: { message: string } | null
  profile?: { role: string } | null
  profileError?: { message: string } | null
  courses?: typeof MOCK_COURSES | null
  coursesError?: { message: string } | null
  lessonRows?: Array<{ course_id: string }> | null
  enrollmentRows?: Array<{ course_id: string }> | null
}

function setupMockSupabase(options: MockSupabaseOptions = {}) {
  const {
    user = { id: 'admin-id' },
    authError = null,
    profile = { role: 'admin' },
    profileError = null,
    courses = MOCK_COURSES,
    coursesError = null,
    lessonRows = [
      { course_id: 'course-1' },
      { course_id: 'course-1' },
      { course_id: 'course-1' },
      { course_id: 'course-2' },
    ],
    enrollmentRows = [
      { course_id: 'course-1' },
      { course_id: 'course-1' },
    ],
  } = options

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'profiles') {
      return createChainMock({ data: profile, error: profileError })
    }
    if (table === 'courses') {
      return createChainMock({ data: courses, error: coursesError })
    }
    if (table === 'lessons') {
      return createChainMock({ data: lessonRows, error: null })
    }
    if (table === 'course_enrollments') {
      return createChainMock({ data: enrollmentRows, error: null })
    }
    return createChainMock({ data: [], error: null })
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

  return { mockFrom }
}

describe('GET /api/admin/courses', () => {
  let GET: () => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@/app/api/admin/courses/route')
    GET = mod.GET
  })

  it('returns 401 for unauthenticated user', async () => {
    setupMockSupabase({ user: null, authError: { message: 'Not auth' } })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'employee' } })
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns courses with lesson and enrollment counts', async () => {
    setupMockSupabase()
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.courses).toHaveLength(2)

    const course1 = body.courses.find((c: { id: string }) => c.id === 'course-1')
    expect(course1.lesson_count).toBe(3)
    expect(course1.enrollment_count).toBe(2)

    const course2 = body.courses.find((c: { id: string }) => c.id === 'course-2')
    expect(course2.lesson_count).toBe(1)
    expect(course2.enrollment_count).toBe(0)
  })

  it('returns empty array when no courses exist', async () => {
    setupMockSupabase({ courses: [] })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.courses).toEqual([])
  })

  it('returns 500 when courses query fails', async () => {
    setupMockSupabase({ coursesError: { message: 'DB error' } })
    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('includes all expected fields in course response', async () => {
    setupMockSupabase()
    const res = await GET()
    const body = await res.json()
    const course = body.courses[0]
    expect(course).toHaveProperty('id')
    expect(course).toHaveProperty('title')
    expect(course).toHaveProperty('slug')
    expect(course).toHaveProperty('zone')
    expect(course).toHaveProperty('status')
    expect(course).toHaveProperty('updated_at')
    expect(course).toHaveProperty('lesson_count')
    expect(course).toHaveProperty('enrollment_count')
  })
})
