import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
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

import { GET, POST } from '@/app/api/admin/crm/snapshots/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createChain(terminalData: unknown = null, terminalError: unknown = null) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: terminalData, error: terminalError }),
    then: undefined as unknown,
  }
  chain.then = (resolve: (v: unknown) => unknown) =>
    resolve({
      data: Array.isArray(terminalData) ? terminalData : terminalData ? [terminalData] : [],
      error: terminalError,
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/crm/snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated users', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Not logged in' } })
    mockFrom.mockReturnValue(createChain(null))

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns snapshots list', async () => {
    const snapshots = [
      { id: '1', snapshot_date: '2026-04-06', total_pipeline_value: 100000 },
      { id: '2', snapshot_date: '2026-03-30', total_pipeline_value: 90000 },
    ]

    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createChain(adminProfile)
      if (table === 'crm_pipeline_snapshots') return createChain(snapshots)
      return createChain([])
    })

    const res = await GET()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.snapshots).toHaveLength(2)
  })
})

describe('POST /api/admin/crm/snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated users', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Not logged in' } })
    mockFrom.mockReturnValue(createChain(null))

    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('creates a snapshot from current pipeline state', async () => {
    const snapshotResult = {
      id: 'snap-1',
      snapshot_date: new Date().toISOString().split('T')[0],
      total_pipeline_value: 60000,
      weighted_pipeline_value: 26000,
      deal_count: 2,
    }

    const opps = [
      { id: '1', value: 10000, stage: 'lead', probability: 10, updated_at: new Date().toISOString() },
      { id: '2', value: 50000, stage: 'proposal', probability: 50, updated_at: new Date().toISOString() },
    ]

    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })

    // The upsert chain needs to return the snapshot via .single()
    const upsertChain = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: snapshotResult, error: null }),
    }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createChain(adminProfile)
      if (table === 'crm_opportunities') return createChain(opps)
      if (table === 'crm_pipeline_snapshots') return {
        ...createChain([]),
        upsert: vi.fn().mockReturnValue(upsertChain),
      }
      return createChain([])
    })

    const res = await POST()
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.snapshot).toBeDefined()
    expect(body.snapshot.total_pipeline_value).toBe(60000)
  })
})
