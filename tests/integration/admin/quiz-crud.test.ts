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

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'profiles') {
      return createChainMock({ data: profile, error: profileError })
    }

    const config = tables[table] ?? {}

    return {
      select: (..._args: unknown[]) => {
        return createChainMock(
          config.selectResult ?? { data: null, error: null }
        )
      },
      insert: (..._args: unknown[]) => {
        return createChainMock(
          config.insertResult ?? { data: null, error: null }
        )
      },
      update: (..._args: unknown[]) => {
        return createChainMock(
          config.updateResult ?? { data: null, error: null }
        )
      },
      delete: (..._args: unknown[]) => {
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

  return { mockFrom }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COURSE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const LESSON_ID = 'b1ffcc00-1d1c-4ef9-bb7e-7cc0ce491b22'
const QUIZ_ID = 'c2aabb11-2e2d-4a00-8d8f-8dd1df502c33'
const QUESTION_ID = 'd3bbcc22-3f3e-4b11-9e9f-9ee2ef613d44'
const QUESTION_ID_2 = 'e4ccdd33-4a4f-4c22-afa0-aff3fa724e55'

const BASE_URL = 'http://localhost:3000'
const QUIZ_URL = `${BASE_URL}/api/admin/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`
const QUESTIONS_URL = `${QUIZ_URL}/questions`

const MOCK_QUIZ = {
  id: QUIZ_ID,
  lesson_id: LESSON_ID,
  title: 'Lesson Quiz',
  passing_score: 70,
  created_at: '2025-01-01T00:00:00Z',
}

const MOCK_QUESTION = {
  id: QUESTION_ID,
  quiz_id: QUIZ_ID,
  question_text: 'What is PM?',
  question_type: 'multiple_choice',
  options: [
    { text: 'Product Management', is_correct: true },
    { text: 'Project Management', is_correct: false },
  ],
  correct_answer: null,
  rubric: null,
  max_points: 10,
  order_index: 0,
  created_at: '2025-01-01T00:00:00Z',
}

const makeParams = () =>
  Promise.resolve({ courseId: COURSE_ID, lessonId: LESSON_ID })

const makeQuestionParams = (questionId: string = QUESTION_ID) =>
  Promise.resolve({ courseId: COURSE_ID, lessonId: LESSON_ID, questionId })

// ===========================================================================
// Quiz CRUD Tests
// ===========================================================================

describe('GET /api/admin/courses/[courseId]/lessons/[lessonId]/quiz', () => {
  let GET: (
    request: NextRequest,
    context: { params: Promise<{ courseId: string; lessonId: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import(
      '@/app/api/admin/courses/[courseId]/lessons/[lessonId]/quiz/route'
    )
    GET = mod.GET
  })

  it('returns quiz with questions when quiz exists', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: MOCK_QUIZ, error: null },
        },
        questions: {
          selectResult: { data: [MOCK_QUESTION], error: null },
        },
      },
    })

    const req = createRequest(QUIZ_URL, 'GET')
    const res = await GET(req, { params: makeParams() })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.quiz).toBeDefined()
    expect(body.quiz.id).toBe(QUIZ_ID)
    expect(body.quiz.questions).toHaveLength(1)
  })

  it('returns { quiz: null } when no quiz exists', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: null, error: null },
        },
      },
    })

    const req = createRequest(QUIZ_URL, 'GET')
    const res = await GET(req, { params: makeParams() })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.quiz).toBeNull()
  })

  it('returns 404 when lesson does not exist', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: null, error: { message: 'not found' } },
        },
      },
    })

    const req = createRequest(QUIZ_URL, 'GET')
    const res = await GET(req, { params: makeParams() })
    expect(res.status).toBe(404)
  })

  it('returns 401 for unauthenticated user', async () => {
    setupMockSupabase({ user: null, authError: { message: 'Not auth' } })

    const req = createRequest(QUIZ_URL, 'GET')
    const res = await GET(req, { params: makeParams() })
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'employee', id: 'emp-id' } })

    const req = createRequest(QUIZ_URL, 'GET')
    const res = await GET(req, { params: makeParams() })
    expect(res.status).toBe(403)
  })
})

