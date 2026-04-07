import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockCallOpenRouter = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    })
  ),
}))

vi.mock('@/lib/openrouter/client', () => ({
  callOpenRouter: (...args: unknown[]) => mockCallOpenRouter(...args),
}))

import { POST as enrichPost } from '@/app/api/admin/crm/ai/enrich/route'
import { POST as parsePost } from '@/app/api/admin/crm/ai/parse/route'
import { POST as suggestPost } from '@/app/api/admin/crm/ai/suggest-actions/route'
import { POST as scorePost } from '@/app/api/admin/crm/ai/score/route'
import { POST as digestPost } from '@/app/api/admin/crm/ai/digest/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createChain(terminalData: unknown = null, terminalError: unknown = null) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: terminalData, error: terminalError }),
    then: undefined as unknown,
  }
  chain.then = (resolve: (v: unknown) => unknown) =>
    resolve({
      data: Array.isArray(terminalData) ? terminalData : terminalData ? [terminalData] : [],
      error: terminalError,
      count: Array.isArray(terminalData) ? terminalData.length : 0,
    })
  return chain
}

const ADMIN_ID = 'a1111111-1111-4111-a111-111111111111'
const adminProfile = {
  id: ADMIN_ID,
  email: 'admin@test.com',
  full_name: 'Admin',
  role: 'admin',
  avatar_url: null,
  signup_context: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-03-12T00:00:00Z',
}

function setupAdminAuth() {
  mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })
  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') return createChain(adminProfile)
    return createChain([])
  })
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/crm/ai/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Enrich
// ---------------------------------------------------------------------------

describe('POST /api/admin/crm/ai/enrich', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated users', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Unauthorized' } })
    mockFrom.mockReturnValue(createChain(null))

    const res = await enrichPost(makeRequest({ name: 'Acme' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing name', async () => {
    setupAdminAuth()
    const res = await enrichPost(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns enriched data on success', async () => {
    setupAdminAuth()
    mockCallOpenRouter.mockResolvedValue(
      JSON.stringify({
        industry: 'Technology',
        company_size: '51-200',
        description: 'A tech company',
        website: 'https://acme.com',
      })
    )

    const res = await enrichPost(makeRequest({ name: 'Acme Corp' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.industry).toBe('Technology')
    expect(body.company_size).toBe('51-200')
    expect(body.description).toBe('A tech company')
    expect(body.website).toBe('https://acme.com')
  })

  it('returns 503 when AI fails', async () => {
    setupAdminAuth()
    mockCallOpenRouter.mockRejectedValue(new Error('API error'))

    const res = await enrichPost(makeRequest({ name: 'Acme Corp' }))
    expect(res.status).toBe(503)

    const body = await res.json()
    expect(body.error).toBe('AI enrichment unavailable')
  })

  it('returns 503 when AI returns invalid JSON', async () => {
    setupAdminAuth()
    mockCallOpenRouter.mockResolvedValue('not valid json')

    const res = await enrichPost(makeRequest({ name: 'Acme Corp' }))
    expect(res.status).toBe(503)
  })
})

// ---------------------------------------------------------------------------
// NL Parse
// ---------------------------------------------------------------------------

describe('POST /api/admin/crm/ai/parse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for empty text', async () => {
    setupAdminAuth()
    const res = await parsePost(makeRequest({ text: '' }))
    expect(res.status).toBe(400)
  })

  it('parses text and returns actions with company matching', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })

    const insertChain = createChain(null)
    const companySearchChain = createChain([{ id: 'comp-1', name: 'Acme Corp' }])

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createChain(adminProfile)
      if (table === 'crm_companies') return companySearchChain
      if (table === 'crm_nl_parse_log') return insertChain
      return createChain([])
    })

    mockCallOpenRouter.mockResolvedValue(
      JSON.stringify([
        { action: 'create_activity', type: 'call', subject: 'Discovery call', company_name: 'Acme' },
      ])
    )

    const res = await parsePost(makeRequest({ text: 'Had a discovery call with Acme' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.actions).toHaveLength(1)
    expect(body.actions[0].action).toBe('create_activity')
  })

  it('returns 503 when AI fails', async () => {
    setupAdminAuth()
    mockCallOpenRouter.mockRejectedValue(new Error('API error'))

    const res = await parsePost(makeRequest({ text: 'Had a call with Acme' }))
    expect(res.status).toBe(503)
  })
})

// ---------------------------------------------------------------------------
// Suggest Actions
// ---------------------------------------------------------------------------

