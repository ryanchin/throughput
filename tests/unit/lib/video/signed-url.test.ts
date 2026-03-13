import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'

// We need real RSA keys for generateSignedUrl since it uses crypto.createSign('RSA-SHA256')
const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

describe('signed-url utilities', () => {
  let savedEnv: Record<string, string | undefined>

  beforeEach(() => {
    savedEnv = {
      CLOUDFLARE_STREAM_SIGNING_KEY: process.env.CLOUDFLARE_STREAM_SIGNING_KEY,
      CLOUDFLARE_STREAM_KEY_ID: process.env.CLOUDFLARE_STREAM_KEY_ID,
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
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
    it('throws when CLOUDFLARE_STREAM_SIGNING_KEY is not set', async () => {
      delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY
      delete process.env.CLOUDFLARE_STREAM_KEY_ID

      // Re-import to get fresh module with current env
      const { generateSignedUrl } = await import('@/lib/video/signed-url')

      expect(() => generateSignedUrl('test-video-id')).toThrow(
        'Cloudflare Stream signing keys not configured'
      )
    })

    it('throws when CLOUDFLARE_STREAM_KEY_ID is not set', async () => {
      process.env.CLOUDFLARE_STREAM_SIGNING_KEY = privateKey
      delete process.env.CLOUDFLARE_STREAM_KEY_ID

      const { generateSignedUrl } = await import('@/lib/video/signed-url')

      expect(() => generateSignedUrl('test-video-id')).toThrow(
        'Cloudflare Stream signing keys not configured'
      )
    })

    it('returns a URL containing the video manifest path', async () => {
      process.env.CLOUDFLARE_STREAM_SIGNING_KEY = privateKey
      process.env.CLOUDFLARE_STREAM_KEY_ID = 'test-key-id'

      const { generateSignedUrl } = await import('@/lib/video/signed-url')
      const url = generateSignedUrl('my-video-uid')

      expect(url).toContain('https://cloudflarestream.com/')
      expect(url).toContain('/manifest/video.m3u8')
    })

    it('generates a JWT with three base64url segments', async () => {
      process.env.CLOUDFLARE_STREAM_SIGNING_KEY = privateKey
      process.env.CLOUDFLARE_STREAM_KEY_ID = 'test-key-id'

      const { generateSignedUrl } = await import('@/lib/video/signed-url')
      const url = generateSignedUrl('my-video-uid')

      // Extract the token between the domain and /manifest/
      const token = url.replace('https://cloudflarestream.com/', '').replace('/manifest/video.m3u8', '')
      const parts = token.split('.')
      expect(parts).toHaveLength(3)
    })

    it('JWT header contains RS256 algorithm and key ID', async () => {
      process.env.CLOUDFLARE_STREAM_SIGNING_KEY = privateKey
      process.env.CLOUDFLARE_STREAM_KEY_ID = 'my-key-123'

      const { generateSignedUrl } = await import('@/lib/video/signed-url')
      const url = generateSignedUrl('vid-abc')

      const token = url.replace('https://cloudflarestream.com/', '').replace('/manifest/video.m3u8', '')
      const headerB64 = token.split('.')[0]
      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString())

      expect(header.alg).toBe('RS256')
      expect(header.kid).toBe('my-key-123')
    })

    it('JWT payload contains video ID as sub and expiry', async () => {
      process.env.CLOUDFLARE_STREAM_SIGNING_KEY = privateKey
      process.env.CLOUDFLARE_STREAM_KEY_ID = 'test-key-id'

      const { generateSignedUrl } = await import('@/lib/video/signed-url')
      const beforeTime = Math.floor(Date.now() / 1000)
      const url = generateSignedUrl('vid-xyz', 7200) // 2 hour TTL
      const afterTime = Math.floor(Date.now() / 1000)

      const token = url.replace('https://cloudflarestream.com/', '').replace('/manifest/video.m3u8', '')
      const payloadB64 = token.split('.')[1]
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())

      expect(payload.sub).toBe('vid-xyz')
      expect(payload.kid).toBe('test-key-id')
      expect(payload.exp).toBeGreaterThanOrEqual(beforeTime + 7200)
      expect(payload.exp).toBeLessThanOrEqual(afterTime + 7200)
      expect(payload.accessRules).toEqual([{ type: 'any', action: 'allow' }])
    })

    it('uses default TTL of 4 hours (14400 seconds)', async () => {
      process.env.CLOUDFLARE_STREAM_SIGNING_KEY = privateKey
      process.env.CLOUDFLARE_STREAM_KEY_ID = 'test-key-id'

      const { generateSignedUrl } = await import('@/lib/video/signed-url')
      const beforeTime = Math.floor(Date.now() / 1000)
      const url = generateSignedUrl('vid-default-ttl')
      const afterTime = Math.floor(Date.now() / 1000)

      const token = url.replace('https://cloudflarestream.com/', '').replace('/manifest/video.m3u8', '')
      const payloadB64 = token.split('.')[1]
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())

      expect(payload.exp).toBeGreaterThanOrEqual(beforeTime + 14400)
      expect(payload.exp).toBeLessThanOrEqual(afterTime + 14400)
    })

    it('produces different tokens for different video IDs', async () => {
      process.env.CLOUDFLARE_STREAM_SIGNING_KEY = privateKey
      process.env.CLOUDFLARE_STREAM_KEY_ID = 'test-key-id'

      const { generateSignedUrl } = await import('@/lib/video/signed-url')
      const url1 = generateSignedUrl('video-a')
      const url2 = generateSignedUrl('video-b')

      expect(url1).not.toBe(url2)
    })
  })

  describe('getPlaybackUrl', () => {
    it('returns HLS manifest URL with account ID', async () => {
      process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-123'

      const { getPlaybackUrl } = await import('@/lib/video/signed-url')
      const url = getPlaybackUrl('vid-abc')

      expect(url).toBe(
        'https://customer-acc-123.cloudflarestream.com/vid-abc/manifest/video.m3u8'
      )
    })

    it('falls back to dev when CLOUDFLARE_ACCOUNT_ID is not set', async () => {
      delete process.env.CLOUDFLARE_ACCOUNT_ID

      const { getPlaybackUrl } = await import('@/lib/video/signed-url')
      const url = getPlaybackUrl('vid-xyz')

      expect(url).toBe(
        'https://customer-dev.cloudflarestream.com/vid-xyz/manifest/video.m3u8'
      )
    })
  })

  describe('getIframeUrl', () => {
    it('returns iframe URL with account ID', async () => {
      process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-456'

      const { getIframeUrl } = await import('@/lib/video/signed-url')
      const url = getIframeUrl('vid-def')

      expect(url).toBe(
        'https://customer-acc-456.cloudflarestream.com/vid-def/iframe'
      )
    })

    it('falls back to dev when CLOUDFLARE_ACCOUNT_ID is not set', async () => {
      delete process.env.CLOUDFLARE_ACCOUNT_ID

      const { getIframeUrl } = await import('@/lib/video/signed-url')
      const url = getIframeUrl('vid-ghi')

      expect(url).toBe(
        'https://customer-dev.cloudflarestream.com/vid-ghi/iframe'
      )
    })
  })
})