describe('POST /api/admin/courses/[courseId]/lessons/[lessonId]/quiz', () => {
  let POST: (
    request: NextRequest,
    context: { params: Promise<{ courseId: string; lessonId: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import(
      '@/app/api/admin/courses/[courseId]/lessons/[lessonId]/quiz/route'
    )
    POST = mod.POST
  })

  it('creates a quiz and returns 201', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: null, error: null },
          insertResult: { data: MOCK_QUIZ, error: null },
        },
      },
    })

    const req = createRequest(QUIZ_URL, 'POST', {
      title: 'Lesson Quiz',
      passing_score: 70,
    })
    const res = await POST(req, { params: makeParams() })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.quiz).toBeDefined()
    expect(body.quiz.title).toBe('Lesson Quiz')
  })

  it('creates a quiz with default passing_score when not provided', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: null, error: null },
          insertResult: { data: { ...MOCK_QUIZ, passing_score: 70 }, error: null },
        },
      },
    })

    const req = createRequest(QUIZ_URL, 'POST', {})
    const res = await POST(req, { params: makeParams() })
    expect(res.status).toBe(201)
  })

  it('returns 409 when quiz already exists for the lesson', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
      },
    })

    const req = createRequest(QUIZ_URL, 'POST', { title: 'Duplicate' })
    const res = await POST(req, { params: makeParams() })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('already exists')
  })

  it('returns 404 when lesson does not exist', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: null, error: { message: 'not found' } },
        },
      },
    })

    const req = createRequest(QUIZ_URL, 'POST', { title: 'Test' })
    const res = await POST(req, { params: makeParams() })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid passing_score', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: null, error: null },
        },
      },
    })

    const req = createRequest(QUIZ_URL, 'POST', { passing_score: 150 })
    const res = await POST(req, { params: makeParams() })
    expect(res.status).toBe(400)
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'employee', id: 'emp-id' } })

    const req = createRequest(QUIZ_URL, 'POST', { title: 'Hacked' })
    const res = await POST(req, { params: makeParams() })
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/admin/courses/[courseId]/lessons/[lessonId]/quiz', () => {
  let PATCH: (
    request: NextRequest,
    context: { params: Promise<{ courseId: string; lessonId: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import(
      '@/app/api/admin/courses/[courseId]/lessons/[lessonId]/quiz/route'
    )
    PATCH = mod.PATCH
  })

  it('updates quiz metadata and returns 200', async () => {
    const updatedQuiz = { ...MOCK_QUIZ, title: 'Updated Quiz', passing_score: 80 }
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
          updateResult: { data: updatedQuiz, error: null },
        },
      },
    })

    const req = createRequest(QUIZ_URL, 'PATCH', {
      title: 'Updated Quiz',
      passing_score: 80,
    })
    const res = await PATCH(req, { params: makeParams() })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.quiz.title).toBe('Updated Quiz')
    expect(body.quiz.passing_score).toBe(80)
  })

  it('returns 404 when no quiz exists for the lesson', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: null, error: null },
        },
      },
    })

    const req = createRequest(QUIZ_URL, 'PATCH', { title: 'New Title' })
    const res = await PATCH(req, { params: makeParams() })
    expect(res.status).toBe(404)
  })

  it('returns 400 when no fields to update', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
      },
    })

    const req = createRequest(QUIZ_URL, 'PATCH', {})
    const res = await PATCH(req, { params: makeParams() })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('No fields to update')
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'sales', id: 'sales-id' } })

    const req = createRequest(QUIZ_URL, 'PATCH', { title: 'Hacked' })
    const res = await PATCH(req, { params: makeParams() })
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/admin/courses/[courseId]/lessons/[lessonId]/quiz', () => {
  let DELETE: (
    request: NextRequest,
    context: { params: Promise<{ courseId: string; lessonId: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import(
      '@/app/api/admin/courses/[courseId]/lessons/[lessonId]/quiz/route'
    )
    DELETE = mod.DELETE
  })

  it('deletes the quiz and returns 200', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
          deleteResult: { error: null },
        },
      },
    })

    const req = createRequest(QUIZ_URL, 'DELETE')
    const res = await DELETE(req, { params: makeParams() })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 404 when no quiz exists', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: null, error: null },
        },
      },
    })

    const req = createRequest(QUIZ_URL, 'DELETE')
    const res = await DELETE(req, { params: makeParams() })
    expect(res.status).toBe(404)
  })

  it('returns 404 when lesson does not exist', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: null, error: { message: 'not found' } },
        },
      },
    })

    const req = createRequest(QUIZ_URL, 'DELETE')
    const res = await DELETE(req, { params: makeParams() })
    expect(res.status).toBe(404)
  })

  it('returns 401 for unauthenticated user', async () => {
    setupMockSupabase({ user: null, authError: { message: 'Not auth' } })

    const req = createRequest(QUIZ_URL, 'DELETE')
    const res = await DELETE(req, { params: makeParams() })
    expect(res.status).toBe(401)
  })
})

