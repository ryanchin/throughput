import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'

const uploadUrlSchema = z.object({
  maxDurationSeconds: z.number().int().min(1).max(21600).optional().default(3600),
})

/**
 * POST /api/admin/video/upload-url
 *
 * Returns a Direct Creator Upload URL from Cloudflare Stream.
 * The frontend uploads directly to Cloudflare — the video never passes through our server.
 *
 * Auth: admin only
 * Body: { maxDurationSeconds?: number } (optional, default 3600 = 1 hour)
 * Returns: { uploadUrl: string, uid: string }
 */
export async function POST(request: NextRequest) {
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

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    // Body is optional; default values will be used
  }

  const parsed = uploadUrlSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { maxDurationSeconds } = parsed.data

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxDurationSeconds }),
      }
    )

    const data = await response.json()

    if (!response.ok || !data.success) {
      console.error('Cloudflare Stream upload-url error:', data.errors)
      return NextResponse.json(
        { error: 'Failed to get upload URL from Cloudflare Stream' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      uploadUrl: data.result.uploadURL,
      uid: data.result.uid,
    })
  } catch (err) {
    console.error('Cloudflare Stream upload-url request failed:', err)
    return NextResponse.json(
      { error: 'Failed to connect to Cloudflare Stream' },
      { status: 502 }
    )
  }
}
