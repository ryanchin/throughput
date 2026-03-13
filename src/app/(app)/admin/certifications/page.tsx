import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/admin/StatusBadge'

export const metadata = {
  title: 'Certification Tracks | Admin',
}

const TIER_LABELS: Record<number, string> = {
  1: 'Foundations',
  2: 'Practitioner',
  3: 'Specialist',
}

export default async function AdminCertificationsPage() {
  const supabase = await createClient()

  // Verify admin access
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/training')
  }

  // Fetch all certification tracks (draft + published)
  const { data: tracks, error: tracksError } = await supabase
    .from('certification_tracks')
    .select('*')
    .order('tier', { ascending: true })
    .order('created_at', { ascending: false })

  if (tracksError) {
    return (
      <div className="text-center py-12">
        <p className="text-foreground-muted">Failed to load certification tracks. Please try again.</p>
      </div>
    )
  }

  // Fetch question counts per track
  const trackIds = (tracks ?? []).map((t) => t.id)
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

  const enrichedTracks = (tracks ?? []).map((track) => ({
    ...track,
    question_count: questionCountMap[track.id] ?? 0,
  }))

  return (
    <div data-testid="admin-cert-tracks">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Certification Tracks</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Manage public certification tracks and question pools.
          </p>
        </div>
        <Link
          href="/admin/certifications/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
          data-testid="new-track-button"
        >
          New Track
        </Link>
      </div>

      {/* Track list */}
      <div className="mt-8">
        {enrichedTracks.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
                <table className="w-full" data-testid="cert-tracks-table">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                        Title
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                        Tier
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                        Status
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                        Questions
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {enrichedTracks.map((track) => {
                      const poolReady = track.question_count >= track.questions_per_exam
                      return (
                        <tr
                          key={track.id}
                          className="transition-colors hover:bg-raised"
                          data-testid={`cert-track-row-${track.slug}`}
                        >
                          <td className="px-5 py-4">
                            <div>
                              <Link
                                href={`/admin/certifications/${track.id}`}
                                className="text-sm font-medium text-foreground hover:text-accent transition-colors"
                              >
                                {track.title}
                              </Link>
                              {track.domain && (
                                <p className="mt-0.5 text-xs text-foreground-muted">
                                  Domain: {track.domain}
                                </p>
                              )}
                              {track.description && (
                                <p className="mt-0.5 text-xs text-foreground-muted line-clamp-1 max-w-md">
                                  {track.description}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <TierBadge tier={track.tier} />
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge status={track.status} />
                          </td>
                          <td className="px-5 py-4 text-center">
                            <QuestionPoolIndicator
                              count={track.question_count}
                              required={track.questions_per_exam}
                              poolSize={track.question_pool_size}
                              ready={poolReady}
                            />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Link
                              href={`/admin/certifications/${track.id}`}
                              className="text-sm text-accent hover:text-accent-hover transition-colors"
                            >
                              Edit
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile card list */}
            <div className="space-y-3 md:hidden">
              {enrichedTracks.map((track) => {
                const poolReady = track.question_count >= track.questions_per_exam
                return (
                  <div
                    key={track.id}
                    className="rounded-xl border border-border bg-surface p-4 shadow-card"
                    data-testid={`cert-track-card-${track.slug}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Link
                          href={`/admin/certifications/${track.id}`}
                          className="text-sm font-medium text-foreground hover:text-accent transition-colors"
                        >
                          {track.title}
                        </Link>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <TierBadge tier={track.tier} />
                          <StatusBadge status={track.status} />
                        </div>
                      </div>
                    </div>
                    {track.description && (
                      <p className="mt-2 text-xs text-foreground-muted line-clamp-2">
                        {track.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-4 text-xs text-foreground-muted">
                      <QuestionPoolIndicator
                        count={track.question_count}
                        required={track.questions_per_exam}
                        poolSize={track.question_pool_size}
                        ready={poolReady}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TierBadge({ tier }: { tier: number }) {
  const colors: Record<number, string> = {
    1: 'bg-[var(--background-muted)] text-foreground-muted',
    2: 'bg-accent-muted text-accent',
    3: 'bg-gold-muted text-gold',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        colors[tier] ?? 'bg-[var(--background-muted)] text-foreground-muted'
      }`}
      data-testid={`tier-badge-${tier}`}
    >
      Tier {tier} — {TIER_LABELS[tier] ?? `Tier ${tier}`}
    </span>
  )
}

function QuestionPoolIndicator({
  count,
  required,
  poolSize,
  ready,
}: {
  count: number
  required: number
  poolSize: number
  ready: boolean
}) {
  return (
    <span
      className={`text-xs font-medium ${ready ? 'text-success' : 'text-warning'}`}
      data-testid="question-pool-indicator"
    >
      {count}/{poolSize}
      {!ready && (
        <span className="ml-1 text-foreground-muted">(min {required})</span>
      )}
    </span>
  )
}

function EmptyState() {
  return (
    <div
      className="rounded-xl border border-border bg-surface p-12 text-center shadow-card"
      data-testid="cert-tracks-empty-state"
    >
      <svg
        className="mx-auto size-12 text-foreground-muted"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5"
        />
      </svg>
      <h3 className="mt-4 text-lg font-semibold text-foreground">No certification tracks yet</h3>
      <p className="mt-1 text-sm text-foreground-muted">
        Get started by creating your first certification track.
      </p>
      <div className="mt-6">
        <Link
          href="/admin/certifications/new"
          className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
          data-testid="empty-new-track-button"
        >
          Create Track
        </Link>
      </div>
    </div>
  )
}
