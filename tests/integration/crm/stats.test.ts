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

import { GET } from '@/app/api/admin/crm/stats/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createChain(terminalData: unknown = null, terminalError: unknown = null) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
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
  full_name: 'Admin User',
  role: 'admin',
  avatar_url: null,
  signup_context: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-03-12T00:00:00Z',
}

function setupAuth(profile = adminProfile) {
  mockGetUser.mockResolvedValue({ data: { user: { id: profile.id } }, error: null })
  // Second call to from('profiles') returns the profile
  const profileChain = createChain(profile)
  const oppChain = createChain([])
  const companyChain = createChain([])
  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') return profileChain
    if (table === 'crm_opportunities') return oppChain
    if (table === 'crm_companies') return companyChain
    return createChain([])
  })
  return { profileChain, oppChain, companyChain }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/crm/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated users', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Not logged in' } })
    mockFrom.mockReturnValue(createChain(null))

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 403 for employee role', async () => {
    const empProfile = { ...adminProfile, id: 'emp-id', role: 'employee' }
    mockGetUser.mockResolvedValue({ data: { user: { id: empProfile.id } }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createChain(empProfile)
      return createChain([])
    })

    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns correct stats with empty data', async () => {
    setupAuth()

    const res = await GET()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.pipelineValue).toBe(0)
    expect(body.weightedPipeline).toBe(0)
    expect(body.dealCount).toBe(0)
    expect(body.wonThisMonth).toEqual({ count: 0, value: 0 })
    expect(body.lostThisMonth).toEqual({ count: 0 })
    expect(body.stageBreakdown).toBeDefined()
    expect(body.companiesByStatus).toBeDefined()
  })

  it('computes pipeline value from open opportunities', async () => {
    const now = new Date().toISOString()
    const opps = [
      { id: '1', value: 10000, stage: 'lead', probability: 10, updated_at: now },
      { id: '2', value: 50000, stage: 'proposal', probability: 50, updated_at: now },
      { id: '3', value: 100000, stage: 'closed_won', probability: 100, updated_at: now },
    ]

    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createChain(adminProfile)
      if (table === 'crm_opportunities') return createChain(opps)
      if (table === 'crm_companies') return createChain([{ status: 'active' }])
      return createChain([])
    })

    const res = await GET()
    const body = await res.json()

    // Only lead + proposal are open
    expect(body.pipelineValue).toBe(60000)
    // Weighted: 10000*0.1 + 50000*0.5 = 1000 + 25000 = 26000
    expect(body.weightedPipeline).toBe(26000)
    expect(body.dealCount).toBe(2)
  })

  it('counts won and lost this month correctly', async () => {
    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15).toISOString()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString()

    const opps = [
      { id: '1', value: 20000, stage: 'closed_won', probability: 100, updated_at: thisMonth },
      { id: '2', value: 5000, stage: 'closed_won', probability: 100, updated_at: lastMonth },
      { id: '3', value: 15000, stage: 'closed_lost', probability: 0, updated_at: thisMonth },
    ]

    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createChain(adminProfile)
      if (table === 'crm_opportunities') return createChain(opps)
      if (table === 'crm_companies') return createChain([])
      return createChain([])
    })

    const res = await GET()
    const body = await res.json()

    expect(body.wonThisMonth.count).toBe(1)
    expect(body.wonThisMonth.value).toBe(20000)
    expect(body.lostThisMonth.count).toBe(1)
  })

  it('returns stage breakdown with all stages', async () => {
    setupAuth()

    const res = await GET()
    const body = await res.json()

    const stages = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
    for (const stage of stages) {
      expect(body.stageBreakdown[stage]).toBeDefined()
      expect(body.stageBreakdown[stage].count).toBe(0)
      expect(body.stageBreakdown[stage].value).toBe(0)
    }
  })
})
