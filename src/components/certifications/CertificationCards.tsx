'use client'

import { getTierBadgeColor, getTierName } from '@/lib/certifications/prerequisites'

export interface EnrichedTrack {
  id: string
  title: string
  slug: string
  tier: number
  domain: string | null
  description: string | null
  passingScore: number
  examDurationMinutes: number
  questionsPerExam: number
  questionPoolSize: number
  prerequisiteMet: boolean | null
  prerequisiteTitle: string | null
  prerequisiteSlug: string | null
  earned: boolean | null
}

interface CertificationCardsProps {
  tieredTracks: EnrichedTrack[]
  domainTracks: EnrichedTrack[]
  authenticated: boolean
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className ?? 'h-4 w-4'}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className ?? 'h-4 w-4'}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function PrerequisiteIndicator({
  track,
  authenticated,
}: {
  track: EnrichedTrack
  authenticated: boolean
}) {
  // No prerequisite — nothing to show
  if (!track.prerequisiteTitle) {
    return null
  }

  // Not authenticated — prompt to sign in
  if (!authenticated) {
    return (
      <div
        className="flex items-center gap-2 text-sm text-foreground-muted"
        data-testid="prerequisite-status"
      >
        <LockIcon className="h-4 w-4 shrink-0" />
        <span>Sign in to check eligibility</span>
      </div>
    )
  }

  // Authenticated + prerequisite met
  if (track.prerequisiteMet) {
    return (
      <div
        className="flex items-center gap-2 text-sm text-[#10B981]"
        data-testid="prerequisite-status"
      >
        <CheckIcon className="h-4 w-4 shrink-0" />
        <span>Prerequisite met: {track.prerequisiteTitle}</span>
      </div>
    )
  }

  // Authenticated + prerequisite NOT met
  return (
    <div
      className="flex items-center gap-2 text-sm text-foreground-muted"
      data-testid="prerequisite-status"
    >
      <LockIcon className="h-4 w-4 shrink-0" />
      <span>
        Complete{' '}
        {track.prerequisiteSlug ? (
          <a
            href={`/certifications/${track.prerequisiteSlug}`}
            className="text-accent hover:underline"
          >
            {track.prerequisiteTitle}
          </a>
        ) : (
          track.prerequisiteTitle
        )}{' '}
        first
      </span>
    </div>
  )
}

function TrackCard({
  track,
  authenticated,
}: {
  track: EnrichedTrack
  authenticated: boolean
}) {
  const badge = getTierBadgeColor(track.tier)
  const tierName = getTierName(track.tier, track.domain)

  return (
    <div
      className="bg-surface border border-border rounded-xl shadow-card p-6 flex flex-col gap-4"
      data-testid={`tier-card-${track.slug}`}
    >
      {/* Header: tier badge + earned badge */}
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${badge.textColor} ${badge.borderColor} ${badge.bgColor}`}
        >
          {tierName}
        </span>

        {track.earned && (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-[#10B981] border border-[#10B981] bg-[#052E20]"
            data-testid="earned-badge"
          >
            <CheckIcon className="h-3.5 w-3.5" />
            Certified
          </span>
        )}
      </div>

      {/* Title + description */}
      <div>
        <h3 className="text-xl font-semibold text-foreground mb-2">{track.title}</h3>
        {track.description && (
          <p className="text-sm text-foreground-muted leading-relaxed">{track.description}</p>
        )}
      </div>

      {/* Exam info */}
      <div className="text-sm text-foreground-muted">
        {track.questionsPerExam} questions &middot; {track.examDurationMinutes} minutes &middot;{' '}
        {track.passingScore}% to pass
      </div>

      {/* Prerequisite indicator */}
      <PrerequisiteIndicator track={track} authenticated={authenticated} />

      {/* CTA */}
      <div className="mt-auto pt-2">
        <a
          href={`/certifications/${track.slug}`}
          className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          View Track
        </a>
      </div>
    </div>
  )
}

export function CertificationCards({
  tieredTracks,
  domainTracks,
  authenticated,
}: CertificationCardsProps) {
  return (
    <div className="space-y-16">
      {/* Tiered Certifications */}
      {tieredTracks.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-2">Certification Path</h2>
          <p className="text-foreground-muted mb-8">
            Progress through the tiers to build your AAVA credentials.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tieredTracks.map((track) => (
              <TrackCard key={track.id} track={track} authenticated={authenticated} />
            ))}
          </div>
        </section>
      )}

      {/* Domain Certifications */}
      {domainTracks.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-2">Domain Certifications</h2>
          <p className="text-foreground-muted mb-8">
            Specialize in specific areas of PM methodology with domain-level credentials.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {domainTracks.map((track) => (
              <TrackCard key={track.id} track={track} authenticated={authenticated} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {tieredTracks.length === 0 && domainTracks.length === 0 && (
        <div className="text-center py-16">
          <p className="text-foreground-muted text-lg">
            No certification tracks are available yet. Check back soon.
          </p>
        </div>
      )}
    </div>
  )
}
