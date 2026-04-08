import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the Supabase server client + service client before importing routes
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

// Mock requireCrmAccess for CRM routes
vi.mock('@/lib/auth/requireCrmAccess', () => ({
  requireCrmAccess: vi.fn(),
}))

import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { createServiceClient } from '@/lib/supabase/server'

const mockRequireCrmAccess = vi.mocked(requireCrmAccess)
const mockCreateServiceClient = vi.mocked(createServiceClient)

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
// Auth + Supabase mock setup
// ---------------------------------------------------------------------------

interface MockSetupOptions {
  authError?: { message: string; status: number } | null
  profile?: { id: string; role: string } | null
  tables?: Record<
    string,
    {
      selectResult?: unknown
      insertResult?: unknown
      updateResult?: unknown
      deleteResult?: unknown
    }
  >
  serviceTables?: Record<
    string,
    {
      selectResult?: unknown
      insertResult?: unknown
      updateResult?: unknown
      deleteResult?: unknown
    }
  >
}

function setupMocks(options: MockSetupOptions = {}) {
  const {
    authError = null,
    profile = { id: 'user-1', role: 'admin' },
    tables = {},
    serviceTables = {},
  } = options

  // Build a from() mock for the main supabase client
  const mockFrom = vi.fn().mockImplementation((table: string) => {
    const config = tables[table] ?? {}
    return {
      select: (..._args: unknown[]) =>
        createChainMock(config.selectResult ?? { data: null, error: null }),
      insert: (..._args: unknown[]) =>
        createChainMock(config.insertResult ?? { data: null, error: null }),
      update: (..._args: unknown[]) =>
        createChainMock(config.updateResult ?? { data: null, error: null }),
      delete: (..._args: unknown[]) =>
        createChainMock(config.deleteResult ?? { error: null }),
    }
  })

  const mockSupabase = { from: mockFrom }

  // Build a from() mock for the service client
  const serviceFrom = vi.fn().mockImplementation((table: string) => {
    const config = serviceTables[table] ?? {}
    return {
      select: (..._args: unknown[]) =>
        createChainMock(config.selectResult ?? { data: null, error: null }),
      insert: (..._args: unknown[]) =>
        createChainMock(config.insertResult ?? { data: null, error: null }),
      update: (..._args: unknown[]) =>
        createChainMock(config.updateResult ?? { data: null, error: null }),
      delete: (..._args: unknown[]) =>
        createChainMock(config.deleteResult ?? { error: null }),
    }
  })

  const mockServiceClient = { from: serviceFrom }

  if (authError) {
    mockRequireCrmAccess.mockResolvedValue({
      error: authError,
      profile: null,
      supabase: mockSupabase as never,
    })
  } else {
    mockRequireCrmAccess.mockResolvedValue({
      error: null,
      profile: profile as never,
      supabase: mockSupabase as never,
    })
  }

  mockCreateServiceClient.mockReturnValue(mockServiceClient as never)

  return { mockFrom, serviceFrom, mockSupabase, mockServiceClient }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TASK_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const USER_ID = 'user-1'
const ASSIGNEE_ID = 'b1ffcc00-1d1c-4ef9-bb7e-7cc0ce491b22'

const VALID_TASK_BODY = {
  subject: 'Follow up with Acme Corp',
  company_id: '550e8400-e29b-41d4-a716-446655440000',
  priority: 1,
  status: 'Not Started',
  assignee_ids: [ASSIGNEE_ID],
}

const MOCK_TASK = {
  id: TASK_ID,
  type: 'task',
  subject: 'Follow up with Acme Corp',
  description: null,
  company_id: '550e8400-e29b-41d4-a716-446655440000',
  contact_id: null,
  opportunity_id: null,
  due_date: '2026-04-10',
  priority: 1,
  status: 'Not Started',
  category: null,
  completed: false,
  created_by: USER_ID,
  activity_date: '2026-04-07T00:00:00Z',
  created_at: '2026-04-07T00:00:00Z',
}

// ===========================================================================
// GET /api/admin/crm/tasks
// ===========================================================================

describe('GET /api/admin/crm/tasks', () => {
  let GET: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@/app/api/admin/crm/tasks/route')
    GET = mod.GET
  })

  it('returns 401 when not authenticated', async () => {
    setupMocks({
      authError: { message: 'Unauthorized', status: 401 },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/crm/tasks',
      'GET'
    )
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns tasks for tab=all with correct shape', async () => {
    const mockTasks = [
      {
        ...MOCK_TASK,
        crm_companies: { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Acme Corp' },
        crm_opportunities: null,
      },
    ]

    setupMocks({
      tables: {
        crm_activities: {
          selectResult: { data: mockTasks, error: null, count: 1 },
        },
      },
      serviceTables: {
        crm_action_owners: {
          selectResult: {
            data: [{ activity_id: TASK_ID, user_id: ASSIGNEE_ID }],
            error: null,
          },
        },
        profiles: {
          selectResult: {
            data: [{ id: ASSIGNEE_ID, full_name: 'Jane Doe' }],
            error: null,
          },
        },
      },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/crm/tasks?tab=all',
      'GET'
    )
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.tasks).toBeDefined()
    expect(body.tasks).toHaveLength(1)
    expect(body.total).toBe(1)

    const task = body.tasks[0]
    expect(task.subject).toBe('Follow up with Acme Corp')
    expect(task.company).toEqual({ id: '550e8400-e29b-41d4-a716-446655440000', name: 'Acme Corp' })
    expect(task.assignees).toEqual([{ user_id: ASSIGNEE_ID, full_name: 'Jane Doe' }])
    // days_overdue should be null or a number
    expect(task).toHaveProperty('days_overdue')
  })

  it('returns filtered tasks for tab=my (checks action_owners)', async () => {
    setupMocks({
      tables: {
        crm_activities: {
          selectResult: { data: [], error: null, count: 0 },
        },
      },
      serviceTables: {
        crm_action_owners: {
          selectResult: { data: [], error: null },
        },
      },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/crm/tasks?tab=my',
      'GET'
    )
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tasks).toEqual([])
  })

  it('returns filtered tasks for tab=overdue', async () => {
    setupMocks({
      tables: {
        crm_activities: {
          selectResult: { data: [], error: null, count: 0 },
        },
      },
      serviceTables: {
        crm_action_owners: {
          selectResult: { data: [], error: null },
        },
      },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/crm/tasks?tab=overdue',
      'GET'
    )
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tasks).toEqual([])
  })

  it('applies status and priority filters', async () => {
    setupMocks({
      tables: {
        crm_activities: {
          selectResult: { data: [], error: null, count: 0 },
        },
      },
      serviceTables: {
        crm_action_owners: {
          selectResult: { data: [], error: null },
        },
      },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/crm/tasks?tab=all&status=In%20Progress&priority=1',
      'GET'
    )
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it('returns 403 for non-CRM role', async () => {
    setupMocks({
      authError: { message: 'Forbidden: CRM access requires admin or sales role', status: 403 },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/crm/tasks',
      'GET'
    )
    const res = await GET(req)
    expect(res.status).toBe(403)
  })
})

// ===========================================================================
// POST /api/admin/crm/tasks
// ===========================================================================

describe('POST /api/admin/crm/tasks', () => {
  let POST: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@/app/api/admin/crm/tasks/route')
    POST = mod.POST
  })

  it('creates a task with valid data and returns 201', async () => {
    setupMocks({
      tables: {
        crm_activities: {
          insertResult: { data: MOCK_TASK, error: null },
        },
      },
      serviceTables: {
        crm_action_owners: {
          insertResult: { data: null, error: null },
        },
      },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/crm/tasks',
      'POST',
      VALID_TASK_BODY
    )
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.task).toBeDefined()
    expect(body.task.subject).toBe('Follow up with Acme Corp')
  })

  it('rejects missing subject with 400', async () => {
    setupMocks()

    const req = createRequest(
      'http://localhost:3000/api/admin/crm/tasks',
      'POST',
      { priority: 1 }
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  it('creates action_owner rows for assignee_ids', async () => {
    const { serviceFrom } = setupMocks({
      tables: {
        crm_activities: {
          insertResult: { data: { ...MOCK_TASK, id: TASK_ID }, error: null },
        },
      },
      serviceTables: {
        crm_action_owners: {
          insertResult: { data: null, error: null },
        },
      },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/crm/tasks',
      'POST',
      {
        subject: 'Test task',
        assignee_ids: [ASSIGNEE_ID],
      }
    )
    const res = await POST(req)
    expect(res.status).toBe(201)

    // Verify that crm_action_owners was called
    expect(serviceFrom).toHaveBeenCalledWith('crm_action_owners')
  })

  it('sets type=task automatically', async () => {
    const { mockFrom } = setupMocks({
      tables: {
        crm_activities: {
          insertResult: { data: { ...MOCK_TASK, type: 'task' }, error: null },
        },
      },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/crm/tasks',
      'POST',
      { subject: 'New task', assignee_ids: [] }
    )
    const res = await POST(req)
    expect(res.status).toBe(201)

    // Verify crm_activities.insert was called
    expect(mockFrom).toHaveBeenCalledWith('crm_activities')
  })

  it('sets completed=true when status is Completed', async () => {
    setupMocks({
      tables: {
        crm_activities: {
          insertResult: {
            data: { ...MOCK_TASK, status: 'Completed', completed: true },
            error: null,
          },
        },
      },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/crm/tasks',
      'POST',
      { subject: 'Done task', status: 'Completed', assignee_ids: [] }
    )
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.task.completed).toBe(true)
  })

  it('returns 401 when not authenticated', async () => {
    setupMocks({
      authError: { message: 'Unauthorized', status: 401 },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/crm/tasks',
      'POST',
      VALID_TASK_BODY
    )
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid JSON body', async () => {
    setupMocks()

    const req = new NextRequest(
      'http://localhost:3000/api/admin/crm/tasks',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json{{{',
      }
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

// ===========================================================================
// GET /api/admin/crm/tasks/[taskId]
// ===========================================================================

describe('GET /api/admin/crm/tasks/[taskId]', () => {
  let GET: (
    request: NextRequest,
    context: { params: Promise<{ taskId: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@/app/api/admin/crm/tasks/[taskId]/route')
    GET = mod.GET
  })

  it('returns single task with assignees', async () => {
    setupMocks({
      tables: {
        crm_activities: {
          selectResult: {
            data: {
              ...MOCK_TASK,
              crm_companies: { id: MOCK_TASK.company_id, name: 'Acme Corp' },
              crm_opportunities: null,
            },
            error: null,
          },
        },
      },
      serviceTables: {
        crm_action_owners: {
          selectResult: {
            data: [{ user_id: ASSIGNEE_ID }],
            error: null,
          },
        },
        profiles: {
          selectResult: {
            data: [{ id: ASSIGNEE_ID, full_name: 'Jane Doe' }],
            error: null,
          },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/crm/tasks/${TASK_ID}`,
      'GET'
    )
    const res = await GET(req, {
      params: Promise.resolve({ taskId: TASK_ID }),
    })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.task).toBeDefined()
    expect(body.task.subject).toBe('Follow up with Acme Corp')
    expect(body.task.company).toEqual({ id: MOCK_TASK.company_id, name: 'Acme Corp' })
    expect(body.task.assignees).toEqual([
      { user_id: ASSIGNEE_ID, full_name: 'Jane Doe' },
    ])
  })

  it('returns 404 for non-existent task', async () => {
    setupMocks({
      tables: {
        crm_activities: {
          selectResult: { data: null, error: { message: 'not found' } },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/crm/tasks/${TASK_ID}`,
      'GET'
    )
    const res = await GET(req, {
      params: Promise.resolve({ taskId: TASK_ID }),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Task not found')
  })

  it('returns 401 when not authenticated', async () => {
    setupMocks({
      authError: { message: 'Unauthorized', status: 401 },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/crm/tasks/${TASK_ID}`,
      'GET'
    )
    const res = await GET(req, {
      params: Promise.resolve({ taskId: TASK_ID }),
    })
    expect(res.status).toBe(401)
  })
})

// ===========================================================================
// PATCH /api/admin/crm/tasks/[taskId]
// ===========================================================================

describe('PATCH /api/admin/crm/tasks/[taskId]', () => {
  let PATCH: (
    request: NextRequest,
    context: { params: Promise<{ taskId: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@/app/api/admin/crm/tasks/[taskId]/route')
    PATCH = mod.PATCH
  })

  it('updates task fields and returns 200', async () => {
    const updatedTask = { ...MOCK_TASK, subject: 'Updated subject' }
    setupMocks({
      tables: {
        crm_activities: {
          updateResult: { data: updatedTask, error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/crm/tasks/${TASK_ID}`,
      'PATCH',
      { subject: 'Updated subject' }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ taskId: TASK_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.task.subject).toBe('Updated subject')
  })

  it('syncs completed boolean with status=Completed', async () => {
    const updatedTask = { ...MOCK_TASK, status: 'Completed', completed: true }
    setupMocks({
      tables: {
        crm_activities: {
          updateResult: { data: updatedTask, error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/crm/tasks/${TASK_ID}`,
      'PATCH',
      { status: 'Completed' }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ taskId: TASK_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.task.completed).toBe(true)
  })

  it('replaces assignees when assignee_ids provided', async () => {
    const { serviceFrom } = setupMocks({
      tables: {
        crm_activities: {
          selectResult: { data: MOCK_TASK, error: null },
        },
      },
      serviceTables: {
        crm_action_owners: {
          deleteResult: { error: null },
          insertResult: { data: null, error: null },
        },
      },
    })

    const newAssigneeId = 'c2aabb11-2e2d-4a00-8d8f-8dd1df502c33'
    const req = createRequest(
      `http://localhost:3000/api/admin/crm/tasks/${TASK_ID}`,
      'PATCH',
      { assignee_ids: [newAssigneeId] }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ taskId: TASK_ID }),
    })
    expect(res.status).toBe(200)

    // Verify crm_action_owners was accessed for delete + insert
    expect(serviceFrom).toHaveBeenCalledWith('crm_action_owners')
  })

  it('returns 400 when no fields provided', async () => {
    setupMocks()

    const req = createRequest(
      `http://localhost:3000/api/admin/crm/tasks/${TASK_ID}`,
      'PATCH',
      {}
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ taskId: TASK_ID }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('No fields to update')
  })

  it('returns 400 for invalid JSON body', async () => {
    setupMocks()

    const req = new NextRequest(
      `http://localhost:3000/api/admin/crm/tasks/${TASK_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json{{{',
      }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ taskId: TASK_ID }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    setupMocks({
      authError: { message: 'Unauthorized', status: 401 },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/crm/tasks/${TASK_ID}`,
      'PATCH',
      { subject: 'Hacked' }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ taskId: TASK_ID }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 404 when task does not exist (PGRST116)', async () => {
    setupMocks({
      tables: {
        crm_activities: {
          updateResult: { data: null, error: { code: 'PGRST116', message: 'not found' } },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/crm/tasks/${TASK_ID}`,
      'PATCH',
      { subject: 'Update non-existent' }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ taskId: TASK_ID }),
    })
    expect(res.status).toBe(404)
  })
})

// ===========================================================================
// GET /api/admin/crm/tasks/stats
// ===========================================================================

describe('GET /api/admin/crm/tasks/stats', () => {
  let GET: () => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@/app/api/admin/crm/tasks/stats/route')
    GET = mod.GET
  })

  it('returns overdue_count, due_today_count, my_tasks_count', async () => {
    const todayStr = new Date().toISOString().split('T')[0]
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0]

    setupMocks({
      serviceTables: {
        crm_action_owners: {
          selectResult: {
            data: [{ activity_id: 'task-1' }, { activity_id: 'task-2' }],
            error: null,
          },
        },
        crm_activities: {
          selectResult: {
            data: [
              { id: 'task-1', due_date: yesterdayStr, status: 'Not Started' },
              { id: 'task-2', due_date: todayStr, status: 'In Progress' },
              { id: 'task-3', due_date: null, status: 'Not Started' },
            ],
            error: null,
          },
        },
      },
    })

    const res = await GET()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('overdue_count')
    expect(body).toHaveProperty('due_today_count')
    expect(body).toHaveProperty('my_tasks_count')
    expect(typeof body.overdue_count).toBe('number')
    expect(typeof body.due_today_count).toBe('number')
    expect(typeof body.my_tasks_count).toBe('number')
  })

  it('returns 401 when not authenticated', async () => {
    setupMocks({
      authError: { message: 'Unauthorized', status: 401 },
    })

    const res = await GET()
    expect(res.status).toBe(401)
  })
})

// ===========================================================================
// GET /api/admin/crm/tasks/assignees
// ===========================================================================

describe('GET /api/admin/crm/tasks/assignees', () => {
  let GET: () => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@/app/api/admin/crm/tasks/assignees/route')
    GET = mod.GET
  })

  it('returns list of admin+sales users with id and full_name', async () => {
    const mockUsers = [
      { id: 'user-1', full_name: 'Alice Admin' },
      { id: 'user-2', full_name: 'Bob Sales' },
    ]

    // The assignees route uses createServiceClient directly (not from requireCrmAccess)
    setupMocks({
      serviceTables: {
        profiles: {
          selectResult: { data: mockUsers, error: null },
        },
      },
    })

    const res = await GET()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.users).toBeDefined()
    expect(body.users).toHaveLength(2)
    expect(body.users[0]).toHaveProperty('id')
    expect(body.users[0]).toHaveProperty('full_name')
  })

  it('returns 401 when not authenticated', async () => {
    setupMocks({
      authError: { message: 'Unauthorized', status: 401 },
    })

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 500 when database query fails', async () => {
    setupMocks({
      serviceTables: {
        profiles: {
          selectResult: { data: null, error: { message: 'DB error' } },
        },
      },
    })

    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to fetch users')
  })
})