describe('POST /api/admin/crm/ai/suggest-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for missing fields', async () => {
    setupAdminAuth()
    const res = await suggestPost(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns suggestions on success', async () => {
    setupAdminAuth()
    mockCallOpenRouter.mockResolvedValue(
      JSON.stringify([
        { action: 'Schedule follow-up call', priority: 'high' },
        { action: 'Send proposal', priority: 'medium' },
      ])
    )

    const res = await suggestPost(
      makeRequest({
        activity_type: 'call',
        subject: 'Discovery call',
        company_name: 'Acme Corp',
        stage: 'qualified',
      })
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.suggestions).toHaveLength(2)
    expect(body.suggestions[0].priority).toBe('high')
  })

  it('returns empty suggestions when AI fails (non-critical)', async () => {
    setupAdminAuth()
    mockCallOpenRouter.mockRejectedValue(new Error('API error'))

    const res = await suggestPost(
      makeRequest({
        activity_type: 'call',
        subject: 'Discovery call',
        company_name: 'Acme Corp',
      })
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.suggestions).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Score
// ---------------------------------------------------------------------------

describe('POST /api/admin/crm/ai/score', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for invalid opportunity ID', async () => {
    setupAdminAuth()
    const res = await scorePost(makeRequest({ opportunityId: 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when opportunity not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createChain(adminProfile)
      if (table === 'crm_opportunities') return createChain(null, { message: 'Not found' })
      return createChain([])
    })

    const res = await scorePost(
      makeRequest({ opportunityId: '550e8400-e29b-41d4-a716-446655440000' })
    )
    expect(res.status).toBe(404)
  })

  it('returns score and reasoning on success', async () => {
    const opp = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Enterprise License',
      stage: 'proposal',
      value: 50000,
      probability: 50,
      company_id: 'comp-1',
      created_at: '2026-03-01T00:00:00Z',
    }
    const company = { name: 'Acme Corp' }
    const lastAct = { activity_date: '2026-04-01T00:00:00Z' }

    const updateChain = createChain(null)

    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createChain(adminProfile)
      if (table === 'crm_opportunities') return {
        ...createChain(null),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: opp, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue(updateChain),
      }
      if (table === 'crm_companies') return createChain(company)
      if (table === 'crm_activities') return {
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: lastAct, error: null }),
              }),
            }),
          }),
          then: (resolve: (v: unknown) => unknown) =>
            resolve({ data: [], error: null, count: 5 }),
        }),
      }
      return createChain([])
    })

    mockCallOpenRouter.mockResolvedValue(
      JSON.stringify({ score: 72, reasoning: 'Good engagement, proposal stage' })
    )

    const res = await scorePost(
      makeRequest({ opportunityId: '550e8400-e29b-41d4-a716-446655440000' })
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.score).toBe(72)
    expect(body.reasoning).toBe('Good engagement, proposal stage')
  })

  it('returns 503 when AI fails', async () => {
    const opp = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Deal',
      stage: 'lead',
      value: null,
      probability: 10,
      company_id: 'comp-1',
      created_at: '2026-03-01T00:00:00Z',
    }

    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createChain(adminProfile)
      if (table === 'crm_opportunities') return {
        ...createChain(null),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: opp, error: null }),
          }),
        }),
      }
      if (table === 'crm_companies') return createChain({ name: 'Test' })
      if (table === 'crm_activities') return {
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          then: (resolve: (v: unknown) => unknown) =>
            resolve({ data: [], error: null, count: 0 }),
        }),
      }
      return createChain([])
    })

    mockCallOpenRouter.mockRejectedValue(new Error('API error'))

    const res = await scorePost(
      makeRequest({ opportunityId: '550e8400-e29b-41d4-a716-446655440000' })
    )
    expect(res.status).toBe(503)
  })
})

// ---------------------------------------------------------------------------
// Digest
// ---------------------------------------------------------------------------

describe('POST /api/admin/crm/ai/digest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated users', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Unauthorized' } })
    mockFrom.mockReturnValue(createChain(null))

    const res = await digestPost()
    expect(res.status).toBe(401)
  })

  it('returns digest on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createChain(adminProfile)
      if (table === 'crm_opportunities') return createChain([])
      if (table === 'crm_companies') return createChain([])
      if (table === 'crm_activities') return createChain([])
      return createChain([])
    })

    mockCallOpenRouter.mockResolvedValue(
      JSON.stringify({
        summary: 'Quiet week with no active deals.',
        highlights: ['No new deals this week'],
        action_items: ['Focus on prospecting'],
      })
    )

    const res = await digestPost()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.summary).toBe('Quiet week with no active deals.')
    expect(body.highlights).toHaveLength(1)
    expect(body.action_items).toHaveLength(1)
  })

  it('returns 503 when AI fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createChain(adminProfile)
      return createChain([])
    })

    mockCallOpenRouter.mockRejectedValue(new Error('API error'))

    const res = await digestPost()
    expect(res.status).toBe(503)
  })
})
