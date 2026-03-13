import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/certifications
 *
 * Returns all published certification tracks. If the user is authenticated,
 * includes prerequisite status based on their earned certificates.
 * No auth required — public endpoint.
 */
export async function GET() {
  const supabase = await createClient()

  // No auth required — certifications are public
  const { data: tracks, error } = await supabase
    .from('certification_tracks')
    .select('id, title, slug, tier, domain, description, prerequisite_track_id, passing_score, exam_duration_minutes, questions_per_exam, question_pool_size')
    .eq('status', 'published')
    .order('tier', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch certification tracks' }, { status: 500 })
  }

  // Try to get authenticated user for prerequisite checking
  const { data: { user } } = await supabase.auth.getUser()

  let earnedTrackIds: string[] = []
  if (user) {
    const { data: certs } = await supabase
      .from('certificates')
      .select('track_id')
      .eq('user_id', user.id)
      .eq('revoked', false)

    earnedTrackIds = (certs ?? []).map((c) => c.track_id)
  }

  const earnedSet = new Set(earnedTrackIds)

  // Fetch question counts per track
  const trackIds = (tracks ?? []).map((t) => t.id)
  const questionCounts = new Map<string, number>()
  if (trackIds.length > 0) {
    const { data: questions } = await supabase
      .from('cert_questions')
      .select('track_id')
      .in('track_id', trackIds)

    for (const q of questions ?? []) {
      questionCounts.set(q.track_id, (questionCounts.get(q.track_id) ?? 0) + 1)
    }
  }

  const enrichedTracks = (tracks ?? []).map((track) => {
    let prerequisiteMet: boolean | null = null
    let prerequisiteTitle: string | null = null
    let prerequisiteSlug: string | null = null

    if (track.prerequisite_track_id) {
      const prereq = (tracks ?? []).find((t) => t.id === track.prerequisite_track_id)
      prerequisiteTitle = prereq?.title ?? null
      prerequisiteSlug = prereq?.slug ?? null

      if (user) {
        prerequisiteMet = earnedSet.has(track.prerequisite_track_id)
      }
    }

    return {
      id: track.id,
      title: track.title,
      slug: track.slug,
      tier: track.tier,
      domain: track.domain,
      description: track.description,
      passingScore: track.passing_score,
      examDurationMinutes: track.exam_duration_minutes,
      questionsPerExam: track.questions_per_exam,
      questionPoolSize: questionCounts.get(track.id) ?? 0,
      prerequisiteMet,
      prerequisiteTitle,
      prerequisiteSlug,
      earned: user ? earnedSet.has(track.id) : null,
    }
  })

  return NextResponse.json({
    tracks: enrichedTracks,
    authenticated: !!user,
  })
}
