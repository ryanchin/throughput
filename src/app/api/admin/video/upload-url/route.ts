import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'

const uploadUrlSchema = z.object({
  title: z.string().optional().default('Untitled Video'),
})

/**
 * POST /api/admin/video/upload-url
 *
 * Creates a video entry in Bunny.net Stream and returns the upload URL.
 * The frontend uploads directly to Bunny.net via PUT — the video never passes through our server.
 *
 * Auth: admin only
 * Body: { title?: string }
 * Returns: { uploadUrl: string, uid: string, authKey: string }
 */
export async function POST(request: NextRequest) {
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

  const { title } = parsed.data

  try {
    // Step 1: Create video entry in Bunny.net Stream
    const response = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos`,
      {
        method: 'POST',
        headers: {
          AccessKey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      }
    )

    const data = await response.json()

    if (!response.ok || !data.guid) {
      console.error('Bunny.net Stream upload-url error:', data)
      return NextResponse.json(
        { error: 'Failed to create video in Bunny.net Stream' },
        { status: 502 }
      )
    }

    // Step 2: Return the upload URL — client will PUT the file directly
    const uploadUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${data.guid}`

    return NextResponse.json({
      uploadUrl,
      uid: data.guid,
      authKey: apiKey,
    })
  } catch (err) {
    console.error('Bunny.net Stream upload-url request failed:', err)
    return NextResponse.json(
      { error: 'Failed to connect to Bunny.net Stream' },
      { status: 502 }
    )
  }
}
