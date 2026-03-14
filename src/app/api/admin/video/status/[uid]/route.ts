import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'

/**
 * GET /api/admin/video/status/[uid]
 *
 * Polls the transcoding status of a Bunny.net Stream video.
 * Used by the admin editor to show processing state after upload.
 *
 * Bunny.net status codes:
 *   0 = created, 1 = uploaded, 2 = processing, 3 = transcoding,
 *   4 = finished (ready), 5 = error
 *
 * Auth: admin only
 * Params: uid — Bunny.net Stream video GUID
 * Returns: { status: number, duration: number, thumbnail: string | null, readyToStream: boolean }
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

  const apiKey = process.env.BUNNY_STREAM_API_KEY
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID
  const cdnHostname = process.env.BUNNY_STREAM_CDN_HOSTNAME

  if (!apiKey || !libraryId) {
    return NextResponse.json(
      { error: 'Bunny.net Stream not configured' },
      { status: 500 }
    )
  }

  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${uid}`,
      {
        method: 'GET',
        headers: {
          AccessKey: apiKey,
        },
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('Bunny.net Stream status error:', data)
      return NextResponse.json(
        { error: 'Failed to get video status from Bunny.net Stream' },
        { status: 502 }
      )
    }

    const thumbnail = data.thumbnailFileName && cdnHostname
      ? `https://${cdnHostname}/${uid}/${data.thumbnailFileName}`
      : null

    return NextResponse.json({
      status: data.status ?? 0,
      duration: data.length ?? 0,
      thumbnail,
      readyToStream: data.status === 4,
    })
  } catch (err) {
    console.error('Bunny.net Stream status request failed:', err)
    return NextResponse.json(
      { error: 'Failed to connect to Bunny.net Stream' },
      { status: 502 }
    )
  }
}
