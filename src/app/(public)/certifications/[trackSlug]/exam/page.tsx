import { redirect, notFound } from 'next/navigation'
import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { CertExamPlayer } from '@/components/certifications/CertExamPlayer'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ trackSlug: string }>
}): Promise<Metadata> {
  const { trackSlug } = await params
  return { title: `Exam: ${trackSlug} | AAVA Certifications` }
}

export default async function CertExamPage({
  params,
}: {
  params: Promise<{ trackSlug: string }>
}) {
  const { trackSlug } = await params
  const supabase = await createClient()

  // Auth required
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?redirect=/certifications/${trackSlug}/exam`)
  }

  // Fetch track
  const { data: track } = await supabase
    .from('certification_tracks')
    .select(
      'id, title, slug, tier, domain, prerequisite_track_id, passing_score, exam_duration_minutes, questions_per_exam'
    )
    .eq('slug', trackSlug)
    .eq('status', 'published')
    .single()

  if (!track) notFound()

  // Check prerequisite
  if (track.prerequisite_track_id) {
    const { data: prereqCert } = await supabase
      .from('certificates')
      .select('id')
      .eq('user_id', user.id)
      .eq('track_id', track.prerequisite_track_id)
      .eq('revoked', false)
      .limit(1)
      .maybeSingle()

    if (!prereqCert) {
      redirect(`/certifications/${trackSlug}`)
    }
  }

  // Check attempt limit (3 per 30 days)
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString()
  const { data: recentAttempts } = await supabase
    .from('cert_attempts')
    .select('id, started_at, submitted_at, expires_at, score, passed')
    .eq('user_id', user.id)
    .eq('track_id', track.id)
    .gte('started_at', thirtyDaysAgo)
    .order('started_at', { ascending: false })

  const submittedAttempts = (recentAttempts ?? []).filter(
    (a) => a.submitted_at !== null
  )
  const inProgressAttempt = (recentAttempts ?? []).find(
    (a) => a.submitted_at === null
  )

  const attemptsUsed =
    submittedAttempts.length + (inProgressAttempt ? 1 : 0)
  const maxAttempts = 3
  // Most recent submitted attempt's cooldown
  const cooldownUntil = submittedAttempts[0]?.expires_at ?? null

  return (
    <div className="min-h-screen bg-background">
      <CertExamPlayer
        trackId={track.id}
        trackTitle={track.title}
        trackSlug={track.slug}
        tier={track.tier}
        passingScore={track.passing_score}
        examDurationMinutes={track.exam_duration_minutes}
        questionsPerExam={track.questions_per_exam}
        attemptsUsed={attemptsUsed}
        maxAttempts={maxAttempts}
        cooldownUntil={cooldownUntil}
        hasInProgressAttempt={!!inProgressAttempt}
      />
    </div>
  )
}