// ===========================================================================
// Question CRUD Tests
// ===========================================================================

describe('GET /api/admin/.../quiz/questions', () => {
  let GET: (
    request: NextRequest,
    context: { params: Promise<{ courseId: string; lessonId: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import(
      '@/app/api/admin/courses/[courseId]/lessons/[lessonId]/quiz/questions/route'
    )
    GET = mod.GET
  })

  it('returns questions ordered by order_index', async () => {
    const questions = [
      { ...MOCK_QUESTION, order_index: 0 },
      { ...MOCK_QUESTION, id: QUESTION_ID_2, order_index: 1 },
    ]
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
        questions: {
          selectResult: { data: questions, error: null },
        },
      },
    })

    const req = createRequest(QUESTIONS_URL, 'GET')
    const res = await GET(req, { params: makeParams() })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.questions).toHaveLength(2)
  })

  it('returns 404 when no quiz exists for the lesson', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: null, error: null },
        },
      },
    })

    const req = createRequest(QUESTIONS_URL, 'GET')
    const res = await GET(req, { params: makeParams() })
    expect(res.status).toBe(404)
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'employee', id: 'emp-id' } })

    const req = createRequest(QUESTIONS_URL, 'GET')
    const res = await GET(req, { params: makeParams() })
    expect(res.status).toBe(403)
  })
})

describe('POST /api/admin/.../quiz/questions', () => {
  let POST: (
    request: NextRequest,
    context: { params: Promise<{ courseId: string; lessonId: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import(
      '@/app/api/admin/courses/[courseId]/lessons/[lessonId]/quiz/questions/route'
    )
    POST = mod.POST
  })

  it('creates a multiple_choice question with auto order_index', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
        questions: {
          // last question lookup for auto order_index
          selectResult: { data: null, error: null },
          insertResult: { data: MOCK_QUESTION, error: null },
        },
      },
    })

    const req = createRequest(QUESTIONS_URL, 'POST', {
      question_text: 'What is PM?',
      question_type: 'multiple_choice',
      options: [
        { text: 'Product Management', is_correct: true },
        { text: 'Project Management', is_correct: false },
      ],
    })
    const res = await POST(req, { params: makeParams() })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.question).toBeDefined()
  })

  it('creates a true_false question with auto-generated options', async () => {
    const tfQuestion = {
      ...MOCK_QUESTION,
      question_type: 'true_false',
      correct_answer: 'true',
      options: [
        { text: 'True', is_correct: true },
        { text: 'False', is_correct: false },
      ],
    }
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
        questions: {
          selectResult: { data: null, error: null },
          insertResult: { data: tfQuestion, error: null },
        },
      },
    })

    const req = createRequest(QUESTIONS_URL, 'POST', {
      question_text: 'PM stands for Product Management',
      question_type: 'true_false',
      correct_answer: 'true',
    })
    const res = await POST(req, { params: makeParams() })
    expect(res.status).toBe(201)
  })

  it('creates an open_ended question with rubric', async () => {
    const oeQuestion = {
      ...MOCK_QUESTION,
      question_type: 'open_ended',
      rubric: 'Mention stakeholder management',
      options: null,
    }
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
        questions: {
          selectResult: { data: null, error: null },
          insertResult: { data: oeQuestion, error: null },
        },
      },
    })

    const req = createRequest(QUESTIONS_URL, 'POST', {
      question_text: 'Describe the role of a PM',
      question_type: 'open_ended',
      rubric: 'Mention stakeholder management',
    })
    const res = await POST(req, { params: makeParams() })
    expect(res.status).toBe(201)
  })

  it('returns 400 when multiple_choice has fewer than 2 options', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
      },
    })

    const req = createRequest(QUESTIONS_URL, 'POST', {
      question_text: 'What is PM?',
      question_type: 'multiple_choice',
      options: [{ text: 'Only one', is_correct: true }],
    })
    const res = await POST(req, { params: makeParams() })
    expect(res.status).toBe(400)
  })

  it('returns 400 when multiple_choice has no correct option', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
      },
    })

    const req = createRequest(QUESTIONS_URL, 'POST', {
      question_text: 'What is PM?',
      question_type: 'multiple_choice',
      options: [
        { text: 'A', is_correct: false },
        { text: 'B', is_correct: false },
      ],
    })
    const res = await POST(req, { params: makeParams() })
    expect(res.status).toBe(400)
  })

  it('returns 400 when true_false has invalid correct_answer', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
      },
    })

    const req = createRequest(QUESTIONS_URL, 'POST', {
      question_text: 'Is this true?',
      question_type: 'true_false',
      correct_answer: 'maybe',
    })
    const res = await POST(req, { params: makeParams() })
    expect(res.status).toBe(400)
  })

  it('returns 400 when open_ended has no rubric', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
      },
    })

    const req = createRequest(QUESTIONS_URL, 'POST', {
      question_text: 'Explain PM',
      question_type: 'open_ended',
    })
    const res = await POST(req, { params: makeParams() })
    expect(res.status).toBe(400)
  })

  it('returns 400 when question_text is missing', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
      },
    })

    const req = createRequest(QUESTIONS_URL, 'POST', {
      question_type: 'multiple_choice',
      options: [
        { text: 'A', is_correct: true },
        { text: 'B', is_correct: false },
      ],
    })
    const res = await POST(req, { params: makeParams() })
    expect(res.status).toBe(400)
  })

  it('returns 404 when no quiz exists for the lesson', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: null, error: null },
        },
      },
    })

    const req = createRequest(QUESTIONS_URL, 'POST', {
      question_text: 'Test',
      question_type: 'multiple_choice',
      options: [
        { text: 'A', is_correct: true },
        { text: 'B', is_correct: false },
      ],
    })
    const res = await POST(req, { params: makeParams() })
    expect(res.status).toBe(404)
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'employee', id: 'emp-id' } })

    const req = createRequest(QUESTIONS_URL, 'POST', {
      question_text: 'Hacked',
      question_type: 'multiple_choice',
      options: [
        { text: 'A', is_correct: true },
        { text: 'B', is_correct: false },
      ],
    })
    const res = await POST(req, { params: makeParams() })
    expect(res.status).toBe(403)
  })
})

