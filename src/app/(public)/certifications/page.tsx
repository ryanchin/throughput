import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { CertificationCards } from '@/components/certifications/CertificationCards'

export const metadata: Metadata = {
  title: 'Get AAVA Product Studio Certified | Throughput',
  description: 'Earn stackable AAVA Product Studio certifications to prove your PM methodology proficiency.',
}

export default async function CertificationsPage() {
  const supabase = await createClient()

  const { data: tracks } = await supabase
    .from('certification_tracks')
    .select('id, title, slug, tier, domain, description, prerequisite_track_id, passing_score, exam_duration_minutes, questions_per_exam')
    .eq('status', 'published')
    .order('tier', { ascending: true })

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

  // Fetch question counts per track for display
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

  // Separate tiered certs from domain certs
  const tieredTracks = (tracks ?? []).filter((t) => !t.domain)
  const domainTracks = (tracks ?? []).filter((t) => !!t.domain)

  // Enrich tracks with prerequisite info and earned status
  const enrichTrack = (track: (typeof tieredTracks)[number]) => {
    let prerequisiteTitle: string | null = null
    let prerequisiteSlug: string | null = null
    let prerequisiteMet: boolean | null = null

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
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal top bar */}
      <nav className="border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <a href="/" className="text-lg font-bold text-foreground">Throughput</a>
          <div className="flex items-center gap-4">
            {user ? (
              <span className="text-sm text-foreground-muted">Signed in</span>
            ) : (
              <>
                <a href="/login" className="text-sm text-foreground-muted hover:text-foreground">
                  Sign In
                </a>
                <a
                  href="/certifications/signup"
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent-hover"
                >
                  Create Free Account
                </a>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8" data-testid="certifications-page">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-brand bg-clip-text text-transparent mb-4">
            Get AAVA Product Studio Certified
          </h1>
          <p className="text-lg text-foreground-muted max-w-2xl mx-auto">
            Earn stackable credentials that signal your PM methodology proficiency.
            Free to enroll, publicly verifiable, LinkedIn-ready.
          </p>
        </div>

        {/* Certification Tier Cards */}
        <CertificationCards
          tieredTracks={tieredTracks.map(enrichTrack)}
          domainTracks={domainTracks.map(enrichTrack)}
          authenticated={!!user}
        />
      </main>
    </div>
  )
}
