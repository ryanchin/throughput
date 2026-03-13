import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkPrerequisite } from '@/lib/certifications/prerequisites'

/**
 * GET /api/certifications/[slug]
 *
 * Returns a single published certification track by slug, enriched with
 * question pool size and optional user-specific data (prerequisite status,
 * earned status) if authenticated.
 *
 * Public endpoint — no auth required. Optionally enriches response with
 * user data when a valid session exists.
 *
 * Belt-and-suspenders: filters status='published' in query AND RLS.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createClient()

  // Fetch the published track by slug
  const { data: track, error: trackError } = await supabase
    .from('certification_tracks')
    .select('id, title, slug, tier, domain, description, prerequisite_track_id, passing_score, exam_duration_minutes, questions_per_exam')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (trackError || !track) {
    return NextResponse.json({ error: 'Certification track not found' }, { status: 404 })
  }

  // Get actual question count for this track (don't return the questions themselves)
  const { count: questionPoolSize, error: countError } = await supabase
    .from('cert_questions')
    .select('id', { count: 'exact', head: true })
    .eq('track_id', track.id)

  if (countError) {
    return NextResponse.json({ error: 'Failed to fetch question pool size' }, { status: 500 })
  }

  // Try to get authenticated user — optional, don't error if not logged in
  const { data: { user } } = await supabase.auth.getUser()

  let prerequisiteMet: boolean | null = null
  let prerequisiteTitle: string | null = null
  let prerequisiteSlug: string | null = null
  let earned: boolean | null = null

  if (user) {
    // Fetch earned certificates for prerequisite and earned checks
    const { data: certs } = await supabase
      .from('certificates')
      .select('track_id')
      .eq('user_id', user.id)
      .eq('revoked', false)

    const earnedTrackIds = new Set((certs ?? []).map((c) => c.track_id))
    earned = earnedTrackIds.has(track.id)

    // Check prerequisite status if the track has one
    if (track.prerequisite_track_id) {
      // Fetch all published tracks for prerequisite lookup
      const { data: allTracks } = await supabase
        .from('certification_tracks')
        .select('id, slug, title, tier, prerequisite_track_id')
        .eq('status', 'published')

      const prereqStatus = checkPrerequisite(
        track,
        allTracks ?? [],
        earnedTrackIds
      )
      prerequisiteMet = prereqStatus.met
      prerequisiteTitle = prereqStatus.prerequisiteTitle
      prerequisiteSlug = prereqStatus.prerequisiteSlug
    }
  } else if (track.prerequisite_track_id) {
    // Not authenticated but track has a prerequisite — still resolve title/slug
    const { data: prereqTrack } = await supabase
      .from('certification_tracks')
      .select('title, slug')
      .eq('id', track.prerequisite_track_id)
      .eq('status', 'published')
      .single()

    prerequisiteTitle = prereqTrack?.title ?? null
    prerequisiteSlug = prereqTrack?.slug ?? null
  }

  return NextResponse.json({
    track: {
      id: track.id,
      title: track.title,
      slug: track.slug,
      tier: track.tier,
      domain: track.domain,
      description: track.description,
      passingScore: track.passing_score,
      examDurationMinutes: track.exam_duration_minutes,
      questionsPerExam: track.questions_per_exam,
      questionPoolSize: questionPoolSize ?? 0,
      prerequisiteMet,
      prerequisiteTitle,
      prerequisiteSlug,
      earned,
      authenticated: !!user,
    },
  })
}
