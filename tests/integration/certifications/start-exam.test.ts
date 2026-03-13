import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockServiceFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    })
  ),
  createServiceClient: vi.fn(() => ({
    from: mockServiceFrom,
  })),
}))

vi.mock('@/lib/certifications/sampling', () => ({
  stratifiedSample: vi.fn().mockReturnValue(['q1', 'q2', 'q3']),
}))

import { POST } from '@/app/api/certifications/start-exam/route'

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
    gte: vi.fn().mockReturnThis(),
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

/**
 * Create a chain where the thenable resolves with a specific count value,
 * used for `.select('id', { count: 'exact', head: true })` queries.
 */
function createCountChain(count: number, error: unknown = null) {
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
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error }),
    then: undefined as unknown,
  }
  chain.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: null, error, count })
  return chain
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/certifications/start-exam', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const USER_ID = '11111111-1111-4111-a111-111111111111'
const TRACK_ID = '22222222-2222-4222-a222-222222222222'
const PREREQ_TRACK_ID = '33333333-3333-4333-a333-333333333333'

const mockTrack = {
  id: TRACK_ID,
  title: 'AAVA Foundations',
  slug: 'aava-foundations',
  tier: 1,
  prerequisite_track_id: null,
  passing_score: 80,
  exam_duration_minutes: 60,
  question_pool_size: 50,
  questions_per_exam: 3,
  status: 'published',
}

const mockTrackWithPrereq = {
  ...mockTrack,
  id: '44444444-4444-4444-a444-444444444444',
  title: 'AAVA Practitioner',
  slug: 'aava-practitioner',
  tier: 2,
  prerequisite_track_id: PREREQ_TRACK_ID,
}

const mockQuestions = [
  { id: 'q1', question_text: 'Q1?', question_type: 'multiple_choice', options: [], max_points: 10, difficulty: 'easy' },
  { id: 'q2', question_text: 'Q2?', question_type: 'multiple_choice', options: [], max_points: 10, difficulty: 'medium' },
  { id: 'q3', question_text: 'Q3?', question_type: 'open_ended', options: null, max_points: 10, difficulty: 'hard' },
]

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// POST /api/certifications/start-exam
// ---------------------------------------------------------------------------

