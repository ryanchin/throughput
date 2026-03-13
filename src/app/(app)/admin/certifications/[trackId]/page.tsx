import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CertTrackEditor } from '@/components/admin/CertTrackEditor'
import { QuestionPoolManager } from '@/components/admin/QuestionPoolManager'

export const metadata = {
  title: 'Edit Certification Track | Admin',
}

export default async function EditCertTrackPage({
  params,
}: {
  params: Promise<{ trackId: string }>
}) {
  const { trackId } = await params
  const supabase = await createClient()

  // Fetch track
  const { data: track, error: trackError } = await supabase
    .from('certification_tracks')
    .select('*')
    .eq('id', trackId)
    .maybeSingle()

  if (trackError || !track) {
    notFound()
  }

  // Fetch questions for this track
  const { data: questions } = await supabase
    .from('cert_questions')
    .select('*')
    .eq('track_id', trackId)
    .order('created_at', { ascending: true })

  // Fetch all tracks for prerequisite dropdown (exclude current)
  const { data: allTracks } = await supabase
    .from('certification_tracks')
    .select('id, title, tier')
    .neq('id', trackId)
    .order('tier', { ascending: true })

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Back link */}
      <Link
        href="/admin/certifications"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
        data-testid="back-to-cert-tracks"
      >
        &larr; Back to Certification Tracks
      </Link>

      {/* Track editor */}
      <div className="max-w-2xl">
        <CertTrackEditor
          track={track}
          availableTracks={allTracks ?? []}
        />
      </div>

      {/* Question pool manager */}
      <div className="mt-10">
        <QuestionPoolManager
          trackId={trackId}
          questions={questions ?? []}
          questionsPerExam={track.questions_per_exam}
          questionPoolSize={track.question_pool_size}
        />
      </div>
    </div>
  )
}
