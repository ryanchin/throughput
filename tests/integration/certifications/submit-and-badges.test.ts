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

vi.mock('@/lib/openrouter/grader', () => ({
  gradeOpenEndedResponse: vi.fn().mockResolvedValue({
    score: 8,
    feedback: 'Good answer',
    strengths: ['Clear explanation'],
    improvements: ['Could add more detail'],
  }),
}))

vi.mock('@/lib/scoring/calculator', () => ({
  calculateQuizScore: vi.fn().mockImplementation(
    (responses: Array<{ points_earned: number }>, totalPoints: number, passingScore: number) => {
      const earned = responses.reduce((sum: number, r: { points_earned: number }) => sum + r.points_earned, 0)
      const score = totalPoints > 0 ? Math.round((earned / totalPoints) * 100) : 0
      return { score, passed: score >= passingScore, earnedPoints: earned }
    }
  ),
}))

vi.mock('@/lib/quiz/calculator', () => ({
  calculateTotalPoints: vi.fn().mockImplementation(
    (questions: Array<{ max_points: number }>) => questions.reduce((sum: number, q: { max_points: number }) => sum + q.max_points, 0)
  ),
}))

vi.mock('@/lib/certifications/cert-number', () => ({
  generateCertNumber: vi.fn().mockReturnValue('AAVA-2026-000001'),
}))

vi.mock('@/lib/certifications/verification', () => ({
  generateVerificationHash: vi.fn().mockReturnValue('abc123hash'),
}))

import { POST as SUBMIT } from '@/app/api/certifications/submit/route'
import { GET as GET_BADGE } from '@/app/api/badges/[certHash]/route'

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
    like: vi.fn().mockReturnThis(),
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
    like: vi.fn().mockReturnThis(),
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

const USER_ID = '11111111-1111-4111-a111-111111111111'
const OTHER_USER_ID = '22222222-2222-4222-a222-222222222222'
const TRACK_ID = '33333333-3333-4333-a333-333333333333'
const ATTEMPT_ID = '44444444-4444-4444-a444-444444444444'

const mockAttempt = {
  id: ATTEMPT_ID,
  user_id: USER_ID,
  track_id: TRACK_ID,
  attempt_number: 1,
  question_ids: ['aaaa1111-1111-4111-a111-111111111111', 'aaaa2222-2222-4222-a222-222222222222', 'aaaa3333-3333-4333-a333-333333333333'],
  submitted_at: null,
}

const mockTrack = {
  id: TRACK_ID,
  title: 'AAVA Foundations',
  passing_score: 80,
}

const mockQuestionsWithAnswers = [
  { id: 'aaaa1111-1111-4111-a111-111111111111', question_text: 'What is PM?', question_type: 'multiple_choice', options: [{ text: 'A', is_correct: true }, { text: 'B', is_correct: false }], correct_answer: 'A', rubric: null, max_points: 10 },
  { id: 'aaaa2222-2222-4222-a222-222222222222', question_text: 'Agile is iterative?', question_type: 'multiple_choice', options: [{ text: 'True', is_correct: true }, { text: 'False', is_correct: false }], correct_answer: 'True', rubric: null, max_points: 10 },
  { id: 'aaaa3333-3333-4333-a333-333333333333', question_text: 'Explain Scrum.', question_type: 'open_ended', options: null, correct_answer: null, rubric: 'Evaluate for accuracy.', max_points: 10 },
]

const correctAnswers = [
  { questionId: 'aaaa1111-1111-4111-a111-111111111111', answer: 'A' },
  { questionId: 'aaaa2222-2222-4222-a222-222222222222', answer: 'True' },
  { questionId: 'aaaa3333-3333-4333-a333-333333333333', answer: 'Scrum is an agile framework for managing work with iterative sprints.' },
]

const wrongAnswers = [
  { questionId: 'aaaa1111-1111-4111-a111-111111111111', answer: 'B' },
  { questionId: 'aaaa2222-2222-4222-a222-222222222222', answer: 'False' },
  { questionId: 'aaaa3333-3333-4333-a333-333333333333', answer: 'I do not know.' },
]

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// POST /api/certifications/submit
// ---------------------------------------------------------------------------

