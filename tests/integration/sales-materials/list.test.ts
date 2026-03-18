import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the route
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

import { GET } from '@/app/api/sales/materials/route'

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
    range: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    single: vi
      .fn()
      .mockResolvedValue({ data: terminalData, error: terminalError }),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: terminalData, error: terminalError }),
    then: undefined as unknown,
  }
  chain.then = (resolve: (v: unknown) => unknown) =>
    resolve({
      data: Array.isArray(terminalData)
        ? terminalData
        : terminalData
          ? [terminalData]
          : [],
      count: Array.isArray(terminalData) ? terminalData.length : 0,
      error: terminalError,
    })
  return chain
}

const USER_ID = 'a1111111-1111-4111-a111-111111111111'

function mockUnauthenticated() {
  mockGetUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  })
}

function mockAuthenticated(userId = USER_ID) {
  mockGetUser.mockResolvedValue({
    data: { user: { id: userId, email: 'test@example.com' } },
    error: null,
  })
}

function createRequest(url: string): NextRequest {
  return new NextRequest(url)
}

const MATERIAL_A = {
  id: 'aaaaaaaa-1111-4111-a111-111111111111',
  title: 'Battle Card: Competitor X',
  slug: 'battle-card-competitor-x',
  description: 'Competitive analysis against X',
  material_type: 'battle_card',
  category: 'competitive',
  tags: ['competitor-x', 'enterprise'],
  file_name: null,
  file_mime_type: null,
  shareable: true,
  share_token: 'abc123def456',
  updated_at: '2026-03-01T00:00:00Z',
}

const MATERIAL_B = {
  id: 'bbbbbbbb-2222-4222-a222-222222222222',
  title: 'Case Study: Acme Corp',
  slug: 'case-study-acme-corp',
  description: 'Enterprise win story',
  material_type: 'case_study',
  category: 'wins',
  tags: ['enterprise', 'acme'],
  file_name: 'acme-case-study.pdf',
  file_mime_type: 'application/pdf',
  shareable: false,
  share_token: 'xyz789ghi012',
  updated_at: '2026-03-02T00:00:00Z',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/sales/materials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated user', async () => {
    mockUnauthenticated()

    const req = createRequest('http://localhost:3000/api/sales/materials')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 for employee role', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'employee' })
    mockFrom.mockReturnValue(profileChain)

    const req = createRequest('http://localhost:3000/api/sales/materials')
    const res = await GET(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 403 for public role', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'public' })
    mockFrom.mockReturnValue(profileChain)

    const req = createRequest('http://localhost:3000/api/sales/materials')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('returns 200 with published materials for sales role', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'sales' })
    const materialsChain = createChain([MATERIAL_A, MATERIAL_B])

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'sales_materials':
          return materialsChain
        default:
          return createChain([])
      }
    })

    const req = createRequest('http://localhost:3000/api/sales/materials')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.materials).toHaveLength(2)
    expect(body.total).toBe(2)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
  })

  it('returns 200 with materials for admin role', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'admin' })
    const materialsChain = createChain([MATERIAL_A])

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'sales_materials':
          return materialsChain
        default:
          return createChain([])
      }
    })

    const req = createRequest('http://localhost:3000/api/sales/materials')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.materials).toHaveLength(1)
  })

  it('filters by material type when type param is provided', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'sales' })
    const materialsChain = createChain([MATERIAL_A])

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'sales_materials':
          return materialsChain
        default:
          return createChain([])
      }
    })

    const req = createRequest('http://localhost:3000/api/sales/materials?type=battle_card')
    const res = await GET(req)
    expect(res.status).toBe(200)

    // Verify .eq was called with material_type filter
    const eqCalls = (materialsChain.eq as ReturnType<typeof vi.fn>).mock.calls
    const typeFilterCalls = eqCalls.filter(
      (call: unknown[]) => call[0] === 'material_type' && call[1] === 'battle_card'
    )
    expect(typeFilterCalls).toHaveLength(1)
  })

  it('filters by category when category param is provided', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'sales' })
    const materialsChain = createChain([MATERIAL_A])

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'sales_materials':
          return materialsChain
        default:
          return createChain([])
      }
    })

    const req = createRequest('http://localhost:3000/api/sales/materials?category=competitive')
    const res = await GET(req)
    expect(res.status).toBe(200)

    const eqCalls = (materialsChain.eq as ReturnType<typeof vi.fn>).mock.calls
    const categoryFilterCalls = eqCalls.filter(
      (call: unknown[]) => call[0] === 'category' && call[1] === 'competitive'
    )
    expect(categoryFilterCalls).toHaveLength(1)
  })

  it('applies text search when q param is provided', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'sales' })
    const materialsChain = createChain([MATERIAL_A])

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'sales_materials':
          return materialsChain
        default:
          return createChain([])
      }
    })

    const req = createRequest('http://localhost:3000/api/sales/materials?q=competitor')
    const res = await GET(req)
    expect(res.status).toBe(200)

    expect(materialsChain.textSearch).toHaveBeenCalledWith(
      'search_vector',
      'competitor',
      { type: 'plain' }
    )
  })

  it('applies pagination with page and limit params', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'sales' })
    const materialsChain = createChain([MATERIAL_B])

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'sales_materials':
          return materialsChain
        default:
          return createChain([])
      }
    })

    const req = createRequest('http://localhost:3000/api/sales/materials?page=2&limit=10')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.page).toBe(2)
    expect(body.limit).toBe(10)

    // page 2, limit 10 => range(10, 19)
    expect(materialsChain.range).toHaveBeenCalledWith(10, 19)
  })

  it('enforces published status filter', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'sales' })
    const materialsChain = createChain([])

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'sales_materials':
          return materialsChain
        default:
          return createChain([])
      }
    })

    const req = createRequest('http://localhost:3000/api/sales/materials')
    await GET(req)

    const eqCalls = (materialsChain.eq as ReturnType<typeof vi.fn>).mock.calls
    const statusFilterCalls = eqCalls.filter(
      (call: unknown[]) => call[0] === 'status' && call[1] === 'published'
    )
    expect(statusFilterCalls).toHaveLength(1)
  })

  it('returns empty array when no materials match', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'sales' })
    const materialsChain = createChain([])

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'sales_materials':
          return materialsChain
        default:
          return createChain([])
      }
    })

    const req = createRequest('http://localhost:3000/api/sales/materials')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.materials).toEqual([])
    expect(body.total).toBe(0)
  })

  it('returns 500 on Supabase error', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'sales' })
    const materialsChain = createChain(null, { message: 'DB error', code: 'PGRST' })

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'profiles':
          return profileChain
        case 'sales_materials':
          return materialsChain
        default:
          return createChain([])
      }
    })

    const req = createRequest('http://localhost:3000/api/sales/materials')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to fetch materials')
  })

  it('returns 400 for invalid type param', async () => {
    mockAuthenticated()

    const profileChain = createChain({ id: USER_ID, role: 'sales' })
    mockFrom.mockReturnValue(profileChain)

    const req = createRequest('http://localhost:3000/api/sales/materials?type=invalid_type')
    const res = await GET(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
  })
})
