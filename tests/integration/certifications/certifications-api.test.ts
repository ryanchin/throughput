import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    })
  ),
}))

vi.mock('@/lib/certifications/prerequisites', () => ({
  checkPrerequisite: vi.fn(() => ({
    met: true,
    prerequisiteTitle: 'AAVA Foundations',
    prerequisiteSlug: 'aava-foundations',
  })),
}))

import { GET as GET_LIST } from '@/app/api/certifications/route'
import { GET as GET_SLUG } from '@/app/api/certifications/[slug]/route'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createChain(terminalData: unknown = null, terminalError: unknown = null) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: terminalData, error: terminalError }),
    maybeSingle: vi.fn().mockResolvedValue({ data: terminalData, error: terminalError }),
    then: undefined as unknown,
  }
  chain.then = (resolve: (v: unknown) => unknown) =>
    resolve({
      data: Array.isArray(terminalData) ? terminalData : terminalData ? [terminalData] : [],
      error: terminalError,
      count: Array.isArray(terminalData) ? terminalData.length : terminalData ? 1 : 0,
    })
  return chain
}

const TRACK_ID_1 = 't1111111-1111-4111-a111-111111111111'
const TRACK_ID_2 = 't2222222-2222-4222-a222-222222222222'
const USER_ID = 'u1111111-1111-4111-a111-111111111111'

const mockTrack1 = {
  id: TRACK_ID_1,
  title: 'AAVA Foundations',
  slug: 'aava-foundations',
  tier: 1,
  domain: null,
  description: 'Foundation-level certification',
  prerequisite_track_id: null,
  passing_score: 80,
  exam_duration_minutes: 60,
  questions_per_exam: 30,
  question_pool_size: 50,
}

const mockTrack2 = {
  id: TRACK_ID_2,
  title: 'AAVA Practitioner',
  slug: 'aava-practitioner',
  tier: 2,
  domain: null,
  description: 'Practitioner-level certification',
  prerequisite_track_id: TRACK_ID_1,
  passing_score: 80,
  exam_duration_minutes: 90,
  questions_per_exam: 40,
  question_pool_size: 60,
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// GET /api/certifications
// ---------------------------------------------------------------------------

describe('GET /api/certifications', () => {
  it('returns published tracks for unauthenticated users', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) return createChain([mockTrack1, mockTrack2]) // certification_tracks
      if (fromCallCount === 2) return createChain([{ track_id: TRACK_ID_1 }, { track_id: TRACK_ID_2 }]) // cert_questions
      return createChain([])
    })

    // Unauthenticated user
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await GET_LIST()
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.authenticated).toBe(false)
    expect(data.tracks).toHaveLength(2)
    expect(data.tracks[0].title).toBe('AAVA Foundations')
    expect(data.tracks[0].prerequisiteMet).toBeNull()
    expect(data.tracks[0].earned).toBeNull()
    expect(data.tracks[1].title).toBe('AAVA Practitioner')
    expect(data.tracks[1].earned).toBeNull()
  })

  it('includes prerequisite status for authenticated users', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) return createChain([mockTrack1, mockTrack2]) // certification_tracks
      if (fromCallCount === 2) return createChain([{ track_id: TRACK_ID_1 }]) // certificates (user earned track 1)
      if (fromCallCount === 3) return createChain([{ track_id: TRACK_ID_1 }, { track_id: TRACK_ID_2 }]) // cert_questions
      return createChain([])
    })

    // Authenticated user
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const res = await GET_LIST()
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.authenticated).toBe(true)
    expect(data.tracks).toHaveLength(2)

    // Track 1: no prerequisite, user earned it
    expect(data.tracks[0].earned).toBe(true)
    expect(data.tracks[0].prerequisiteMet).toBeNull()

    // Track 2: has prerequisite (track 1), user earned track 1 so met = true
    expect(data.tracks[1].earned).toBe(false)
    expect(data.tracks[1].prerequisiteMet).toBe(true)
    expect(data.tracks[1].prerequisiteTitle).toBe('AAVA Foundations')
    expect(data.tracks[1].prerequisiteSlug).toBe('aava-foundations')
  })

  it('returns empty tracks array when no tracks exist', async () => {
    mockFrom.mockImplementation(() => createChain([]))
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await GET_LIST()
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.tracks).toEqual([])
  })

  it('returns 500 when database query fails', async () => {
    mockFrom.mockImplementation(() => createChain(null, { message: 'DB error' }))
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await GET_LIST()
    expect(res.status).toBe(500)

    const data = await res.json()
    expect(data.error).toBe('Failed to fetch certification tracks')
  })
})