describe('POST /api/certifications/start-exam', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No session' } })

    const res = await POST(makeRequest({ trackId: TRACK_ID }))
    expect(res.status).toBe(401)

    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 400 for missing trackId', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('Validation failed')
  })

  it('returns 400 for invalid trackId (not a UUID)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const res = await POST(makeRequest({ trackId: 'not-a-uuid' }))
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('Validation failed')
  })

  it('returns 404 for non-existent track', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    // serviceFrom call 1: certification_tracks lookup returns nothing
    let serviceFromCounter = 0
    mockServiceFrom.mockImplementation(() => {
      serviceFromCounter++
      if (serviceFromCounter === 1) {
        return createChain(null, { message: 'Not found', code: 'PGRST116' })
      }
      return createChain(null)
    })

    const res = await POST(makeRequest({ trackId: TRACK_ID }))
    expect(res.status).toBe(404)

    const data = await res.json()
    expect(data.error).toBe('Certification track not found')
  })

  it('returns 403 when prerequisite not met', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    // serviceFrom calls:
    // 1: certification_tracks -> track with prereq
    // 2: certificates (prereq check) -> no cert found
    let serviceFromCounter = 0
    mockServiceFrom.mockImplementation(() => {
      serviceFromCounter++
      if (serviceFromCounter === 1) return createChain(mockTrackWithPrereq) // track
      if (serviceFromCounter === 2) return createChain(null, { message: 'Not found', code: 'PGRST116' }) // no prereq cert
      return createChain(null)
    })

    const res = await POST(makeRequest({ trackId: mockTrackWithPrereq.id }))
    expect(res.status).toBe(403)

    const data = await res.json()
    expect(data.error).toContain('Prerequisite certification not met')
  })

  it('returns 429 when attempt limit reached (3 in 30 days)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    // serviceFrom calls for track without prereq:
    // 1: certification_tracks -> track (no prereq)
    // 2: cert_attempts count (recent) -> count = 3
    // 3: cert_attempts (earliest attempt for expiry info)
    let serviceFromCounter = 0
    mockServiceFrom.mockImplementation(() => {
      serviceFromCounter++
      if (serviceFromCounter === 1) return createChain(mockTrack) // track
      if (serviceFromCounter === 2) return createCountChain(3) // 3 recent attempts
      if (serviceFromCounter === 3) return createChain({ started_at: '2026-03-01T00:00:00Z', expires_at: '2026-03-14T00:00:00Z' }) // earliest attempt
      return createChain(null)
    })

    const res = await POST(makeRequest({ trackId: TRACK_ID }))
    expect(res.status).toBe(429)

    const data = await res.json()
    expect(data.error).toContain('Maximum attempts (3) reached')
    expect(data.expiresAt).toBe('2026-03-14T00:00:00Z')
  })

  it('returns existing in-progress attempt if one exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const existingAttempt = {
      id: 'attempt-1',
      question_ids: ['q1', 'q2', 'q3'],
      started_at: '2026-03-13T10:00:00Z',
    }

    // serviceFrom calls:
    // 1: certification_tracks -> track (no prereq)
    // 2: cert_attempts count (recent) -> count = 1 (under limit)
    // 3: cert_attempts (existing in-progress) -> found
    // 4: cert_questions (fetch questions for existing attempt)
    let serviceFromCounter = 0
    mockServiceFrom.mockImplementation(() => {
      serviceFromCounter++
      if (serviceFromCounter === 1) return createChain(mockTrack)
      if (serviceFromCounter === 2) return createCountChain(1)
      if (serviceFromCounter === 3) return createChain(existingAttempt) // existing in-progress
      if (serviceFromCounter === 4) return createChain(mockQuestions.map(q => ({
        id: q.id, question_text: q.question_text, question_type: q.question_type, options: q.options, max_points: q.max_points,
      })))
      return createChain(null)
    })

    const res = await POST(makeRequest({ trackId: TRACK_ID }))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.attemptId).toBe('attempt-1')
    expect(data.questions).toHaveLength(3)
    expect(data.examDurationMinutes).toBe(60)
    expect(data.startsAt).toBe('2026-03-13T10:00:00Z')
  })

  it('creates new attempt with stratified questions on success (201)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const newAttempt = {
      id: 'new-attempt-1',
      started_at: '2026-03-13T12:00:00Z',
    }

    // serviceFrom calls:
    // 1: certification_tracks -> track (no prereq)
    // 2: cert_attempts count (recent) -> count = 0
    // 3: cert_attempts (existing in-progress) -> none (null via .single)
    // 4: cert_questions (all questions for track) -> question pool
    // 5: cert_attempts count (total for attempt_number) -> count = 0
    // 6: cert_attempts insert -> new attempt
    // 7: cert_questions (selected questions for response)
    let serviceFromCounter = 0
    mockServiceFrom.mockImplementation(() => {
      serviceFromCounter++
      if (serviceFromCounter === 1) return createChain(mockTrack) // track
      if (serviceFromCounter === 2) return createCountChain(0) // 0 recent attempts
      if (serviceFromCounter === 3) return createChain(null, { message: 'No rows', code: 'PGRST116' }) // no in-progress
      if (serviceFromCounter === 4) return createChain(mockQuestions) // question pool
      if (serviceFromCounter === 5) return createCountChain(0) // 0 total attempts
      if (serviceFromCounter === 6) return createChain(newAttempt) // inserted attempt
      if (serviceFromCounter === 7) return createChain(mockQuestions.map(q => ({
        id: q.id, question_text: q.question_text, question_type: q.question_type, options: q.options, max_points: q.max_points,
      })))
      return createChain(null)
    })

    const res = await POST(makeRequest({ trackId: TRACK_ID }))
    expect(res.status).toBe(201)

    const data = await res.json()
    expect(data.attemptId).toBe('new-attempt-1')
    expect(data.questions).toHaveLength(3)
    expect(data.examDurationMinutes).toBe(60)
    expect(data.startsAt).toBe('2026-03-13T12:00:00Z')
  })

  it('returns 404 when track has no questions in pool', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    // serviceFrom calls:
    // 1: certification_tracks -> track (no prereq)
    // 2: cert_attempts count (recent) -> count = 0
    // 3: cert_attempts (existing in-progress) -> none
    // 4: cert_questions (all questions) -> empty
    let serviceFromCounter = 0
    mockServiceFrom.mockImplementation(() => {
      serviceFromCounter++
      if (serviceFromCounter === 1) return createChain(mockTrack)
      if (serviceFromCounter === 2) return createCountChain(0)
      if (serviceFromCounter === 3) return createChain(null, { message: 'No rows', code: 'PGRST116' })
      if (serviceFromCounter === 4) return createChain([]) // empty question pool
      return createChain(null)
    })

    const res = await POST(makeRequest({ trackId: TRACK_ID }))
    expect(res.status).toBe(404)

    const data = await res.json()
    expect(data.error).toBe('This certification track has no questions available')
  })
})
