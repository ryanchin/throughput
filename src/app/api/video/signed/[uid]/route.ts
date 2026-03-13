import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSignedUrl, getIframeUrl } from '@/lib/video/signed-url'

/**
 * GET /api/video/signed/[uid]
 *
 * Generates a signed playback URL for an authenticated user.
 * Falls back to an unsigned iframe URL when signing keys are not configured (dev mode).
 *
 * Auth: any authenticated user (not admin-only)
 * Params: uid — Cloudflare Stream video UID
 * Returns: { url: string, iframe: string }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const signingKey = process.env.CLOUDFLARE_STREAM_SIGNING_KEY
  const keyId = process.env.CLOUDFLARE_STREAM_KEY_ID
  const hasSigningKeys = Boolean(signingKey && keyId)

  let url: string
  try {
    url = hasSigningKeys ? generateSignedUrl(uid) : getIframeUrl(uid)
  } catch (err) {
    console.error('Failed to generate signed video URL:', err)
    return NextResponse.json(
      { error: 'Failed to generate video URL' },
      { status: 500 }
    )
  }

  const iframe = getIframeUrl(uid)

  return NextResponse.json({ url, iframe })
}
