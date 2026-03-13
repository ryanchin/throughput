import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'

type RouteParams = {
  params: Promise<{ trackId: string }>
}

/**
 * GET /api/admin/certifications/[trackId]
 * Fetches a single certification track with all fields for admin viewing/editing.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { trackId } = await params
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { data: track, error } = await supabase
    .from('certification_tracks')
    .select('*')
    .eq('id', trackId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch certification track' }, { status: 500 })
  }

  if (!track) {
    return NextResponse.json({ error: 'Certification track not found' }, { status: 404 })
  }

  return NextResponse.json({ track })
}

const updateTrackSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  tier: z.number().int().min(1).max(3).optional(),
  domain: z.string().max(100).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  prerequisite_track_id: z.string().uuid().nullable().optional(),
  passing_score: z.number().int().min(0).max(100).optional(),
  exam_duration_minutes: z.number().int().min(1).max(480).optional(),
  questions_per_exam: z.number().int().min(1).max(200).optional(),
  question_pool_size: z.number().int().min(1).max(500).optional(),
  status: z.enum(['draft', 'published']).optional(),
})

/**
 * PATCH /api/admin/certifications/[trackId]
 * Updates an existing certification track. All fields are optional.
 * If slug is changed, checks uniqueness (excluding current track).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { trackId } = await params
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = updateTrackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const updates = parsed.data

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Verify track exists
  const { data: existingTrack } = await supabase
    .from('certification_tracks')
    .select('id')
    .eq('id', trackId)
    .maybeSingle()

  if (!existingTrack) {
    return NextResponse.json({ error: 'Certification track not found' }, { status: 404 })
  }

  // If slug is being updated, check uniqueness (excluding this track)
  if (updates.slug) {
    const { data: slugConflict } = await supabase
      .from('certification_tracks')
      .select('id')
      .eq('slug', updates.slug)
      .neq('id', trackId)
      .maybeSingle()

    if (slugConflict) {
      return NextResponse.json(
        { error: 'A certification track with this slug already exists' },
        { status: 409 }
      )
    }
  }

  // Validate prerequisite_track_id if provided and not null
  if (updates.prerequisite_track_id) {
    // Prevent self-reference
    if (updates.prerequisite_track_id === trackId) {
      return NextResponse.json(
        { error: 'A track cannot be its own prerequisite' },
        { status: 400 }
      )
    }

    const { data: prereq } = await supabase
      .from('certification_tracks')
      .select('id')
      .eq('id', updates.prerequisite_track_id)
      .maybeSingle()

    if (!prereq) {
      return NextResponse.json(
        { error: 'Prerequisite track not found' },
        { status: 400 }
      )
    }
  }

  const { data: track, error } = await supabase
    .from('certification_tracks')
    .update(updates)
    .eq('id', trackId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update certification track' }, { status: 500 })
  }

  return NextResponse.json({ track })
}

/**
 * DELETE /api/admin/certifications/[trackId]
 * Deletes a certification track. Questions cascade via FK constraint.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { trackId } = await params
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // Verify track exists
  const { data: existingTrack } = await supabase
    .from('certification_tracks')
    .select('id')
    .eq('id', trackId)
    .maybeSingle()

  if (!existingTrack) {
    return NextResponse.json({ error: 'Certification track not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('certification_tracks')
    .delete()
    .eq('id', trackId)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete certification track' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
