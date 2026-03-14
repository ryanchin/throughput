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
 * Params: uid — Bunny.net Stream video GUID
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

  const tokenSecret = process.env.BUNNY_STREAM_TOKEN_SECRET
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID
  const hasSigningKeys = Boolean(tokenSecret && libraryId)

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

  // For Bunny.net, both url and iframe are the same embed URL (signed or unsigned)
  return NextResponse.json({ url, iframe: url })
}
