import crypto from 'crypto'

/**
 * Generate a signed playback URL for a Cloudflare Stream video.
 * Uses RSA-SHA256 JWT signing with the Stream signing key.
 *
 * @param videoId - The Cloudflare Stream video UID
 * @param ttlSeconds - Token TTL in seconds (default 14400 = 4 hours)
 * @returns The signed playback URL (HLS manifest)
 */
export function generateSignedUrl(videoId: string, ttlSeconds = 14400): string {
  const signingKey = process.env.CLOUDFLARE_STREAM_SIGNING_KEY
  const keyId = process.env.CLOUDFLARE_STREAM_KEY_ID

  if (!signingKey || !keyId) {
    throw new Error('Cloudflare Stream signing keys not configured')
  }

  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds
  const token = generateToken(videoId, expiry, signingKey, keyId)

  return `https://cloudflarestream.com/${token}/manifest/video.m3u8`
}

/**
 * Generate a Cloudflare Stream signed token.
 * Produces a JWT signed with RSA-SHA256 containing the video ID,
 * expiry, and access rules as the payload.
 */
function generateToken(
  videoId: string,
  expiry: number,
  signingKey: string,
  keyId: string
): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', kid: keyId }))
  const payload = base64url(
    JSON.stringify({
      sub: videoId,
      kid: keyId,
      exp: expiry,
      accessRules: [{ type: 'any', action: 'allow' }],
    })
  )

  const signature = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${payload}`)
    .sign(signingKey, 'base64url')

  return `${header}.${payload}.${signature}`
}

function base64url(str: string): string {
  return Buffer.from(str).toString('base64url')
}

/**
 * Get an unsigned playback URL (HLS manifest) for dev/public use.
 * Falls back to a placeholder account ID when CLOUDFLARE_ACCOUNT_ID is not set.
 *
 * @param videoId - The Cloudflare Stream video UID
 * @returns Unsigned HLS manifest URL
 */
export function getPlaybackUrl(videoId: string): string {
  return `https://customer-${process.env.CLOUDFLARE_ACCOUNT_ID || 'dev'}.cloudflarestream.com/${videoId}/manifest/video.m3u8`
}

/**
 * Get an unsigned iframe embed URL for dev/public use.
 * Falls back to a placeholder account ID when CLOUDFLARE_ACCOUNT_ID is not set.
 *
 * @param videoId - The Cloudflare Stream video UID
 * @returns Unsigned iframe embed URL
 */
export function getIframeUrl(videoId: string): string {
  return `https://customer-${process.env.CLOUDFLARE_ACCOUNT_ID || 'dev'}.cloudflarestream.com/${videoId}/iframe`
}
