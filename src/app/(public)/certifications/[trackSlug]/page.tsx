import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  checkPrerequisite,
  getTierBadgeColor,
  getTierName,
} from '@/lib/certifications/prerequisites'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ trackSlug: string }>
}): Promise<Metadata> {
  const { trackSlug } = await params
  const supabase = await createClient()
  const { data: track } = await supabase
    .from('certification_tracks')
    .select('title, description')
    .eq('slug', trackSlug)
    .eq('status', 'published')
    .single()

  return {
    title: track
      ? `${track.title} | AAVA Certifications`
      : 'Track Not Found',
    description: track?.description ?? '',
  }
}

export default async function TrackOverviewPage({
  params,
}: {
  params: Promise<{ trackSlug: string }>
}) {
  const { trackSlug } = await params
  const supabase = await createClient()

  // Fetch track (belt-and-suspenders: status check alongside RLS)
  const { data: track } = await supabase
    .from('certification_tracks')
    .select(
      'id, title, slug, tier, domain, description, prerequisite_track_id, passing_score, exam_duration_minutes, questions_per_exam, question_pool_size'
    )
    .eq('slug', trackSlug)
    .eq('status', 'published')
    .single()

  if (!track) notFound()

  // Fetch question count
  const { count: questionCount } = await supabase
    .from('cert_questions')
    .select('id', { count: 'exact', head: true })
    .eq('track_id', track.id)

  // Get all published tracks for prerequisite lookup
  const { data: allTracks } = await supabase
    .from('certification_tracks')
    .select('id, slug, title, tier, prerequisite_track_id')
    .eq('status', 'published')

  // Optional auth — user may or may not be signed in
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let earnedTrackIds = new Set<string>()
  if (user) {
    const { data: certs } = await supabase
      .from('certificates')
      .select('track_id')
      .eq('user_id', user.id)
      .eq('revoked', false)
    earnedTrackIds = new Set((certs ?? []).map((c) => c.track_id))
  }

  const prereqStatus = checkPrerequisite(
    {
      id: track.id,
      slug: track.slug,
      title: track.title,
      tier: track.tier,
      prerequisite_track_id: track.prerequisite_track_id,
    },
    (allTracks ?? []).map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      tier: t.tier,
      prerequisite_track_id: t.prerequisite_track_id,
    })),
    earnedTrackIds
  )

  const tierInfo = getTierBadgeColor(track.tier)
  const tierName = getTierName(track.tier, track.domain)
  const isEarned = user ? earnedTrackIds.has(track.id) : false
  const canTakeExam =
    !!user && (!track.prerequisite_track_id || prereqStatus.met)

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="text-lg font-bold text-foreground">
              Throughput
            </a>
            <span className="text-foreground-subtle">/</span>
            <a
              href="/certifications"
              className="text-sm text-foreground-muted hover:text-foreground"
            >
              Certifications
            </a>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <span className="text-sm text-foreground-muted">Signed in</span>
            ) : (
              <>
                <a
                  href="/login"
                  className="text-sm text-foreground-muted hover:text-foreground"
                >
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

      <main
        className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8"
        data-testid="track-overview-page"
      >
        {/* Tier badge */}
        <div className="mb-4">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${tierInfo.textColor} ${tierInfo.borderColor} ${tierInfo.bgColor}`}
          >
            {tierName}
          </span>
        </div>

        {/* Title */}
        <h1
          className="text-3xl sm:text-4xl font-bold text-foreground mb-4"
          data-testid="track-title"
        >
          {track.title}
        </h1>

        {/* Earned badge */}
        {isEarned && (
          <div
            className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-success-muted border border-success text-success text-sm font-medium"
            data-testid="earned-badge"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Certified
          </div>
        )}

        {/* Description */}
        {track.description && (
          <p
            className="text-lg text-foreground-muted mb-8"
            data-testid="track-description"
          >
            {track.description}
          </p>
        )}

        {/* Exam Details Card */}
        <div
          className="bg-surface border border-border rounded-xl p-6 mb-8 shadow-card"
          data-testid="exam-details"
        >
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Exam Details
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {track.questions_per_exam}
              </div>
              <div className="text-sm text-foreground-muted">Questions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {track.exam_duration_minutes} min
              </div>
              <div className="text-sm text-foreground-muted">Duration</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {track.passing_score}%
              </div>
              <div className="text-sm text-foreground-muted">Passing Score</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {questionCount ?? 0}
              </div>
              <div className="text-sm text-foreground-muted">Question Pool</div>
            </div>
          </div>
        </div>

        {/* Prerequisite Status */}
        {track.prerequisite_track_id && (
          <div className="mb-8" data-testid="prerequisite-status">
            {!user ? (
              <div className="flex items-center gap-2 text-foreground-muted bg-muted border border-border rounded-lg px-4 py-3">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span className="text-sm">Sign in to check eligibility</span>
              </div>
            ) : prereqStatus.met ? (
              <div className="flex items-center gap-2 text-success bg-success-muted border border-success rounded-lg px-4 py-3">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span className="text-sm">
                  Prerequisite met: {prereqStatus.prerequisiteTitle}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-warning bg-warning-muted border border-warning rounded-lg px-4 py-3">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span className="text-sm">
                  Complete{' '}
                  <a
                    href={`/certifications/${prereqStatus.prerequisiteSlug}`}
                    className="text-accent hover:text-accent-hover underline"
                  >
                    {prereqStatus.prerequisiteTitle}
                  </a>{' '}
                  first
                </span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div
          className="flex flex-col sm:flex-row gap-4"
          data-testid="track-actions"
        >
          {!user ? (
            <>
              <a
                href="/certifications/signup"
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-accent text-background font-medium hover:bg-accent-hover shadow-accent-glow"
              >
                Create Free Account to Start
              </a>
              <a
                href="/login"
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-muted border border-border text-foreground font-medium hover:bg-raised"
              >
                Sign In
              </a>
            </>
          ) : isEarned ? (
            <a
              href="/certifications/verify"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-accent text-background font-medium hover:bg-accent-hover"
            >
              View Certificate
            </a>
          ) : canTakeExam ? (
            <button
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-accent text-background font-medium hover:bg-accent-hover shadow-accent-glow"
              data-testid="take-exam-btn"
            >
              Take Exam
            </button>
          ) : (
            <button
              disabled
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-muted border border-border text-foreground-muted font-medium cursor-not-allowed opacity-50"
              data-testid="take-exam-btn-disabled"
            >
              Complete Prerequisite to Take Exam
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
