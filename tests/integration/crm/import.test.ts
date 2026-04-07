import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

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

import { POST } from '@/app/api/admin/crm/import/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createChain(terminalData: unknown = null, terminalError: unknown = null) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
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

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/crm/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/crm/import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated users', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Unauthorized' } })
    mockFrom.mockReturnValue(createChain(null))

    const res = await POST(makeRequest({ companies: [{ name: 'Test' }] }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createChain(adminProfile)
      return createChain([])
    })

    const res = await POST(makeRequest({ companies: [] })) // min 1
    expect(res.status).toBe(400)
  })

  it('imports valid companies and skips existing ones', async () => {
    const existingCompanies = [{ name: 'Existing Corp' }]
    const insertedIds = [{ id: 'new-1' }, { id: 'new-2' }]

    const insertChain = {
      select: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => unknown) =>
        resolve({ data: insertedIds, error: null }),
    }

    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createChain(adminProfile)
      if (table === 'crm_companies') {
        return {
          ...createChain(existingCompanies),
          insert: vi.fn().mockReturnValue(insertChain),
        }
      }
      return createChain([])
    })

    const res = await POST(
      makeRequest({
        companies: [
          { name: 'Existing Corp' },
          { name: 'New Company A', industry: 'Tech' },
          { name: 'New Company B', status: 'active' },
        ],
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.imported).toBe(2)
    expect(body.skipped).toBe(1)
    expect(body.errors).toEqual([])
  })

  it('returns errors for invalid company_size values', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createChain(adminProfile)
      if (table === 'crm_companies') return createChain([]) // no existing
      return createChain([])
    })

    const res = await POST(
      makeRequest({
        companies: [
          { name: 'Bad Size Co', company_size: 'huge' },
        ],
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.imported).toBe(0)
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].row).toBe(1)
    expect(body.errors[0].message).toContain('company_size')
  })

  it('returns errors for invalid status values', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createChain(adminProfile)
      if (table === 'crm_companies') return createChain([])
      return createChain([])
    })

    const res = await POST(
      makeRequest({
        companies: [
          { name: 'Bad Status Co', status: 'unknown' },
        ],
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].message).toContain('status')
  })
})
