import { describe, it, expect } from 'vitest'
import {
  checkPrerequisite,
  getTierBadgeColor,
  getTierName,
  type TrackInfo,
} from '@/lib/certifications/prerequisites'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const foundationsTrack: TrackInfo = {
  id: 'track-foundations',
  slug: 'foundations',
  title: 'AAVA Foundations',
  tier: 1,
  prerequisite_track_id: null,
}

const practitionerTrack: TrackInfo = {
  id: 'track-practitioner',
  slug: 'practitioner',
  title: 'AAVA Practitioner',
  tier: 2,
  prerequisite_track_id: 'track-foundations',
}

const specialistTrack: TrackInfo = {
  id: 'track-specialist',
  slug: 'specialist',
  title: 'AAVA Specialist',
  tier: 3,
  prerequisite_track_id: 'track-practitioner',
}

const orphanTrack: TrackInfo = {
  id: 'track-orphan',
  slug: 'orphan',
  title: 'Orphan Track',
  tier: 2,
  prerequisite_track_id: 'track-nonexistent',
}

const allTracks: TrackInfo[] = [foundationsTrack, practitionerTrack, specialistTrack]

// ---------------------------------------------------------------------------
// checkPrerequisite
// ---------------------------------------------------------------------------

describe('checkPrerequisite', () => {
  it('returns met: true when track has no prerequisite', () => {
    const result = checkPrerequisite(foundationsTrack, allTracks, new Set())

    expect(result).toEqual({
      met: true,
      prerequisiteTitle: null,
      prerequisiteSlug: null,
    })
  })

  it('returns met: false with prerequisite info when prerequisite not earned', () => {
    const result = checkPrerequisite(practitionerTrack, allTracks, new Set())

    expect(result).toEqual({
      met: false,
      prerequisiteTitle: 'AAVA Foundations',
      prerequisiteSlug: 'foundations',
    })
  })

  it('returns met: true when prerequisite is earned', () => {
    const earned = new Set(['track-foundations'])
    const result = checkPrerequisite(practitionerTrack, allTracks, earned)

    expect(result).toEqual({
      met: true,
      prerequisiteTitle: 'AAVA Foundations',
      prerequisiteSlug: 'foundations',
    })
  })

  it('returns met: false with Unknown when prerequisite track not found in allTracks', () => {
    const result = checkPrerequisite(orphanTrack, allTracks, new Set())

    expect(result).toEqual({
      met: false,
      prerequisiteTitle: 'Unknown',
      prerequisiteSlug: null,
    })
  })

  it('handles empty earnedCertIds set for a track with a prerequisite', () => {
    const result = checkPrerequisite(specialistTrack, allTracks, new Set())

    expect(result.met).toBe(false)
    expect(result.prerequisiteTitle).toBe('AAVA Practitioner')
    expect(result.prerequisiteSlug).toBe('practitioner')
  })
})

// ---------------------------------------------------------------------------
// getTierBadgeColor
// ---------------------------------------------------------------------------

describe('getTierBadgeColor', () => {
  it('returns silver colors for tier 1', () => {
    const result = getTierBadgeColor(1)

    expect(result.label).toBe('Silver')
    expect(result.textColor).toBe('text-[#5a6270]')
    expect(result.borderColor).toBe('border-[#b4b4b4]')
  })

  it('returns cyan/accent colors for tier 2', () => {
    const result = getTierBadgeColor(2)

    expect(result.label).toBe('Cyan')
    expect(result.textColor).toBe('text-accent')
    expect(result.borderColor).toBe('border-accent')
    expect(result.bgColor).toBe('bg-accent-muted')
  })

  it('returns gold colors for tier 3', () => {
    const result = getTierBadgeColor(3)

    expect(result.label).toBe('Gold')
    expect(result.textColor).toBe('text-gold')
    expect(result.borderColor).toBe('border-gold')
    expect(result.bgColor).toBe('bg-gold-muted')
  })

  it('returns gold colors for unknown tier (default case)', () => {
    const result = getTierBadgeColor(99)

    expect(result.label).toBe('Gold')
    expect(result.textColor).toBe('text-gold')
    expect(result.borderColor).toBe('border-gold')
    expect(result.bgColor).toBe('bg-gold-muted')
  })
})

// ---------------------------------------------------------------------------
// getTierName
// ---------------------------------------------------------------------------

describe('getTierName', () => {
  it("returns 'Foundations' for tier 1", () => {
    expect(getTierName(1, null)).toBe('Foundations')
  })

  it("returns 'Practitioner' for tier 2", () => {
    expect(getTierName(2, null)).toBe('Practitioner')
  })

  it("returns 'Specialist' for tier 3", () => {
    expect(getTierName(3, null)).toBe('Specialist')
  })

  it('returns domain name with underscores replaced by spaces when domain is provided', () => {
    expect(getTierName(2, 'sprint_planning')).toBe('Domain: sprint planning')
    expect(getTierName(3, 'goal_decomposition')).toBe('Domain: goal decomposition')
  })

  it("returns 'Tier N' for unknown tier numbers", () => {
    expect(getTierName(5, null)).toBe('Tier 5')
    expect(getTierName(0, null)).toBe('Tier 0')
  })
})
