import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

/**
 * Creates an Upstash Redis client for rate limiting.
 * Returns null if env vars are not configured (allows graceful degradation in dev).
 */
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    return null
  }

  return new Redis({ url, token })
}

/**
 * Pre-configured rate limiters for sensitive routes.
 * Each limiter uses a sliding window algorithm.
 */
export const rateLimiters = {
  /** POST /api/quiz/submit — 10 submissions per user per hour */
  quizSubmit: createLimiter('quiz_submit', { requests: 10, window: '1h' }),

  /** POST /api/certifications/submit — 5 submissions per user per day */
  certSubmit: createLimiter('cert_submit', { requests: 5, window: '1d' }),

  /** POST /api/admin/generate/course — 20 generations per admin per day */
  generateCourse: createLimiter('gen_course', { requests: 20, window: '1d' }),

  /** POST /api/admin/generate/lesson — 50 generations per admin per day */
  generateLesson: createLimiter('gen_lesson', { requests: 50, window: '1d' }),

  /** POST /api/certifications/signup — 10 attempts per IP per 15 minutes */
  authSignup: createLimiter('auth_signup', { requests: 10, window: '15m' }),
}

interface LimiterConfig {
  requests: number
  window: '15m' | '1h' | '1d'
}

function createLimiter(prefix: string, config: LimiterConfig): Ratelimit | null {
  const redis = getRedis()
  if (!redis) {
    return null
  }

  const windowMap = {
    '15m': '15 m',
    '1h': '1 h',
    '1d': '1 d',
  } as const

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.requests, windowMap[config.window]),
    prefix: `ratelimit:${prefix}`,
  })
}

/**
 * Checks the rate limit for a given identifier (user ID or IP).
 * Returns a 429 response if the limit is exceeded, or null if allowed.
 *
 * If the rate limiter is not configured (missing env vars), allows the request.
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<NextResponse | null> {
  if (!limiter) {
    // Rate limiting not configured — allow request (dev/test mode)
    return null
  }

  const result = await limiter.limit(identifier)

  if (!result.success) {
    const retryAfterMs = result.reset - Date.now()
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000)

    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(result.reset),
        },
      }
    )
  }

  return null
}
