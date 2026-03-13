import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn()
const mockSignUp = vi.fn()
const mockFrom = vi.fn()
const mockServiceFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser, signUp: mockSignUp },
      from: mockFrom,
    })
  ),
  createServiceClient: vi.fn(() => ({
    from: mockServiceFrom,
  })),
}))

import { POST } from '@/app/api/certifications/signup/route'

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

const USER_ID = 'u1111111-1111-4111-a111-111111111111'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/certifications/signup', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// POST /api/certifications/signup
// ---------------------------------------------------------------------------

describe('POST /api/certifications/signup', () => {
  it('creates a public profile successfully (201)', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    })

    mockServiceFrom.mockReturnValue(
      createChain({ id: USER_ID, full_name: 'Test User', email: 'test@example.com', role: 'public' })
    )

    const res = await POST(
      makeRequest({ fullName: 'Test User', email: 'test@example.com', password: 'password123' })
    )
    expect(res.status).toBe(201)

    const data = await res.json()
    expect(data.user.id).toBe(USER_ID)
    expect(data.user.email).toBe('test@example.com')
    expect(data.user.fullName).toBe('Test User')
    expect(data.message).toBe('Account created successfully')

    // Verify signUp was called with correct args
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      options: { data: { full_name: 'Test User' } },
    })

    // Verify service client was used for profile insert
    expect(mockServiceFrom).toHaveBeenCalledWith('profiles')
  })

  it('returns 400 for missing required fields', async () => {
    const res = await POST(
      makeRequest({ email: 'test@example.com', password: 'password123' })
    )
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('Validation failed')
    expect(data.details).toBeDefined()
  })

  it('returns 400 for invalid email', async () => {
    const res = await POST(
      makeRequest({ fullName: 'Test User', email: 'not-an-email', password: 'password123' })
    )
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('Validation failed')
    expect(data.details.email).toBeDefined()
  })

  it('returns 400 for password too short (< 8 chars)', async () => {
    const res = await POST(
      makeRequest({ fullName: 'Test User', email: 'test@example.com', password: 'short' })
    )
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('Validation failed')
    expect(data.details.password).toBeDefined()
  })

  it('returns 409 for duplicate email', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: { message: 'User already registered' },
    })

    const res = await POST(
      makeRequest({ fullName: 'Test User', email: 'existing@example.com', password: 'password123' })
    )
    expect(res.status).toBe(409)

    const data = await res.json()
    expect(data.error).toBe('An account with this email already exists')
  })

  it('returns 500 when profile insert fails', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    })

    mockServiceFrom.mockReturnValue(
      createChain(null, { message: 'Profile insert failed' })
    )

    // Suppress expected console.error from the route handler
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(
      makeRequest({ fullName: 'Test User', email: 'test@example.com', password: 'password123' })
    )
    expect(res.status).toBe(500)

    const data = await res.json()
    expect(data.error).toContain('profile setup failed')

    consoleSpy.mockRestore()
  })
})
