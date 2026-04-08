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
  body?: unknown,
  headers?: Record<string, string>
): NextRequest {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
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
  serviceRpc?: Record<string, unknown>
}

function setupMocks(options: MockSetupOptions = {}) {
  const {
    authError = null,
    profile = { id: 'user-1', role: 'admin' },
    tables = {},
    serviceTables = {},
    serviceRpc = {},
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
      upsert: (..._args: unknown[]) =>
        createChainMock(config.updateResult ?? config.insertResult ?? { data: null, error: null }),
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
      upsert: (..._args: unknown[]) =>
        createChainMock(config.updateResult ?? config.insertResult ?? { data: null, error: null }),
      delete: (..._args: unknown[]) =>
        createChainMock(config.deleteResult ?? { error: null }),
    }
  })

  const mockRpc = vi.fn().mockImplementation((funcName: string) => {
    if (serviceRpc[funcName] !== undefined) {
      return Promise.resolve(serviceRpc[funcName])
    }
    return Promise.resolve({ data: null, error: null })
  })

  const mockServiceClient = { from: serviceFrom, rpc: mockRpc }

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

// ===========================================================================
// GET /api/admin/crm/digest/preferences
// ===========================================================================

describe('GET /api/admin/crm/digest/preferences', () => {
  let GET: () => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@/app/api/admin/crm/digest/preferences/route')
    GET = mod.GET
  })

  it('returns 200 with preferences for authenticated user', async () => {
    const mockPrefs = {
      user_id: 'user-1',
      enabled: true,
      send_time: '08:00',
      timezone: 'America/Los_Angeles',
    }

    setupMocks({
      tables: {
        crm_digest_preferences: {
          selectResult: { data: mockPrefs, error: null },
        },
      },
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.preferences).toBeDefined()
    expect(body.preferences.enabled).toBe(true)
    expect(body.preferences.timezone).toBe('America/Los_Angeles')
  })

  it('returns 401 for unauthenticated user', async () => {
    setupMocks({
      authError: { message: 'Unauthorized', status: 401 },
    })

    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })
})

// ===========================================================================
// PATCH /api/admin/crm/digest/preferences
// ===========================================================================

describe('PATCH /api/admin/crm/digest/preferences', () => {
  let PATCH: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@/app/api/admin/crm/digest/preferences/route')
    PATCH = mod.PATCH
  })

  it('updates preferences with valid data', async () => {
    const updatedPrefs = {
      user_id: 'user-1',
      enabled: false,
      send_time: '09:00',
      timezone: 'America/New_York',
    }

    setupMocks({
      tables: {
        crm_digest_preferences: {
          // upsert uses the same chain as insert/update; mock via selectResult
          // The route uses .upsert().select().single() which resolves via chain
          insertResult: { data: updatedPrefs, error: null },
          updateResult: { data: updatedPrefs, error: null },
          selectResult: { data: updatedPrefs, error: null },
        },
      },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/crm/digest/preferences',
      'PATCH',
      { enabled: false, send_time: '09:00', timezone: 'America/New_York' }
    )
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.preferences).toBeDefined()
  })

  it('rejects invalid timezone', async () => {
    setupMocks()

    const req = createRequest(
      'http://localhost:3000/api/admin/crm/digest/preferences',
      'PATCH',
      { timezone: '' }
    )
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  it('returns 401 for unauthenticated', async () => {
    setupMocks({
      authError: { message: 'Unauthorized', status: 401 },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/crm/digest/preferences',
      'PATCH',
      { enabled: true }
    )
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })
})

// ===========================================================================
// GET /api/admin/crm/digest/stats
// ===========================================================================

describe('GET /api/admin/crm/digest/stats', () => {
  let GET: () => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@/app/api/admin/crm/digest/stats/route')
    GET = mod.GET
  })

  it('returns stats with correct shape (total_sent, total_failed, total_clicks)', async () => {
    const mockLogs = [
      { user_id: 'user-1', sent_at: new Date().toISOString(), items_count: 3, clicked_items: 2, delivery_status: 'sent' },
      { user_id: 'user-2', sent_at: new Date().toISOString(), items_count: 5, clicked_items: 0, delivery_status: 'failed' },
    ]

    const mockProfiles = [
      { id: 'user-1', full_name: 'Alice Admin' },
      { id: 'user-2', full_name: 'Bob Sales' },
    ]

    setupMocks({
      profile: { id: 'user-1', role: 'admin' },
      tables: {
        crm_digest_logs: {
          selectResult: { data: mockLogs, error: null },
        },
        profiles: {
          selectResult: { data: mockProfiles, error: null },
        },
      },
    })

    const res = await GET()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('total_sent')
    expect(body).toHaveProperty('total_failed')
    expect(body).toHaveProperty('total_clicks')
    expect(body).toHaveProperty('period', '7d')
    expect(typeof body.total_sent).toBe('number')
    expect(typeof body.total_failed).toBe('number')
    expect(typeof body.total_clicks).toBe('number')
  })

  it('returns 403 for non-admin users (admin-only endpoint)', async () => {
    setupMocks({
      profile: { id: 'user-2', role: 'sales' },
    })

    const res = await GET()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('admin')
  })
})

