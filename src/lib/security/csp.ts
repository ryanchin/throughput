/**
 * Content-Security-Policy configuration for embed iframes.
 * Only approved domains are allowed in frame-src.
 */

const ALLOWED_FRAME_SOURCES = [
  "'self'",
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'https://player.vimeo.com',
  'https://www.loom.com',
  'https://www.figma.com',
  'https://docs.google.com',
  'https://slides.google.com',
  'https://iframe.mediadelivery.net', // Bunny.net Stream player
]

/**
 * Builds the Content-Security-Policy header value.
 */
export function buildCSP(): string {
  const directives = [
    "default-src 'self'",
    `frame-src ${ALLOWED_FRAME_SOURCES.join(' ')}`,
    "frame-ancestors 'self'",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://openrouter.ai wss://*.supabase.co",
  ]

  return directives.join('; ')
}