// ===========================================================================
// Individual Question Routes
// ===========================================================================

describe('PATCH /api/admin/.../quiz/questions/[questionId]', () => {
  let PATCH: (
    request: NextRequest,
    context: {
      params: Promise<{ courseId: string; lessonId: string; questionId: string }>
    }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import(
      '@/app/api/admin/courses/[courseId]/lessons/[lessonId]/quiz/questions/[questionId]/route'
    )
    PATCH = mod.PATCH
  })

  it('updates a question and returns 200', async () => {
    const updatedQuestion = { ...MOCK_QUESTION, question_text: 'Updated question?' }
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
        questions: {
          selectResult: { data: MOCK_QUESTION, error: null },
          updateResult: { data: updatedQuestion, error: null },
        },
      },
    })

    const req = createRequest(`${QUESTIONS_URL}/${QUESTION_ID}`, 'PATCH', {
      question_text: 'Updated question?',
    })
    const res = await PATCH(req, { params: makeQuestionParams() })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.question.question_text).toBe('Updated question?')
  })

  it('returns 404 when question does not exist', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
        questions: {
          selectResult: { data: null, error: { message: 'not found' } },
        },
      },
    })

    const req = createRequest(`${QUESTIONS_URL}/${QUESTION_ID}`, 'PATCH', {
      question_text: 'Missing',
    })
    const res = await PATCH(req, { params: makeQuestionParams() })
    expect(res.status).toBe(404)
  })

  it('returns 400 when no fields to update', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
        questions: {
          selectResult: { data: MOCK_QUESTION, error: null },
        },
      },
    })

    const req = createRequest(`${QUESTIONS_URL}/${QUESTION_ID}`, 'PATCH', {})
    const res = await PATCH(req, { params: makeQuestionParams() })
    expect(res.status).toBe(400)
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'employee', id: 'emp-id' } })

    const req = createRequest(`${QUESTIONS_URL}/${QUESTION_ID}`, 'PATCH', {
      question_text: 'Hacked',
    })
    const res = await PATCH(req, { params: makeQuestionParams() })
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/admin/.../quiz/questions/[questionId]', () => {
  let DELETE: (
    request: NextRequest,
    context: {
      params: Promise<{ courseId: string; lessonId: string; questionId: string }>
    }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import(
      '@/app/api/admin/courses/[courseId]/lessons/[lessonId]/quiz/questions/[questionId]/route'
    )
    DELETE = mod.DELETE
  })

  it('deletes a question and returns 200', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
        questions: {
          selectResult: { data: { id: QUESTION_ID, order_index: 0 }, error: null },
          deleteResult: { error: null },
        },
      },
    })

    const req = createRequest(`${QUESTIONS_URL}/${QUESTION_ID}`, 'DELETE')
    const res = await DELETE(req, { params: makeQuestionParams() })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 404 when question does not exist', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
        questions: {
          selectResult: { data: null, error: { message: 'not found' } },
        },
      },
    })

    const req = createRequest(`${QUESTIONS_URL}/${QUESTION_ID}`, 'DELETE')
    const res = await DELETE(req, { params: makeQuestionParams() })
    expect(res.status).toBe(404)
  })

  it('returns 404 when no quiz exists', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: null, error: null },
        },
      },
    })

    const req = createRequest(`${QUESTIONS_URL}/${QUESTION_ID}`, 'DELETE')
    const res = await DELETE(req, { params: makeQuestionParams() })
    expect(res.status).toBe(404)
  })

  it('returns 401 for unauthenticated user', async () => {
    setupMockSupabase({ user: null, authError: { message: 'Not auth' } })

    const req = createRequest(`${QUESTIONS_URL}/${QUESTION_ID}`, 'DELETE')
    const res = await DELETE(req, { params: makeQuestionParams() })
    expect(res.status).toBe(401)
  })
})