// ===========================================================================
// POST /api/admin/crm/digest/send
// ===========================================================================

describe('POST /api/admin/crm/digest/send', () => {
  let POST: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Set env vars for the send route
    process.env.CRON_SECRET = 'test-cron-secret'
    process.env.RESEND_API_KEY = 'test-resend-key'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://throughput.aava.ai'

    // Mock global fetch for Resend API calls
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'email-123' }),
      text: async () => 'OK',
    }))

    const mod = await import('@/app/api/admin/crm/digest/send/route')
    POST = mod.POST
  })

  it('returns 401 without CRON_SECRET bearer token', async () => {
    setupMocks()

    const req = createRequest(
      'http://localhost:3000/api/admin/crm/digest/send',
      'POST'
    )
    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 with wrong bearer token', async () => {
    setupMocks()

    const req = createRequest(
      'http://localhost:3000/api/admin/crm/digest/send',
      'POST',
      undefined,
      { authorization: 'Bearer wrong-secret' }
    )
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 with valid bearer token (mock the email send)', async () => {
    setupMocks({
      serviceTables: {
        crm_digest_preferences: {
          selectResult: {
            data: [{ user_id: 'user-1', send_time: '08:00', timezone: 'UTC' }],
            error: null,
          },
        },
        profiles: {
          selectResult: {
            data: [{ id: 'user-1', full_name: 'Test User', email: 'test@example.com' }],
            error: null,
          },
        },
        crm_opportunities: {
          selectResult: { data: [], error: null },
        },
        crm_activities: {
          selectResult: { data: [], error: null },
        },
        crm_assignments: {
          selectResult: { data: [], error: null },
        },
        crm_roles: {
          selectResult: { data: [], error: null },
        },
        crm_digest_logs: {
          insertResult: { data: null, error: null },
        },
      },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/crm/digest/send',
      'POST',
      undefined,
      { authorization: 'Bearer test-cron-secret' }
    )
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('sent')
    expect(body).toHaveProperty('total')
  })
})

// ===========================================================================
// GET /api/admin/crm/digest/action/[tokenId]
// ===========================================================================

