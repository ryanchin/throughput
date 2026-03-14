import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'

describe('signed-url utilities', () => {
  let savedEnv: Record<string, string | undefined>

  beforeEach(() => {
    savedEnv = {
      BUNNY_STREAM_TOKEN_SECRET: process.env.BUNNY_STREAM_TOKEN_SECRET,
      BUNNY_STREAM_LIBRARY_ID: process.env.BUNNY_STREAM_LIBRARY_ID,
    }
  })

  afterEach(() => {
    // Restore env vars
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value !== undefined) {
        process.env[key] = value
      } else {
        delete process.env[key]
      }
    }
  })

  describe('generateSignedUrl', () => {
    it('throws when BUNNY_STREAM_TOKEN_SECRET is not set', async () => {
      delete process.env.BUNNY_STREAM_TOKEN_SECRET
      delete process.env.BUNNY_STREAM_LIBRARY_ID

      const { generateSignedUrl } = await import('@/lib/video/signed-url')

      expect(() => generateSignedUrl('test-video-id')).toThrow(
        'Bunny.net Stream signing keys not configured'
      )
    })

    it('throws when BUNNY_STREAM_LIBRARY_ID is not set', async () => {
      process.env.BUNNY_STREAM_TOKEN_SECRET = 'test-secret'
      delete process.env.BUNNY_STREAM_LIBRARY_ID

      const { generateSignedUrl } = await import('@/lib/video/signed-url')

      expect(() => generateSignedUrl('test-video-id')).toThrow(
        'Bunny.net Stream signing keys not configured'
      )
    })

    it('returns a URL containing the Bunny.net embed path', async () => {
      process.env.BUNNY_STREAM_TOKEN_SECRET = 'test-secret'
      process.env.BUNNY_STREAM_LIBRARY_ID = 'lib-123'

      const { generateSignedUrl } = await import('@/lib/video/signed-url')
      const url = generateSignedUrl('my-video-uid')

      expect(url).toContain('https://iframe.mediadelivery.net/embed/lib-123/my-video-uid')
      expect(url).toContain('?token=')
      expect(url).toContain('&expires=')
    })

    it('generates a valid SHA-256 hex token', async () => {
      process.env.BUNNY_STREAM_TOKEN_SECRET = 'test-secret'
      process.env.BUNNY_STREAM_LIBRARY_ID = 'lib-123'

      const { generateSignedUrl } = await import('@/lib/video/signed-url')
      const url = generateSignedUrl('my-video-uid')

      const urlObj = new URL(url)
      const token = urlObj.searchParams.get('token')
      expect(token).toBeTruthy()
      // SHA-256 hex is 64 characters
      expect(token).toHaveLength(64)
      expect(token).toMatch(/^[a-f0-9]{64}$/)
    })

    it('token is computed from secret + videoId + expiryTimestamp', async () => {
      process.env.BUNNY_STREAM_TOKEN_SECRET = 'my-secret-key'
      process.env.BUNNY_STREAM_LIBRARY_ID = 'lib-456'

      const { generateSignedUrl } = await import('@/lib/video/signed-url')
      const beforeTime = Math.floor(Date.now() / 1000)
      const url = generateSignedUrl('vid-xyz', 7200) // 2 hour TTL
      const afterTime = Math.floor(Date.now() / 1000)

      const urlObj = new URL(url)
      const token = urlObj.searchParams.get('token')!
      const expires = parseInt(urlObj.searchParams.get('expires')!, 10)

      // Verify expiry is within expected range
      expect(expires).toBeGreaterThanOrEqual(beforeTime + 7200)
      expect(expires).toBeLessThanOrEqual(afterTime + 7200)

      // Verify token matches expected SHA-256 hash
      const expectedToken = crypto
        .createHash('sha256')
        .update('my-secret-key' + 'vid-xyz' + expires)
        .digest('hex')
      expect(token).toBe(expectedToken)
    })

    it('uses default TTL of 4 hours (14400 seconds)', async () => {
      process.env.BUNNY_STREAM_TOKEN_SECRET = 'test-secret'
      process.env.BUNNY_STREAM_LIBRARY_ID = 'lib-123'

      const { generateSignedUrl } = await import('@/lib/video/signed-url')
      const beforeTime = Math.floor(Date.now() / 1000)
      const url = generateSignedUrl('vid-default-ttl')
      const afterTime = Math.floor(Date.now() / 1000)

      const urlObj = new URL(url)
      const expires = parseInt(urlObj.searchParams.get('expires')!, 10)

      expect(expires).toBeGreaterThanOrEqual(beforeTime + 14400)
      expect(expires).toBeLessThanOrEqual(afterTime + 14400)
    })

    it('produces different tokens for different video IDs', async () => {
      process.env.BUNNY_STREAM_TOKEN_SECRET = 'test-secret'
      process.env.BUNNY_STREAM_LIBRARY_ID = 'lib-123'

      const { generateSignedUrl } = await import('@/lib/video/signed-url')
      const url1 = generateSignedUrl('video-a')
      const url2 = generateSignedUrl('video-b')

      expect(url1).not.toBe(url2)
    })

    it('includes libraryId and videoId in the URL path', async () => {
      process.env.BUNNY_STREAM_TOKEN_SECRET = 'test-secret'
      process.env.BUNNY_STREAM_LIBRARY_ID = 'my-lib-789'

      const { generateSignedUrl } = await import('@/lib/video/signed-url')
      const url = generateSignedUrl('my-vid-abc')

      expect(url).toContain('/embed/my-lib-789/my-vid-abc')
    })
  })

  describe('getPlaybackUrl', () => {
    it('returns iframe embed URL with library ID', async () => {
      process.env.BUNNY_STREAM_LIBRARY_ID = 'lib-123'

      const { getPlaybackUrl } = await import('@/lib/video/signed-url')
      const url = getPlaybackUrl('vid-abc')

      expect(url).toBe(
        'https://iframe.mediadelivery.net/embed/lib-123/vid-abc'
      )
    })

    it('falls back to dev when BUNNY_STREAM_LIBRARY_ID is not set', async () => {
      delete process.env.BUNNY_STREAM_LIBRARY_ID

      const { getPlaybackUrl } = await import('@/lib/video/signed-url')
      const url = getPlaybackUrl('vid-xyz')

      expect(url).toBe(
        'https://iframe.mediadelivery.net/embed/dev/vid-xyz'
      )
    })
  })

  describe('getIframeUrl', () => {
    it('returns iframe embed URL with library ID', async () => {
      process.env.BUNNY_STREAM_LIBRARY_ID = 'lib-456'

      const { getIframeUrl } = await import('@/lib/video/signed-url')
      const url = getIframeUrl('vid-def')

      expect(url).toBe(
        'https://iframe.mediadelivery.net/embed/lib-456/vid-def'
      )
    })

    it('falls back to dev when BUNNY_STREAM_LIBRARY_ID is not set', async () => {
      delete process.env.BUNNY_STREAM_LIBRARY_ID

      const { getIframeUrl } = await import('@/lib/video/signed-url')
      const url = getIframeUrl('vid-ghi')

      expect(url).toBe(
        'https://iframe.mediadelivery.net/embed/dev/vid-ghi'
      )
    })
  })
})
