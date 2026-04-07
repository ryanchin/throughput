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

import { GET } from '@/app/api/admin/crm/reminders/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createChain(terminalData: unknown = null, terminalError: unknown = null) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
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

describe('GET /api/admin/crm/reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated users', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Not logged in' } })
    mockFrom.mockReturnValue(createChain(null))

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns empty reminders when no data exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createChain(adminProfile)
      return createChain([])
    })

    const res = await GET()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.staleDeals).toEqual([])
    expect(body.staleCompanies).toEqual([])
    expect(body.upcomingCloses).toEqual([])
    expect(body.overdueTasks).toEqual([])
    expect(body.totalCount).toBe(0)
  })

  it('returns reminders structure with all expected fields', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createChain(adminProfile)
      return createChain([])
    })

    const res = await GET()
    const body = await res.json()

    expect(body).toHaveProperty('staleDeals')
    expect(body).toHaveProperty('staleCompanies')
    expect(body).toHaveProperty('upcomingCloses')
    expect(body).toHaveProperty('overdueTasks')
    expect(body).toHaveProperty('totalCount')
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
})