describe('GET /api/admin/crm/digest/action/[tokenId]', () => {
  let GET: (
    request: NextRequest,
    context: { params: Promise<{ tokenId: string }> }
  ) => Promise<Response>

  const TOKEN_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.NEXT_PUBLIC_SITE_URL = 'https://throughput.aava.ai'

    const mod = await import(
      '@/app/api/admin/crm/digest/action/[tokenId]/route'
    )
    GET = mod.GET
  })

  it('returns success HTML for valid, unused token with mark_complete action', async () => {
    const futureDate = new Date()
    futureDate.setHours(futureDate.getHours() + 12)

    setupMocks({
      serviceTables: {
        crm_action_tokens: {
          selectResult: {
            data: {
              id: TOKEN_ID,
              user_id: 'user-1',
              action_type: 'mark_complete',
              entity_type: 'task',
              entity_id: 'task-1',
              used: false,
              expires_at: futureDate.toISOString(),
            },
            error: null,
          },
          updateResult: { data: null, error: null },
        },
        crm_activities: {
          updateResult: { data: null, error: null },
        },
        crm_digest_logs: {
          updateResult: { data: null, error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/crm/digest/action/${TOKEN_ID}`,
      'GET'
    )
    const res = await GET(req, {
      params: Promise.resolve({ tokenId: TOKEN_ID }),
    })
    expect(res.status).toBe(200)

    const html = await res.text()
    expect(html).toContain('Task Completed')
    expect(html).toContain('marked as complete')
    expect(res.headers.get('Content-Type')).toContain('text/html')
  })

  it('returns error HTML for expired token', async () => {
    const pastDate = new Date()
    pastDate.setHours(pastDate.getHours() - 48)

    setupMocks({
      serviceTables: {
        crm_action_tokens: {
          selectResult: {
            data: {
              id: TOKEN_ID,
              user_id: 'user-1',
              action_type: 'mark_complete',
              entity_type: 'task',
              entity_id: 'task-1',
              used: false,
              expires_at: pastDate.toISOString(),
            },
            error: null,
          },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/crm/digest/action/${TOKEN_ID}`,
      'GET'
    )
    const res = await GET(req, {
      params: Promise.resolve({ tokenId: TOKEN_ID }),
    })
    expect(res.status).toBe(410)

    const html = await res.text()
    expect(html).toContain('Expired')
    expect(html).toContain('expired')
  })

  it('returns error HTML for already-used token', async () => {
    const futureDate = new Date()
    futureDate.setHours(futureDate.getHours() + 12)

    setupMocks({
      serviceTables: {
        crm_action_tokens: {
          selectResult: {
            data: {
              id: TOKEN_ID,
              user_id: 'user-1',
              action_type: 'mark_complete',
              entity_type: 'task',
              entity_id: 'task-1',
              used: true,
              expires_at: futureDate.toISOString(),
            },
            error: null,
          },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/crm/digest/action/${TOKEN_ID}`,
      'GET'
    )
    const res = await GET(req, {
      params: Promise.resolve({ tokenId: TOKEN_ID }),
    })
    expect(res.status).toBe(410)

    const html = await res.text()
    expect(html).toContain('Already Used')
  })

  it('returns error HTML for non-existent token', async () => {
    setupMocks({
      serviceTables: {
        crm_action_tokens: {
          selectResult: { data: null, error: { code: 'PGRST116', message: 'not found' } },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/crm/digest/action/${TOKEN_ID}`,
      'GET'
    )
    const res = await GET(req, {
      params: Promise.resolve({ tokenId: TOKEN_ID }),
    })
    expect(res.status).toBe(404)

    const html = await res.text()
    expect(html).toContain('Token Not Found')
  })
})

// ===========================================================================
// GET /api/admin/crm/briefing/data
// ===========================================================================

describe('GET /api/admin/crm/briefing/data', () => {
  let GET: () => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@/app/api/admin/crm/briefing/data/route')
    GET = mod.GET
  })

  it('returns 200 with correct shape (pipeline, roles, bench, rolloffs, candidates, stats)', async () => {
    setupMocks({
      serviceTables: {
        crm_opportunities: {
          selectResult: { data: [], error: null },
        },
        crm_roles: {
          selectResult: { data: [], error: null },
        },
        crm_consultants: {
          selectResult: { data: [], error: null },
        },
        crm_assignments: {
          selectResult: { data: [], error: null },
        },
        crm_candidates: {
          selectResult: { data: [], error: null },
        },
        crm_activities: {
          selectResult: { data: [], error: null },
        },
      },
    })

    const res = await GET()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('pipeline')
    expect(body).toHaveProperty('roles')
    expect(body).toHaveProperty('bench')
    expect(body).toHaveProperty('rolloffs')
    expect(body).toHaveProperty('candidates')
    expect(body).toHaveProperty('summary')

    // Verify summary shape
    expect(body.summary).toHaveProperty('total_active_consultants')
    expect(body.summary).toHaveProperty('total_placed')
    expect(body.summary).toHaveProperty('total_bench')
    expect(body.summary).toHaveProperty('rolling_off_30d')
    expect(body.summary).toHaveProperty('rolling_off_60d')
    expect(body.summary).toHaveProperty('total_pipeline_value')
    expect(body.summary).toHaveProperty('open_roles')
    expect(body.summary).toHaveProperty('active_candidates')

    expect(Array.isArray(body.pipeline)).toBe(true)
    expect(Array.isArray(body.roles)).toBe(true)
    expect(Array.isArray(body.bench)).toBe(true)
    expect(Array.isArray(body.rolloffs)).toBe(true)
    expect(Array.isArray(body.candidates)).toBe(true)
  })

  it('returns 401 for unauthenticated', async () => {
    setupMocks({
      authError: { message: 'Unauthorized', status: 401 },
    })

    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })
})
