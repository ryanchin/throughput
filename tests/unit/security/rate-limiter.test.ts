import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Upstash modules before importing
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('@upstash/ratelimit', () => {
  const mockLimit = vi.fn()
  return {
    Ratelimit: Object.assign(
      vi.fn().mockImplementation(() => ({
        limit: mockLimit,
      })),
      {
        slidingWindow: vi.fn().mockReturnValue('sliding-window-config'),
      }
    ),
    __mockLimit: mockLimit,
  }
})

import { checkRateLimit } from '@/lib/security/rate-limiter'
import type { Ratelimit } from '@upstash/ratelimit'

// Access the mock limit function
const { __mockLimit: mockLimit } = await import('@upstash/ratelimit') as unknown as { __mockLimit: ReturnType<typeof vi.fn> }

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when limiter is null (not configured)', async () => {
    const result = await checkRateLimit(null, 'user-123')
    expect(result).toBeNull()
  })

  it('returns null when request is within rate limit', async () => {
    mockLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 3600000,
    })

    const limiter = { limit: mockLimit } as unknown as Ratelimit
    const result = await checkRateLimit(limiter, 'user-123')

    expect(result).toBeNull()
    expect(mockLimit).toHaveBeenCalledWith('user-123')
  })

  it('returns 429 response when rate limit is exceeded', async () => {
    const resetTime = Date.now() + 60000
    mockLimit.mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: resetTime,
    })

    const limiter = { limit: mockLimit } as unknown as Ratelimit
    const result = await checkRateLimit(limiter, 'user-123')

    expect(result).not.toBeNull()
    expect(result!.status).toBe(429)

    const body = await result!.json()
    expect(body.error).toBe('Too many requests. Please try again later.')

    expect(result!.headers.get('Retry-After')).toBeTruthy()
    expect(result!.headers.get('X-RateLimit-Limit')).toBe('10')
    expect(result!.headers.get('X-RateLimit-Remaining')).toBe('0')
  })
})
