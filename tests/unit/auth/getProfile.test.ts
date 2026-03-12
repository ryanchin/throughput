import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the server Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { getProfile } from '@/lib/auth/getProfile'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

describe('getProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'Not authenticated' } }),
      },
    } as any)

    const profile = await getProfile()
    expect(profile).toBeNull()
  })

  it('returns null when auth.getUser returns an error', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'Token expired' } }),
      },
    } as any)

    const profile = await getProfile()
    expect(profile).toBeNull()
  })

  it('returns null when profile does not exist in database', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      }),
    })

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    } as any)

    const profile = await getProfile()
    expect(profile).toBeNull()
  })

  it('returns profile object for authenticated user', async () => {
    const mockProfile = {
      id: 'user-123',
      email: 'test@example.com',
      full_name: 'Test User',
      avatar_url: null,
      role: 'employee',
      signup_context: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }),
    })

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    } as any)

    const profile = await getProfile()
    expect(profile).toEqual(mockProfile)
    expect(profile?.role).toBe('employee')
    expect(profile?.email).toBe('test@example.com')
  })
})