describe('POST /api/certifications/submit', () => {
  function makeSubmitRequest(body: unknown) {
    return new NextRequest('http://localhost/api/certifications/submit', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No session' } })

    const res = await SUBMIT(makeSubmitRequest({ attemptId: ATTEMPT_ID, answers: correctAnswers }))
    expect(res.status).toBe(401)

    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 400 for missing attemptId', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const res = await SUBMIT(makeSubmitRequest({ answers: correctAnswers }))
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('Validation failed')
  })

  it('returns 400 for empty answers array', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const res = await SUBMIT(makeSubmitRequest({ attemptId: ATTEMPT_ID, answers: [] }))
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('Validation failed')
  })

  it('returns 403 when attempt belongs to different user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: OTHER_USER_ID } }, error: null })

    // serviceFrom calls:
    // 1: cert_attempts (fetch attempt) -> belongs to USER_ID, not OTHER_USER_ID
    let serviceFromCounter = 0
    mockServiceFrom.mockImplementation(() => {
      serviceFromCounter++
      if (serviceFromCounter === 1) return createChain(mockAttempt) // attempt owned by USER_ID
      return createChain(null)
    })

    const res = await SUBMIT(makeSubmitRequest({ attemptId: ATTEMPT_ID, answers: correctAnswers }))
    expect(res.status).toBe(403)

    const data = await res.json()
    expect(data.error).toBe('You do not have permission to submit this attempt')
  })

  it('returns 400 when attempt already submitted', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const submittedAttempt = { ...mockAttempt, submitted_at: '2026-03-12T00:00:00Z' }

    // serviceFrom calls:
    // 1: cert_attempts (fetch attempt) -> already submitted
    let serviceFromCounter = 0
    mockServiceFrom.mockImplementation(() => {
      serviceFromCounter++
      if (serviceFromCounter === 1) return createChain(submittedAttempt)
      return createChain(null)
    })

    const res = await SUBMIT(makeSubmitRequest({ attemptId: ATTEMPT_ID, answers: correctAnswers }))
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('This exam attempt has already been submitted')
  })

  it('grades exam and returns passed=true with certificate on pass', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    // For passing: MC q1=correct(10), MC q2=correct(10), open-ended q3=8/10
    // Total: 28/30 = 93.3% >= 80% -> pass

    // serviceFrom calls:
    // 1: cert_attempts (fetch attempt) -> .single()
    // 2: certification_tracks (fetch track) -> .single()
    // 3: cert_questions (fetch with answers) -> thenable (array)
    // 4: cert_attempts update (score, passed, submitted_at) -> thenable
    // 5: certificates count (certs this year) -> thenable with count
    // 6: certificates insert -> thenable
    let serviceFromCounter = 0
    mockServiceFrom.mockImplementation(() => {
      serviceFromCounter++
      if (serviceFromCounter === 1) return createChain(mockAttempt)                // attempt
      if (serviceFromCounter === 2) return createChain(mockTrack)                  // track
      if (serviceFromCounter === 3) return createChain(mockQuestionsWithAnswers)   // questions
      if (serviceFromCounter === 4) return createChain(null)                       // update attempt
      if (serviceFromCounter === 5) return createCountChain(0)                     // 0 certs this year
      if (serviceFromCounter === 6) return createChain(null)                       // insert certificate
      return createChain(null)
    })

    const res = await SUBMIT(makeSubmitRequest({ attemptId: ATTEMPT_ID, answers: correctAnswers }))
    const data = await res.json()

    expect(data.passed).toBe(true)
    expect(data.score).toBeGreaterThanOrEqual(80)
    expect(data.certHash).toBe('abc123hash')
    expect(data.certNumber).toBe('AAVA-2026-000001')
    expect(data.attemptId).toBe(ATTEMPT_ID)
    expect(data.responses).toHaveLength(3)
  })

  it('returns passed=false with cooldown on fail', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    // Override grader to return low score for open-ended
    const { gradeOpenEndedResponse } = await import('@/lib/openrouter/grader')
    vi.mocked(gradeOpenEndedResponse).mockResolvedValueOnce({
      score: 0,
      feedback: 'Incorrect answer',
      strengths: [],
      improvements: ['Study more'],
    })

    // For failing: MC q1=wrong(0), MC q2=wrong(0), open-ended q3=0/10
    // Total: 0/30 = 0% < 80% -> fail

    // serviceFrom calls:
    // 1: cert_attempts (fetch attempt) -> .single()
    // 2: certification_tracks (fetch track) -> .single()
    // 3: cert_questions (fetch with answers) -> thenable
    // 4: cert_attempts update -> thenable
    let serviceFromCounter = 0
    mockServiceFrom.mockImplementation(() => {
      serviceFromCounter++
      if (serviceFromCounter === 1) return createChain(mockAttempt)                // attempt
      if (serviceFromCounter === 2) return createChain(mockTrack)                  // track
      if (serviceFromCounter === 3) return createChain(mockQuestionsWithAnswers)   // questions
      if (serviceFromCounter === 4) return createChain(null)                       // update attempt
      return createChain(null)
    })

    const res = await SUBMIT(makeSubmitRequest({ attemptId: ATTEMPT_ID, answers: wrongAnswers }))
    const data = await res.json()

    expect(data.passed).toBe(false)
    expect(data.score).toBeLessThan(80)
    expect(data.nextAttemptAvailable).toBeDefined()
    expect(data.attemptId).toBe(ATTEMPT_ID)
    expect(data.responses).toHaveLength(3)
    expect(data.certHash).toBeUndefined()
  })

  it('returns 404 when attempt not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    let serviceFromCounter = 0
    mockServiceFrom.mockImplementation(() => {
      serviceFromCounter++
      if (serviceFromCounter === 1) return createChain(null, { message: 'Not found', code: 'PGRST116' })
      return createChain(null)
    })

    const res = await SUBMIT(makeSubmitRequest({ attemptId: ATTEMPT_ID, answers: correctAnswers }))
    expect(res.status).toBe(404)

    const data = await res.json()
    expect(data.error).toBe('Exam attempt not found')
  })
})

