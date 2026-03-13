import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'

/**
 * GET /api/admin/video/status/[uid]
 *
 * Polls the transcoding status of a Cloudflare Stream video.
 * Used by the admin editor to show processing state after upload.
 *
 * Auth: admin only
 * Params: uid — Cloudflare Stream video UID
 * Returns: { status: string, duration: number, thumbnail: string, readyToStream: boolean }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params
  const { error: authError } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN

  if (!accountId || !apiToken) {
    return NextResponse.json(
      { error: 'Cloudflare Stream not configured' },
      { status: 500 }
    )
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      }
    )

    const data = await response.json()

    if (!response.ok || !data.success) {
      console.error('Cloudflare Stream status error:', data.errors)
      return NextResponse.json(
        { error: 'Failed to get video status from Cloudflare Stream' },
        { status: 502 }
      )
    }

    const result = data.result

    return NextResponse.json({
      status: result.status?.state ?? 'unknown',
      duration: result.duration ?? 0,
      thumbnail: result.thumbnail ?? null,
      readyToStream: result.readyToStream ?? false,
    })
  } catch (err) {
    console.error('Cloudflare Stream status request failed:', err)
    return NextResponse.json(
      { error: 'Failed to connect to Cloudflare Stream' },
      { status: 502 }
    )
  }
}
