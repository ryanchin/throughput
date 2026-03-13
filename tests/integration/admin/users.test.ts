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

import { GET } from '@/app/api/admin/users/route'

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
    single: vi.fn().mockResolvedValue({ data: terminalData, error: terminalError }),
    maybeSingle: vi.fn().mockResolvedValue({ data: terminalData, error: terminalError }),
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
const USER_ID = 'u2222222-2222-4222-a222-222222222222'

const adminProfile = {
  id: ADMIN_ID,
  email: 'admin@test.com',
  full_name: 'Admin User',
  role: 'admin',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-03-12T00:00:00Z',
}

const regularProfile = {
  id: USER_ID,
  email: 'user@test.com',
  full_name: 'Regular User',
  role: 'employee',
  created_at: '2026-02-01T00:00:00Z',
  updated_at: '2026-03-10T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/admin/users', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Not logged in' } })

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockFrom.mockReturnValue(createChain({ ...regularProfile }))

    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns user list with enrollment aggregates', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) {
        // profiles query (from requireAdmin)
        return createChain(adminProfile)
      }
      if (fromCallCount === 2) {
        // profiles list
        return createChain([adminProfile, regularProfile])
      }
      if (fromCallCount === 3) {
        // enrollments
        return createChain([
          {
            user_id: USER_ID,
            status: 'passed',
            final_score: 85,
            enrolled_at: '2026-02-15T00:00:00Z',
            completed_at: '2026-03-01T00:00:00Z',
          },
          {
            user_id: USER_ID,
            status: 'enrolled',
            final_score: null,
            enrolled_at: '2026-03-05T00:00:00Z',
            completed_at: null,
          },
        ])
      }
      return createChain([])
    })

    const res = await GET()
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.users).toHaveLength(2)

    const user = data.users.find((u: { id: string }) => u.id === USER_ID)
    expect(user.coursesEnrolled).toBe(2)
    expect(user.coursesPassed).toBe(1)
    expect(user.avgScore).toBe(85)
  })

  it('returns empty array when no users exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) return createChain(adminProfile)
      return createChain([])
    })

    const res = await GET()
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.users).toEqual([])
  })

  it('handles users with no enrollments', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })

    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) return createChain(adminProfile)
      if (fromCallCount === 2) return createChain([regularProfile])
      return createChain([]) // no enrollments
    })

    const res = await GET()
    expect(res.status).toBe(200)

    const data = await res.json()
    const user = data.users[0]
    expect(user.coursesEnrolled).toBe(0)
    expect(user.coursesPassed).toBe(0)
    expect(user.avgScore).toBeNull()
  })
})
