import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the Supabase server client before importing routes
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createRequest(
  url: string,
  method: string,
  body?: unknown
): NextRequest {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new NextRequest(url, init)
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
// Table-aware mock builder
// ---------------------------------------------------------------------------

interface TableMockConfig {
  // Each key is a table name, value is an object mapping operation names
  // to their return values. Operations: select, insert, update, delete, maybeSingle
  [table: string]: {
    selectResult?: unknown
    insertResult?: unknown
    updateResult?: unknown
    deleteResult?: unknown
  }
}

interface MockSupabaseOptions {
  user?: { id: string } | null
  authError?: { message: string } | null
  profile?: { role: string; id: string } | null
  profileError?: { message: string } | null
  tables?: TableMockConfig
}

function setupMockSupabase(options: MockSupabaseOptions = {}) {
  const {
    user = { id: 'admin-id' },
    authError = null,
    profile = { role: 'admin', id: 'admin-id' },
    profileError = null,
    tables = {},
  } = options

  const fromCallLog: Array<{ table: string; operations: string[] }> = []

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    const entry = { table, operations: [] as string[] }
    fromCallLog.push(entry)

    if (table === 'profiles') {
      return createChainMock({ data: profile, error: profileError })
    }

    const config = tables[table] ?? {}

    // Build a proxy that differentiates operation types
    // When .select() is called first → selectResult
    // When .insert() is called first → insertResult
    // When .update() is called first → updateResult
    // When .delete() is called first → deleteResult
    return {
      select: (..._args: unknown[]) => {
        entry.operations.push('select')
        return createChainMock(
          config.selectResult ?? { data: null, error: null }
        )
      },
      insert: (..._args: unknown[]) => {
        entry.operations.push('insert')
        return createChainMock(
          config.insertResult ?? { data: null, error: null }
        )
      },
      update: (..._args: unknown[]) => {
        entry.operations.push('update')
        return createChainMock(
          config.updateResult ?? { data: null, error: null }
        )
      },
      delete: (..._args: unknown[]) => {
        entry.operations.push('delete')
        return createChainMock(
          config.deleteResult ?? { error: null }
        )
      },
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

  return { mockFrom, fromCallLog }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COURSE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const LESSON_ID = 'b1ffcc00-1d1c-4ef9-bb7e-7cc0ce491b22'
const LESSON_ID_2 = 'c2aabb11-2e2d-4a00-8d8f-8dd1df502c33'

const VALID_COURSE_BODY = {
  title: 'Intro to PM',
  slug: 'intro-to-pm',
  description: 'A beginner course',
  zone: 'training',
}

const VALID_LESSON_BODY = {
  title: 'Getting Started',
  slug: 'getting-started',
}

const MOCK_COURSE = {
  id: COURSE_ID,
  title: 'Intro to PM',
  slug: 'intro-to-pm',
  description: 'A beginner course',
  zone: 'training',
  status: 'draft',
  passing_score: 70,
  cover_image_url: null,
  created_by: 'admin-id',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

const MOCK_LESSON = {
  id: LESSON_ID,
  course_id: COURSE_ID,
  title: 'Getting Started',
  slug: 'getting-started',
  content: null,
  status: 'draft',
  order_index: 0,
  duration_minutes: null,
  video_ids: [],
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

// ===========================================================================
// Course CRUD Tests
// ===========================================================================

describe('POST /api/admin/courses', () => {
  let POST: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@/app/api/admin/courses/route')
    POST = mod.POST
  })

  it('creates a course with valid data and returns 201', async () => {
    setupMockSupabase({
      tables: {
        courses: {
          // slug uniqueness check → no existing course
          selectResult: { data: null, error: null },
          // insert result
          insertResult: { data: MOCK_COURSE, error: null },
        },
      },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/courses',
      'POST',
      VALID_COURSE_BODY
    )
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.course).toBeDefined()
    expect(body.course.title).toBe('Intro to PM')
  })

  it('returns 400 when title is missing', async () => {
    setupMockSupabase()

    const req = createRequest(
      'http://localhost:3000/api/admin/courses',
      'POST',
      { slug: 'no-title' }
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  it('returns 400 when slug is missing', async () => {
    setupMockSupabase()

    const req = createRequest(
      'http://localhost:3000/api/admin/courses',
      'POST',
      { title: 'No Slug Course' }
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when slug has invalid format', async () => {
    setupMockSupabase()

    const req = createRequest(
      'http://localhost:3000/api/admin/courses',
      'POST',
      { title: 'Test', slug: 'INVALID SLUG!' }
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 409 when slug already exists', async () => {
    setupMockSupabase({
      tables: {
        courses: {
          // slug uniqueness check → existing course found
          selectResult: { data: { id: 'existing-id' }, error: null },
        },
      },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/courses',
      'POST',
      VALID_COURSE_BODY
    )
    const res = await POST(req)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('slug already exists')
  })

  it('returns 401 for unauthenticated user', async () => {
    setupMockSupabase({ user: null, authError: { message: 'Not auth' } })

    const req = createRequest(
      'http://localhost:3000/api/admin/courses',
      'POST',
      VALID_COURSE_BODY
    )
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'employee', id: 'emp-id' } })

    const req = createRequest(
      'http://localhost:3000/api/admin/courses',
      'POST',
      VALID_COURSE_BODY
    )
    const res = await POST(req)
    expect(res.status).toBe(403)
  })
})

describe('GET /api/admin/courses/[courseId]', () => {
  let GET: (
    request: NextRequest,
    context: { params: Promise<{ courseId: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import(
      '@/app/api/admin/courses/[courseId]/route'
    )
    GET = mod.GET
  })

  it('returns 200 with course data for an existing course', async () => {
    setupMockSupabase({
      tables: {
        courses: {
          selectResult: { data: MOCK_COURSE, error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}`,
      'GET'
    )
    const res = await GET(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.course.id).toBe(COURSE_ID)
    expect(body.course.title).toBe('Intro to PM')
  })

  it('returns 404 for a non-existent course', async () => {
    setupMockSupabase({
      tables: {
        courses: {
          selectResult: { data: null, error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}`,
      'GET'
    )
    const res = await GET(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 401 for unauthenticated user', async () => {
    setupMockSupabase({ user: null, authError: { message: 'Not auth' } })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}`,
      'GET'
    )
    const res = await GET(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/admin/courses/[courseId]', () => {
  let PATCH: (
    request: NextRequest,
    context: { params: Promise<{ courseId: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import(
      '@/app/api/admin/courses/[courseId]/route'
    )
    PATCH = mod.PATCH
  })

  it('updates a course with valid data and returns 200', async () => {
    const updatedCourse = { ...MOCK_COURSE, title: 'Updated Title' }
    setupMockSupabase({
      tables: {
        courses: {
          // First select: verify course exists
          selectResult: { data: { id: COURSE_ID }, error: null },
          // Update result
          updateResult: { data: updatedCourse, error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}`,
      'PATCH',
      { title: 'Updated Title' }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.course.title).toBe('Updated Title')
  })

  it('returns 404 when course does not exist', async () => {
    setupMockSupabase({
      tables: {
        courses: {
          selectResult: { data: null, error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}`,
      'PATCH',
      { title: 'New Title' }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 when no fields to update', async () => {
    setupMockSupabase()

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}`,
      'PATCH',
      {}
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('No fields to update')
  })

  it('returns 400 for invalid JSON body', async () => {
    setupMockSupabase()

    // Create a request with invalid JSON
    const req = new NextRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json{{{',
      }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'employee', id: 'emp-id' } })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}`,
      'PATCH',
      { title: 'Hacked Title' }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/admin/courses/[courseId]', () => {
  let DELETE: (
    request: NextRequest,
    context: { params: Promise<{ courseId: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import(
      '@/app/api/admin/courses/[courseId]/route'
    )
    DELETE = mod.DELETE
  })

  it('deletes an existing course and returns 200', async () => {
    setupMockSupabase({
      tables: {
        courses: {
          selectResult: { data: { id: COURSE_ID }, error: null },
          deleteResult: { error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}`,
      'DELETE'
    )
    const res = await DELETE(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 404 for a non-existent course', async () => {
    setupMockSupabase({
      tables: {
        courses: {
          selectResult: { data: null, error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}`,
      'DELETE'
    )
    const res = await DELETE(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 401 for unauthenticated user', async () => {
    setupMockSupabase({ user: null, authError: { message: 'Not auth' } })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}`,
      'DELETE'
    )
    const res = await DELETE(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(401)
  })
})

// ===========================================================================
// Lesson CRUD Tests
// ===========================================================================

describe('GET /api/admin/courses/[courseId]/lessons', () => {
  let GET: (
    request: NextRequest,
    context: { params: Promise<{ courseId: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import(
      '@/app/api/admin/courses/[courseId]/lessons/route'
    )
    GET = mod.GET
  })

  it('returns ordered lessons for a course', async () => {
    const mockLessons = [
      { ...MOCK_LESSON, order_index: 0 },
      { ...MOCK_LESSON, id: LESSON_ID_2, title: 'Lesson 2', order_index: 1 },
    ]

    setupMockSupabase({
      tables: {
        courses: {
          selectResult: { data: { id: COURSE_ID }, error: null },
        },
        lessons: {
          selectResult: { data: mockLessons, error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons`,
      'GET'
    )
    const res = await GET(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.lessons).toHaveLength(2)
  })

  it('returns 404 if course does not exist', async () => {
    setupMockSupabase({
      tables: {
        courses: {
          selectResult: { data: null, error: { message: 'not found' } },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons`,
      'GET'
    )
    const res = await GET(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'employee', id: 'emp-id' } })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons`,
      'GET'
    )
    const res = await GET(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(403)
  })
})

describe('POST /api/admin/courses/[courseId]/lessons', () => {
  let POST: (
    request: NextRequest,
    context: { params: Promise<{ courseId: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import(
      '@/app/api/admin/courses/[courseId]/lessons/route'
    )
    POST = mod.POST
  })

  it('creates a lesson with auto-assigned order_index and returns 201', async () => {
    setupMockSupabase({
      tables: {
        courses: {
          selectResult: { data: { id: COURSE_ID }, error: null },
        },
        lessons: {
          // First select: slug uniqueness → no duplicate
          // Second select: last lesson for order_index → none
          selectResult: { data: null, error: null },
          insertResult: {
            data: { ...MOCK_LESSON, order_index: 0 },
            error: null,
          },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons`,
      'POST',
      VALID_LESSON_BODY
    )
    const res = await POST(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.lesson).toBeDefined()
    expect(body.lesson.title).toBe('Getting Started')
  })

  it('returns 400 for missing title', async () => {
    setupMockSupabase({
      tables: {
        courses: {
          selectResult: { data: { id: COURSE_ID }, error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons`,
      'POST',
      { slug: 'no-title' }
    )
    const res = await POST(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 409 for duplicate slug within the same course', async () => {
    setupMockSupabase({
      tables: {
        courses: {
          selectResult: { data: { id: COURSE_ID }, error: null },
        },
        lessons: {
          // slug uniqueness check → existing lesson found
          selectResult: { data: { id: 'existing-lesson' }, error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons`,
      'POST',
      VALID_LESSON_BODY
    )
    const res = await POST(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('slug already exists')
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'sales', id: 'sales-id' } })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons`,
      'POST',
      VALID_LESSON_BODY
    )
    const res = await POST(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/admin/courses/[courseId]/lessons/[lessonId]', () => {
  let PATCH: (
    request: NextRequest,
    context: { params: Promise<{ courseId: string; lessonId: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import(
      '@/app/api/admin/courses/[courseId]/lessons/[lessonId]/route'
    )
    PATCH = mod.PATCH
  })

  it('updates lesson content (auto-save) and returns 200', async () => {
    const updatedLesson = {
      ...MOCK_LESSON,
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    }

    setupMockSupabase({
      tables: {
        lessons: {
          // First select: verify lesson exists
          selectResult: {
            data: { id: LESSON_ID, slug: 'getting-started' },
            error: null,
          },
          updateResult: { data: updatedLesson, error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons/${LESSON_ID}`,
      'PATCH',
      { content: { type: 'doc', content: [{ type: 'paragraph' }] } }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ courseId: COURSE_ID, lessonId: LESSON_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.lesson.content).toBeDefined()
  })

  it('returns 404 when lesson does not exist', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: null, error: { message: 'not found' } },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons/${LESSON_ID}`,
      'PATCH',
      { title: 'New Title' }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ courseId: COURSE_ID, lessonId: LESSON_ID }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 when no fields to update', async () => {
    setupMockSupabase()

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons/${LESSON_ID}`,
      'PATCH',
      {}
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ courseId: COURSE_ID, lessonId: LESSON_ID }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'employee', id: 'emp-id' } })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons/${LESSON_ID}`,
      'PATCH',
      { title: 'Hacked' }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ courseId: COURSE_ID, lessonId: LESSON_ID }),
    })
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/admin/courses/[courseId]/lessons/[lessonId]', () => {
  let DELETE: (
    request: NextRequest,
    context: { params: Promise<{ courseId: string; lessonId: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import(
      '@/app/api/admin/courses/[courseId]/lessons/[lessonId]/route'
    )
    DELETE = mod.DELETE
  })

  it('deletes a lesson and returns 200', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: {
            data: { id: LESSON_ID, order_index: 0 },
            error: null,
          },
          deleteResult: { error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons/${LESSON_ID}`,
      'DELETE'
    )
    const res = await DELETE(req, {
      params: Promise.resolve({ courseId: COURSE_ID, lessonId: LESSON_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 404 when lesson does not exist', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: null, error: { message: 'not found' } },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons/${LESSON_ID}`,
      'DELETE'
    )
    const res = await DELETE(req, {
      params: Promise.resolve({ courseId: COURSE_ID, lessonId: LESSON_ID }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'employee', id: 'emp-id' } })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons/${LESSON_ID}`,
      'DELETE'
    )
    const res = await DELETE(req, {
      params: Promise.resolve({ courseId: COURSE_ID, lessonId: LESSON_ID }),
    })
    expect(res.status).toBe(403)
  })
})

// ===========================================================================
// Lesson Reorder Tests
// ===========================================================================

describe('PATCH /api/admin/courses/[courseId]/lessons/reorder', () => {
  let PATCH: (
    request: NextRequest,
    context: { params: Promise<{ courseId: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import(
      '@/app/api/admin/courses/[courseId]/lessons/reorder/route'
    )
    PATCH = mod.PATCH
  })

  it('reorders lessons successfully and returns 200', async () => {
    setupMockSupabase({
      tables: {
        courses: {
          selectResult: { data: { id: COURSE_ID }, error: null },
        },
        lessons: {
          selectResult: {
            data: [{ id: LESSON_ID }, { id: LESSON_ID_2 }],
            error: null,
          },
          updateResult: { error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons/reorder`,
      'PATCH',
      { lessonIds: [LESSON_ID_2, LESSON_ID] }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.order).toEqual([LESSON_ID_2, LESSON_ID])
  })

  it('returns 400 when lessonIds array is empty', async () => {
    setupMockSupabase({
      tables: {
        courses: {
          selectResult: { data: { id: COURSE_ID }, error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons/reorder`,
      'PATCH',
      { lessonIds: [] }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when lesson IDs do not belong to the course', async () => {
    const foreignId = 'dddddddd-dddd-4ddd-addd-dddddddddddd'
    setupMockSupabase({
      tables: {
        courses: {
          selectResult: { data: { id: COURSE_ID }, error: null },
        },
        lessons: {
          selectResult: {
            data: [{ id: LESSON_ID }],
            error: null,
          },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons/reorder`,
      'PATCH',
      { lessonIds: [foreignId] }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('do not belong')
  })

  it('returns 400 when not all lessons are included', async () => {
    setupMockSupabase({
      tables: {
        courses: {
          selectResult: { data: { id: COURSE_ID }, error: null },
        },
        lessons: {
          selectResult: {
            data: [{ id: LESSON_ID }, { id: LESSON_ID_2 }],
            error: null,
          },
        },
      },
    })

    // Only send one of the two lessons
    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons/reorder`,
      'PATCH',
      { lessonIds: [LESSON_ID] }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Expected 2')
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'employee', id: 'emp-id' } })

    const req = createRequest(
      `http://localhost:3000/api/admin/courses/${COURSE_ID}/lessons/reorder`,
      'PATCH',
      { lessonIds: [LESSON_ID] }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ courseId: COURSE_ID }),
    })
    expect(res.status).toBe(403)
  })
})