// ---------------------------------------------------------------------------
// GET /api/badges/[certHash]
// ---------------------------------------------------------------------------

describe('GET /api/badges/[certHash]', () => {
  const mockCertificate = {
    id: 'cert-1',
    user_id: USER_ID,
    track_id: TRACK_ID,
    attempt_id: ATTEMPT_ID,
    cert_number: 'AAVA-2026-000001',
    verification_hash: 'abc123hash',
    issued_at: '2026-03-13T12:00:00Z',
    expires_at: null,
    revoked: false,
  }

  const mockProfile = {
    full_name: 'Test User',
    email: 'test@example.com',
  }

  const mockCertTrack = {
    title: 'AAVA Foundations',
    slug: 'aava-foundations',
    tier: 1,
    domain: null,
    description: 'Foundation-level certification',
    passing_score: 80,
  }

  function makeBadgeRequest(certHash: string) {
    return new NextRequest(`http://localhost/api/badges/${certHash}`)
  }

  it('returns valid JSON-LD with correct Content-Type header', async () => {
    // Badges route uses the regular client (mockFrom), not serviceFrom
    // mockFrom calls:
    // 1: certificates -> .single()
    // 2: profiles -> .single()
    // 3: certification_tracks -> .single()
    let fromCounter = 0
    mockFrom.mockImplementation(() => {
      fromCounter++
      if (fromCounter === 1) return createChain(mockCertificate) // certificate
      if (fromCounter === 2) return createChain(mockProfile) // profile
      if (fromCounter === 3) return createChain(mockCertTrack) // track
      return createChain(null)
    })

    const res = await GET_BADGE(makeBadgeRequest('abc123hash'), {
      params: Promise.resolve({ certHash: 'abc123hash' }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/ld+json')
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600')

    const data = await res.json()
    expect(data['@context']).toEqual([
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
    ])
    expect(data.type).toEqual(['VerifiableCredential', 'OpenBadgeCredential'])
    expect(data.issuer.name).toBe('AAVA Product Studio')
    expect(data.issuanceDate).toBe('2026-03-13T12:00:00Z')
    expect(data.credentialSubject.id).toBe('mailto:test@example.com')
    expect(data.credentialSubject.achievement.name).toBe('AAVA Foundations')
    expect(data.credentialSubject.achievement.criteria.narrative).toContain('80%')
    expect(data.credentialSubject.achievement.image.id).toContain('foundations.png')
  })

  it('returns 404 for non-existent hash', async () => {
    // mockFrom call 1: certificates -> not found
    let fromCounter = 0
    mockFrom.mockImplementation(() => {
      fromCounter++
      if (fromCounter === 1) return createChain(null, { message: 'Not found', code: 'PGRST116' })
      return createChain(null)
    })

    const res = await GET_BADGE(makeBadgeRequest('nonexistent'), {
      params: Promise.resolve({ certHash: 'nonexistent' }),
    })
    expect(res.status).toBe(404)

    const data = await res.json()
    expect(data.error).toBe('Certificate not found')
  })

  it('returns 404 for revoked certificate', async () => {
    // The query filters by revoked=false, so a revoked cert won't be found
    // mockFrom call 1: certificates -> not found (because revoked=true is filtered out)
    let fromCounter = 0
    mockFrom.mockImplementation(() => {
      fromCounter++
      if (fromCounter === 1) return createChain(null, { message: 'Not found', code: 'PGRST116' })
      return createChain(null)
    })

    const res = await GET_BADGE(makeBadgeRequest('revokedhash'), {
      params: Promise.resolve({ certHash: 'revokedhash' }),
    })
    expect(res.status).toBe(404)

    const data = await res.json()
    expect(data.error).toBe('Certificate not found')
  })

  it('returns correct badge image path for domain certifications', async () => {
    const domainTrack = {
      ...mockCertTrack,
      title: 'AAVA Sprint Planning Expert',
      slug: 'sprint-planning-expert',
      tier: 2,
      domain: 'sprint_planning',
    }

    let fromCounter = 0
    mockFrom.mockImplementation(() => {
      fromCounter++
      if (fromCounter === 1) return createChain(mockCertificate)
      if (fromCounter === 2) return createChain(mockProfile)
      if (fromCounter === 3) return createChain(domainTrack)
      return createChain(null)
    })

    const res = await GET_BADGE(makeBadgeRequest('abc123hash'), {
      params: Promise.resolve({ certHash: 'abc123hash' }),
    })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.credentialSubject.achievement.image.id).toContain('sprint_planning.png')
  })
})
