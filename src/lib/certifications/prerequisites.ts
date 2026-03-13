/**
 * Certification prerequisite checking — pure functions with no DB calls.
 */

export interface TrackInfo {
  id: string
  slug: string
  title: string
  tier: number
  prerequisite_track_id: string | null
}

export interface EarnedCert {
  track_id: string
}

export interface PrerequisiteStatus {
  met: boolean
  prerequisiteTitle: string | null
  prerequisiteSlug: string | null
}

/**
 * Check if a user has met the prerequisite for a certification track.
 *
 * @param track         - The track to check prerequisites for
 * @param allTracks     - All available tracks (for looking up prerequisite info)
 * @param earnedCertIds - Set of track IDs the user has earned certificates for
 * @returns PrerequisiteStatus with met flag and prerequisite info
 */
export function checkPrerequisite(
  track: TrackInfo,
  allTracks: TrackInfo[],
  earnedCertIds: Set<string>
): PrerequisiteStatus {
  if (!track.prerequisite_track_id) {
    return { met: true, prerequisiteTitle: null, prerequisiteSlug: null }
  }

  const prereqTrack = allTracks.find((t) => t.id === track.prerequisite_track_id)
  if (!prereqTrack) {
    // Prerequisite track doesn't exist — treat as unmet
    return { met: false, prerequisiteTitle: 'Unknown', prerequisiteSlug: null }
  }

  return {
    met: earnedCertIds.has(track.prerequisite_track_id),
    prerequisiteTitle: prereqTrack.title,
    prerequisiteSlug: prereqTrack.slug,
  }
}

/**
 * Get the tier badge color class based on tier number.
 */
export function getTierBadgeColor(tier: number): {
  textColor: string
  borderColor: string
  bgColor: string
  label: string
} {
  switch (tier) {
    case 1:
      return {
        textColor: 'text-[#C0C0C0]',
        borderColor: 'border-[#C0C0C0]',
        bgColor: 'bg-[#1a1a20]',
        label: 'Silver',
      }
    case 2:
      return {
        textColor: 'text-accent',
        borderColor: 'border-accent',
        bgColor: 'bg-accent-muted',
        label: 'Cyan',
      }
    case 3:
      return {
        textColor: 'text-gold',
        borderColor: 'border-gold',
        bgColor: 'bg-gold-muted',
        label: 'Gold',
      }
    default:
      // Domain certifications use gold
      return {
        textColor: 'text-gold',
        borderColor: 'border-gold',
        bgColor: 'bg-gold-muted',
        label: 'Gold',
      }
  }
}

/**
 * Get human-readable tier name.
 */
export function getTierName(tier: number, domain: string | null): string {
  if (domain) return `Domain: ${domain.replace(/_/g, ' ')}`
  switch (tier) {
    case 1: return 'Foundations'
    case 2: return 'Practitioner'
    case 3: return 'Specialist'
    default: return `Tier ${tier}`
  }
}