// ===========================================================================
// Reorder Tests
// ===========================================================================

describe('PATCH /api/admin/.../quiz/questions/reorder', () => {
  let PATCH: (
    request: NextRequest,
    context: { params: Promise<{ courseId: string; lessonId: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import(
      '@/app/api/admin/courses/[courseId]/lessons/[lessonId]/quiz/questions/reorder/route'
    )
    PATCH = mod.PATCH
  })

  it('reorders questions successfully', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
        questions: {
          selectResult: {
            data: [{ id: QUESTION_ID }, { id: QUESTION_ID_2 }],
            error: null,
          },
          updateResult: { error: null },
        },
      },
    })

    const req = createRequest(`${QUESTIONS_URL}/reorder`, 'PATCH', {
      questionIds: [QUESTION_ID_2, QUESTION_ID],
    })
    const res = await PATCH(req, { params: makeParams() })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 400 when questionIds array is empty', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
      },
    })

    const req = createRequest(`${QUESTIONS_URL}/reorder`, 'PATCH', {
      questionIds: [],
    })
    const res = await PATCH(req, { params: makeParams() })
    expect(res.status).toBe(400)
  })

  it('returns 400 when question IDs do not match quiz questions', async () => {
    const foreignId = 'ffffffff-ffff-4fff-afff-ffffffffffff'
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
        questions: {
          selectResult: {
            data: [{ id: QUESTION_ID }],
            error: null,
          },
        },
      },
    })

    const req = createRequest(`${QUESTIONS_URL}/reorder`, 'PATCH', {
      questionIds: [foreignId],
    })
    const res = await PATCH(req, { params: makeParams() })
    expect(res.status).toBe(400)
  })

  it('returns 400 for duplicate question IDs', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: { id: QUIZ_ID }, error: null },
        },
        questions: {
          selectResult: {
            data: [{ id: QUESTION_ID }, { id: QUESTION_ID_2 }],
            error: null,
          },
        },
      },
    })

    const req = createRequest(`${QUESTIONS_URL}/reorder`, 'PATCH', {
      questionIds: [QUESTION_ID, QUESTION_ID],
    })
    const res = await PATCH(req, { params: makeParams() })
    expect(res.status).toBe(400)
  })

  it('returns 404 when no quiz exists', async () => {
    setupMockSupabase({
      tables: {
        lessons: {
          selectResult: { data: { id: LESSON_ID }, error: null },
        },
        quizzes: {
          selectResult: { data: null, error: null },
        },
      },
    })

    const req = createRequest(`${QUESTIONS_URL}/reorder`, 'PATCH', {
      questionIds: [QUESTION_ID],
    })
    const res = await PATCH(req, { params: makeParams() })
    expect(res.status).toBe(404)
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'employee', id: 'emp-id' } })

    const req = createRequest(`${QUESTIONS_URL}/reorder`, 'PATCH', {
      questionIds: [QUESTION_ID],
    })
    const res = await PATCH(req, { params: makeParams() })
    expect(res.status).toBe(403)
  })
})
