import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'

/**
 * DELETE /api/admin/video/[uid]
 *
 * Deletes a video from Cloudflare Stream.
 *
 * Auth: admin only
 * Params: uid — Cloudflare Stream video UID
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
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      }
    )

    // Cloudflare returns 200 with empty body on successful delete
    if (!response.ok) {
      const data = await response.json().catch(() => ({ errors: ['Unknown error'] }))
      console.error('Cloudflare Stream delete error:', data.errors)
      return NextResponse.json(
        { error: 'Failed to delete video from Cloudflare Stream' },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Cloudflare Stream delete request failed:', err)
    return NextResponse.json(
      { error: 'Failed to connect to Cloudflare Stream' },
      { status: 502 }
    )
  }
}