// ---------------------------------------------------------------------------
// GET /api/certifications/[slug]
// ---------------------------------------------------------------------------

describe('GET /api/certifications/[slug]', () => {
  function makeRequest(slug: string) {
    return new NextRequest(`http://localhost/api/certifications/${slug}`)
  }

  it('returns track detail for a valid slug', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) return createChain(mockTrack1) // certification_tracks .single()
      if (fromCallCount === 2) return createChain([]) // cert_questions count
      return createChain([])
    })

    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await GET_SLUG(makeRequest('aava-foundations'), {
      params: Promise.resolve({ slug: 'aava-foundations' }),
    })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.track.title).toBe('AAVA Foundations')
    expect(data.track.slug).toBe('aava-foundations')
    expect(data.track.tier).toBe(1)
    expect(data.track.passingScore).toBe(80)
    expect(data.track.examDurationMinutes).toBe(60)
    expect(data.track.authenticated).toBe(false)
  })

  it('returns 404 for non-existent slug', async () => {
    mockFrom.mockImplementation(() =>
      createChain(null, { message: 'Not found', code: 'PGRST116' })
    )

    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await GET_SLUG(makeRequest('nonexistent'), {
      params: Promise.resolve({ slug: 'nonexistent' }),
    })
    expect(res.status).toBe(404)

    const data = await res.json()
    expect(data.error).toBe('Certification track not found')
  })

  it('returns prerequisite status when authenticated', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) return createChain(mockTrack2) // certification_tracks .single()
      if (fromCallCount === 2) return createChain([]) // cert_questions count
      if (fromCallCount === 3) return createChain([{ track_id: TRACK_ID_1 }]) // certificates
      if (fromCallCount === 4) return createChain([mockTrack1, mockTrack2]) // all published tracks for prereq check
      return createChain([])
    })

    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const res = await GET_SLUG(makeRequest('aava-practitioner'), {
      params: Promise.resolve({ slug: 'aava-practitioner' }),
    })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.track.earned).toBe(false)
    expect(data.track.prerequisiteMet).toBe(true)
    expect(data.track.prerequisiteTitle).toBe('AAVA Foundations')
    expect(data.track.prerequisiteSlug).toBe('aava-foundations')
    expect(data.track.authenticated).toBe(true)
  })

  it('returns earned null and prerequisiteMet null when not authenticated', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation(() => {
      fromCallCount++
      if (fromCallCount === 1) return createChain(mockTrack2) // certification_tracks .single()
      if (fromCallCount === 2) return createChain([]) // cert_questions count
      if (fromCallCount === 3) {
        // Unauthenticated prereq title/slug lookup
        return createChain({ title: 'AAVA Foundations', slug: 'aava-foundations' })
      }
      return createChain([])
    })

    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await GET_SLUG(makeRequest('aava-practitioner'), {
      params: Promise.resolve({ slug: 'aava-practitioner' }),
    })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.track.earned).toBeNull()
    expect(data.track.prerequisiteMet).toBeNull()
    expect(data.track.prerequisiteTitle).toBe('AAVA Foundations')
    expect(data.track.prerequisiteSlug).toBe('aava-foundations')
    expect(data.track.authenticated).toBe(false)
  })
})
