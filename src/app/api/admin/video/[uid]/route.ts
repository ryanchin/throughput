import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'

/**
 * DELETE /api/admin/video/[uid]
 *
 * Deletes a video from Bunny.net Stream.
 *
 * Auth: admin only
 * Params: uid — Bunny.net Stream video GUID
 * Returns: { success: true }
 */
export async function DELETE(
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
        method: 'DELETE',
        headers: {
          AccessKey: apiKey,
        },
      }
    )

    // Bunny.net returns 200 on successful delete
    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: 'Unknown error' }))
      console.error('Bunny.net Stream delete error:', data)
      return NextResponse.json(
        { error: 'Failed to delete video from Bunny.net Stream' },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Bunny.net Stream delete request failed:', err)
    return NextResponse.json(
      { error: 'Failed to connect to Bunny.net Stream' },
      { status: 502 }
    )
  }
}
