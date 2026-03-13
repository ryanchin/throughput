import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'

/**
 * GET /api/admin/certifications
 * Lists ALL certification tracks (draft + published) for admin users.
 * Includes question_count per track from cert_questions.
 */
export async function GET() {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { data: tracks, error } = await supabase
    .from('certification_tracks')
    .select('*')
    .order('tier', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch certification tracks' }, { status: 500 })
  }

  // Fetch question counts per track
  const trackIds = tracks.map((t) => t.id)

  let questionCountMap: Record<string, number> = {}

  if (trackIds.length > 0) {
    const { data: questionRows } = await supabase
      .from('cert_questions')
      .select('track_id')
      .in('track_id', trackIds)

    for (const row of questionRows ?? []) {
      questionCountMap[row.track_id] = (questionCountMap[row.track_id] ?? 0) + 1
    }
  }

  const enrichedTracks = tracks.map((track) => ({
    ...track,
    question_count: questionCountMap[track.id] ?? 0,
  }))

  return NextResponse.json({ tracks: enrichedTracks })
}

const createTrackSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  slug: z.string().min(1, 'Slug is required').max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  tier: z.number().int().min(1).max(3),
  domain: z.string().max(100).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  prerequisite_track_id: z.string().uuid().nullable().optional(),
  passing_score: z.number().int().min(0).max(100).optional().default(80),
  exam_duration_minutes: z.number().int().min(1).max(480).optional().default(60),
  questions_per_exam: z.number().int().min(1).max(200).optional().default(30),
  question_pool_size: z.number().int().min(1).max(500).optional().default(50),
})

/**
 * POST /api/admin/certifications
 * Creates a new certification track in draft status.
 * Validates input with Zod and checks slug uniqueness.
 */
export async function POST(request: NextRequest) {
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

  const parsed = createTrackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const data = parsed.data

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from('certification_tracks')
    .select('id')
    .eq('slug', data.slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'A certification track with this slug already exists' },
      { status: 409 }
    )
  }

  // Validate prerequisite_track_id exists if provided
  if (data.prerequisite_track_id) {
    const { data: prereq } = await supabase
      .from('certification_tracks')
      .select('id')
      .eq('id', data.prerequisite_track_id)
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
    .insert({
      title: data.title,
      slug: data.slug,
      tier: data.tier,
      domain: data.domain ?? null,
      description: data.description ?? null,
      prerequisite_track_id: data.prerequisite_track_id ?? null,
      passing_score: data.passing_score,
      exam_duration_minutes: data.exam_duration_minutes,
      questions_per_exam: data.questions_per_exam,
      question_pool_size: data.question_pool_size,
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create certification track' }, { status: 500 })
  }

  return NextResponse.json({ track }, { status: 201 })
}
