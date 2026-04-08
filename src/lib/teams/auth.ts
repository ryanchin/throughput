/**
 * Bot Framework token handling for Microsoft Teams integration.
 *
 * - getBotToken(): Acquires an OAuth2 token for the bot to call Bot Framework REST APIs.
 * - validateBotToken(): Validates the incoming JWT from Azure Bot Service.
 *
 * Server-side only. Never import in client components.
 */

// Module-level token cache
let cachedToken: string | null = null
let tokenExpiresAt = 0

const TOKEN_ENDPOINT =
  'https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token'
const BOT_FRAMEWORK_SCOPE = 'https://api.botframework.com/.default'

/**
 * Acquire a Bot Framework access token using client credentials.
 * Caches the token in memory until 5 minutes before expiry.
 */
export async function getBotToken(): Promise<string> {
  const appId = process.env.TEAMS_BOT_APP_ID
  const appSecret = process.env.TEAMS_BOT_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error(
      'TEAMS_BOT_APP_ID and TEAMS_BOT_APP_SECRET must be configured'
    )
  }

  // Return cached token if still valid (with 5-minute buffer)
  const now = Date.now()
  if (cachedToken && tokenExpiresAt - now > 5 * 60 * 1000) {
    return cachedToken
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: appId,
    client_secret: appSecret,
    scope: BOT_FRAMEWORK_SCOPE,
  })

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Failed to acquire bot token (${response.status}): ${errorText}`
    )
  }

  const data = await response.json()
  cachedToken = data.access_token as string
  // expires_in is in seconds; convert to ms and store absolute timestamp
  tokenExpiresAt = now + (data.expires_in as number) * 1000

  return cachedToken
}

/**
 * Validate an incoming request's Authorization header from Bot Framework.
 *
 * v1 implementation: checks that a Bearer token is present.
 * In dev mode (TEAMS_BOT_APP_ID not set), skips validation entirely.
 *
 * TODO (v2): Full JWT signature verification against Microsoft's OpenID
 * metadata at https://login.botframework.com/v1/.well-known/openidconfiguration.
 * This would involve:
 *   1. Fetching the OpenID config to get the JWKS URI
 *   2. Fetching the JWKS keys
 *   3. Verifying the JWT signature, issuer, audience, and expiry
 *   4. Caching the JWKS keys with a TTL
 */
export async function validateBotToken(authHeader: string | null): Promise<boolean> {
  const appId = process.env.TEAMS_BOT_APP_ID

  // Dev mode: skip validation when bot credentials aren't configured
  if (!appId) {
    console.warn('[Teams Bot] TEAMS_BOT_APP_ID not set — skipping token validation (dev mode)')
    return true
  }

  if (!authHeader) {
    return false
  }

  // Expect "Bearer <token>"
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return false
  }

  const token = parts[1]
  if (!token || token.length < 20) {
    return false
  }

  // v1: token is present and looks plausible
  // TODO (v2): Verify JWT signature, issuer (https://api.botframework.com),
  // audience (TEAMS_BOT_APP_ID), and expiry
  return true
}
