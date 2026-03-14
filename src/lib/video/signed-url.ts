import crypto from 'crypto'

/**
 * Generate a signed playback URL for a Bunny.net Stream video.
 * Uses SHA-256 hashing with the Stream token secret.
 *
 * @param videoId - The Bunny.net Stream video GUID
 * @param ttlSeconds - Token TTL in seconds (default 14400 = 4 hours)
 * @returns The signed iframe embed URL with token and expiry query params
 */
export function generateSignedUrl(videoId: string, ttlSeconds = 14400): string {
  const tokenSecret = process.env.BUNNY_STREAM_TOKEN_SECRET
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID

  if (!tokenSecret || !libraryId) {
    throw new Error('Bunny.net Stream signing keys not configured')
  }

  const expiryTimestamp = Math.floor(Date.now() / 1000) + ttlSeconds

  const token = crypto
    .createHash('sha256')
    .update(tokenSecret + videoId + expiryTimestamp)
    .digest('hex')

  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?token=${token}&expires=${expiryTimestamp}`
}

/**
 * Get an unsigned playback URL (iframe embed) for dev/public use.
 *
 * @param videoId - The Bunny.net Stream video GUID
 * @returns Unsigned iframe embed URL
 */
export function getPlaybackUrl(videoId: string): string {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID || 'dev'
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`
}

/**
 * Get an unsigned iframe embed URL for dev/public use.
 *
 * @param videoId - The Bunny.net Stream video GUID
 * @returns Unsigned iframe embed URL
 */
export function getIframeUrl(videoId: string): string {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID || 'dev'
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`
}
