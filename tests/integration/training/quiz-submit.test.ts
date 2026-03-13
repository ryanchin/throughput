import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the route
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn()
const mockAuthFrom = vi.fn()
const mockServiceFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockAuthFrom,
    })
  ),
  createServiceClient: vi.fn(() => ({
    from: mockServiceFrom,
  })),
}))

vi.mock('@/lib/openrouter/grader', () => ({
  gradeOpenEndedResponse: vi.fn(),
}))

// Must import after mocks are declared
import { POST } from '@/app/api/quiz/submit/route'
import { gradeOpenEndedResponse } from '@/lib/openrouter/grader'

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
    single: vi
      .fn()
      .mockResolvedValue({ data: terminalData, error: terminalError }),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: terminalData, error: terminalError }),
    then: undefined as unknown,
  }
  chain.then = (resolve: (v: unknown) => unknown) =>
    resolve({
      data: Array.isArray(terminalData)
        ? terminalData
        : terminalData
          ? [terminalData]
          : [],
      error: terminalError,
      count: Array.isArray(terminalData) ? terminalData.length : terminalData ? 1 : 0,
    })
  return chain
}

const USER_ID = 'a1111111-1111-4111-a111-111111111111'
const QUIZ_ID = 'b2222222-2222-4222-a222-222222222222'
const LESSON_ID = 'c3333333-3333-4333-a333-333333333333'
const COURSE_ID = 'd4444444-4444-4444-a444-444444444444'
const ENROLLMENT_ID = 'e5555555-5555-4555-a555-555555555555'
const ATTEMPT_ID = 'f6666666-6666-4666-a666-666666666666'
const QUESTION_MC_ID = 'a7777777-7777-4777-a777-777777777777'
const QUESTION_TF_ID = 'a8888888-8888-4888-a888-888888888888'
const QUESTION_OE_ID = 'a9999999-9999-4999-a999-999999999999'

function mockUnauthenticated() {
  mockGetUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  })
}

function mockAuthenticated(userId = USER_ID) {
  mockGetUser.mockResolvedValue({
    data: { user: { id: userId, email: 'test@example.com' } },
    error: null,
  })
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/quiz/submit', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// Reusable mock data
const mockQuiz = {
  id: QUIZ_ID,
  lesson_id: LESSON_ID,
  title: 'Test Quiz',
  passing_score: 70,
  max_attempts: null,
}

const mockQuizWithMaxAttempts = {
  id: QUIZ_ID,
  lesson_id: LESSON_ID,
  title: 'Test Quiz',
  passing_score: 70,
  max_attempts: 3,
}

const mockLesson = {
  id: LESSON_ID,
  course_id: COURSE_ID,
}

const mockEnrollment = { id: ENROLLMENT_ID }

const mockMCQuestion = {
  id: QUESTION_MC_ID,
  quiz_id: QUIZ_ID,
  question_text: 'What color is the sky?',
  question_type: 'multiple_choice',
  options: [
    { text: 'Blue', is_correct: true },
    { text: 'Green', is_correct: false },
  ],
  correct_answer: 'Blue',
  rubric: null,
  max_points: 10,
  order_index: 0,
}

const mockTFQuestion = {
  id: QUESTION_TF_ID,
  quiz_id: QUIZ_ID,
  question_text: 'The earth is flat.',
  question_type: 'true_false',
  options: null,
  correct_answer: 'false',
  rubric: null,
  max_points: 10,
  order_index: 1,
}

const mockOEQuestion = {
  id: QUESTION_OE_ID,
  quiz_id: QUIZ_ID,
  question_text: 'Explain agile methodology.',
  question_type: 'open_ended',
  options: null,
  correct_answer: null,
  rubric: 'Evaluate for accuracy, completeness, and clarity.',
  max_points: 10,
  order_index: 2,
}

/**
 * Set up the auth client mock (mockAuthFrom) to return the given data
 * for each table in sequence. The quiz submit route calls:
 *   authFrom('quizzes') -> authFrom('questions') -> authFrom('lessons') -> authFrom('course_enrollments')
 */
function setupAuthFrom(config: {
  quiz?: unknown
  quizError?: unknown
  questions?: unknown
  questionsError?: unknown
  lesson?: unknown
  lessonError?: unknown
  enrollment?: unknown
  enrollmentError?: unknown
}) {
  mockAuthFrom.mockImplementation((table: string) => {
    switch (table) {
      case 'quizzes':
        return createChain(config.quiz ?? null, config.quizError ?? null)
      case 'questions':
        return createChain(config.questions ?? null, config.questionsError ?? null)
      case 'lessons':
        return createChain(config.lesson ?? null, config.lessonError ?? null)
      case 'course_enrollments':
        return createChain(config.enrollment ?? null, config.enrollmentError ?? null)
      default:
        return createChain()
    }
  })
}

/**
 * Set up the service client mock (mockServiceFrom) to return the given data
 * for each table. The quiz submit route calls:
 *   serviceFrom('quiz_attempts') -> select count (head:true)
 *   serviceFrom('quiz_attempts') -> insert
 *   serviceFrom('question_responses') -> insert (per question)
 *   serviceFrom('quiz_attempts') -> update (final score)
 */
function setupServiceFrom(config: {
  existingAttemptCount?: number
  attemptInsert?: unknown
  attemptInsertError?: unknown
  responseInsertError?: unknown
  attemptUpdateError?: unknown
}) {
  const attemptCallCount = { current: 0 }

  mockServiceFrom.mockImplementation((table: string) => {
    switch (table) {
      case 'quiz_attempts': {
        attemptCallCount.current++
        if (attemptCallCount.current === 1) {
          // First call: count existing attempts (select with head:true)
          // This resolves as a thenable with count
          const countChain = createChain(null, null)
          countChain.then = (resolve: (v: unknown) => unknown) =>
            resolve({ data: null, error: null, count: config.existingAttemptCount ?? 0 })
          return countChain
        } else if (attemptCallCount.current === 2) {
          // Second call: insert new attempt
          return createChain(
            config.attemptInsert ?? { id: ATTEMPT_ID },
            config.attemptInsertError ?? null
          )
        } else {
          // Third call: update attempt with final score
          return createChain(null, config.attemptUpdateError ?? null)
        }
      }
      case 'question_responses':
        return createChain(null, config.responseInsertError ?? null)
      default:
        return createChain()
    }
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/quiz/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // 1. Returns 401 for unauthenticated user
  // -------------------------------------------------------------------------
  it('returns 401 for unauthenticated user', async () => {
    mockUnauthenticated()

    const res = await POST(
      makeRequest({
        quizId: QUIZ_ID,
        answers: [{ questionId: QUESTION_MC_ID, answer: 'Blue' }],
      })
    )

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  // -------------------------------------------------------------------------
  // 2. Returns 400 for invalid body
  // -------------------------------------------------------------------------
  it('returns 400 for missing quizId', async () => {
    mockAuthenticated()

    const res = await POST(
      makeRequest({
        answers: [{ questionId: QUESTION_MC_ID, answer: 'Blue' }],
      })
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
    expect(body.details).toBeDefined()
  })

  it('returns 400 for empty answers array', async () => {
    mockAuthenticated()

    const res = await POST(makeRequest({ quizId: QUIZ_ID, answers: [] }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
  })

  it('returns 400 for non-UUID quizId', async () => {
    mockAuthenticated()

    const res = await POST(
      makeRequest({
        quizId: 'not-a-uuid',
        answers: [{ questionId: QUESTION_MC_ID, answer: 'Blue' }],
      })
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
  })

  // -------------------------------------------------------------------------
  // 3. Returns 404 when quiz not found
  // -------------------------------------------------------------------------
  it('returns 404 when quiz not found', async () => {
    mockAuthenticated()
    setupAuthFrom({
      quiz: null,
      quizError: { code: 'PGRST116', message: 'No rows' },
    })

    const res = await POST(
      makeRequest({
        quizId: QUIZ_ID,
        answers: [{ questionId: QUESTION_MC_ID, answer: 'Blue' }],
      })
    )

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Quiz not found')
  })

  // -------------------------------------------------------------------------
  // 4. Returns 403 when user not enrolled
  // -------------------------------------------------------------------------
  it('returns 403 when user not enrolled in the course', async () => {
    mockAuthenticated()
    setupAuthFrom({
      quiz: mockQuiz,
      questions: [mockMCQuestion],
      lesson: mockLesson,
      enrollment: null,
      enrollmentError: { code: 'PGRST116', message: 'No rows' },
    })

    const res = await POST(
      makeRequest({
        quizId: QUIZ_ID,
        answers: [{ questionId: QUESTION_MC_ID, answer: 'Blue' }],
      })
    )

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('You must be enrolled in this course to submit a quiz')
  })

  // -------------------------------------------------------------------------
  // 5. Returns 200 with scored results for MC/TF quiz
  // -------------------------------------------------------------------------
  it('returns 200 with scored results for MC/TF quiz', async () => {
    mockAuthenticated()
    setupAuthFrom({
      quiz: mockQuiz,
      questions: [mockMCQuestion, mockTFQuestion],
      lesson: mockLesson,
      enrollment: mockEnrollment,
    })
    setupServiceFrom({
      existingAttemptCount: 0,
    })

    const res = await POST(
      makeRequest({
        quizId: QUIZ_ID,
        answers: [
          { questionId: QUESTION_MC_ID, answer: 'Blue' },     // correct
          { questionId: QUESTION_TF_ID, answer: 'true' },     // wrong (correct is 'false')
        ],
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()

    // Verify attempt structure
    expect(body.attempt).toBeDefined()
    expect(body.attempt.id).toBe(ATTEMPT_ID)
    expect(body.attempt.attemptNumber).toBe(1)

    // Verify responses
    expect(body.responses).toHaveLength(2)

    const mcResponse = body.responses.find(
      (r: { questionId: string }) => r.questionId === QUESTION_MC_ID
    )
    expect(mcResponse.isCorrect).toBe(true)
    expect(mcResponse.pointsEarned).toBe(10)
    expect(mcResponse.correctAnswer).toBe('Blue')

    const tfResponse = body.responses.find(
      (r: { questionId: string }) => r.questionId === QUESTION_TF_ID
    )
    expect(tfResponse.isCorrect).toBe(false)
    expect(tfResponse.pointsEarned).toBe(0)
    expect(tfResponse.correctAnswer).toBe('false')

    // Score: 10/20 = 50%
    expect(body.attempt.score).toBe(50)
    expect(body.passingScore).toBe(70)
    expect(body.quizTitle).toBe('Test Quiz')
  })

  // -------------------------------------------------------------------------
  // 6. Grades open-ended questions via LLM
  // -------------------------------------------------------------------------
  it('grades open-ended questions via LLM', async () => {
    mockAuthenticated()
    setupAuthFrom({
      quiz: mockQuiz,
      questions: [mockOEQuestion],
      lesson: mockLesson,
      enrollment: mockEnrollment,
    })
    setupServiceFrom({
      existingAttemptCount: 0,
    })

    const mockGradeResult = {
      score: 8,
      feedback: 'Good explanation of agile.',
      strengths: ['Clear understanding'],
      improvements: ['More detail on ceremonies'],
    }
    vi.mocked(gradeOpenEndedResponse).mockResolvedValue(mockGradeResult)

    const res = await POST(
      makeRequest({
        quizId: QUIZ_ID,
        answers: [{ questionId: QUESTION_OE_ID, answer: 'Agile is an iterative approach...' }],
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()

    const oeResponse = body.responses.find(
      (r: { questionId: string }) => r.questionId === QUESTION_OE_ID
    )
    expect(oeResponse.llmFeedback).toBeDefined()
    expect(oeResponse.llmFeedback.score).toBe(8)
    expect(oeResponse.llmFeedback.feedback).toBe('Good explanation of agile.')
    expect(oeResponse.llmFeedback.strengths).toEqual(['Clear understanding'])
    expect(oeResponse.llmFeedback.improvements).toEqual(['More detail on ceremonies'])
    expect(oeResponse.pointsEarned).toBe(8)
    // 8/10 = 80% >= 70% threshold for open_ended isCorrect
    expect(oeResponse.isCorrect).toBe(true)
    // correctAnswer is null for open-ended
    expect(oeResponse.correctAnswer).toBeNull()

    // Verify grader was called with correct args
    expect(gradeOpenEndedResponse).toHaveBeenCalledWith(
      'Explain agile methodology.',
      'Evaluate for accuracy, completeness, and clarity.',
      'Agile is an iterative approach...',
      10
    )
  })

  // -------------------------------------------------------------------------
  // 7. Handles LLM grading failure gracefully
  // -------------------------------------------------------------------------
  it('handles LLM grading failure gracefully', async () => {
    mockAuthenticated()
    setupAuthFrom({
      quiz: mockQuiz,
      questions: [mockOEQuestion],
      lesson: mockLesson,
      enrollment: mockEnrollment,
    })
    setupServiceFrom({
      existingAttemptCount: 0,
    })

    vi.mocked(gradeOpenEndedResponse).mockRejectedValue(new Error('OpenRouter API down'))

    const res = await POST(
      makeRequest({
        quizId: QUIZ_ID,
        answers: [{ questionId: QUESTION_OE_ID, answer: 'My answer here.' }],
      })
    )

    // Should still succeed — not crash
    expect(res.status).toBe(200)
    const body = await res.json()

    const oeResponse = body.responses.find(
      (r: { questionId: string }) => r.questionId === QUESTION_OE_ID
    )
    expect(oeResponse.pointsEarned).toBe(0)
    expect(oeResponse.isCorrect).toBe(false)
    expect(oeResponse.llmFeedback).toBeDefined()
    expect(oeResponse.llmFeedback.score).toBe(0)
    expect(oeResponse.llmFeedback.feedback).toContain('system error')
    expect(oeResponse.llmFeedback.strengths).toEqual([])
    expect(oeResponse.llmFeedback.improvements).toEqual([])
  })

  // -------------------------------------------------------------------------
  // 8. Creates quiz_attempt with correct attempt_number
  // -------------------------------------------------------------------------
  it('creates quiz_attempt with correct attempt_number when prior attempts exist', async () => {
    mockAuthenticated()
    setupAuthFrom({
      quiz: mockQuiz,
      questions: [mockMCQuestion],
      lesson: mockLesson,
      enrollment: mockEnrollment,
    })
    setupServiceFrom({
      existingAttemptCount: 2,
    })

    const res = await POST(
      makeRequest({
        quizId: QUIZ_ID,
        answers: [{ questionId: QUESTION_MC_ID, answer: 'Blue' }],
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.attempt.attemptNumber).toBe(3)
  })

  // -------------------------------------------------------------------------
  // 9. Marks quiz as passed when score >= passing_score
  // -------------------------------------------------------------------------
  it('marks quiz as passed when score >= passing_score', async () => {
    mockAuthenticated()
    setupAuthFrom({
      quiz: mockQuiz, // passing_score: 70
      questions: [mockMCQuestion, mockTFQuestion],
      lesson: mockLesson,
      enrollment: mockEnrollment,
    })
    setupServiceFrom({
      existingAttemptCount: 0,
    })

    // Both correct: 20/20 = 100% >= 70%
    const res = await POST(
      makeRequest({
        quizId: QUIZ_ID,
        answers: [
          { questionId: QUESTION_MC_ID, answer: 'Blue' },
          { questionId: QUESTION_TF_ID, answer: 'false' },
        ],
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.attempt.score).toBe(100)
    expect(body.attempt.passed).toBe(true)
  })

  // -------------------------------------------------------------------------
  // 10. Marks quiz as failed when score < passing_score
  // -------------------------------------------------------------------------
  it('marks quiz as failed when score < passing_score', async () => {
    mockAuthenticated()
    setupAuthFrom({
      quiz: mockQuiz, // passing_score: 70
      questions: [mockMCQuestion, mockTFQuestion],
      lesson: mockLesson,
      enrollment: mockEnrollment,
    })
    setupServiceFrom({
      existingAttemptCount: 0,
    })

    // Both wrong: 0/20 = 0% < 70%
    const res = await POST(
      makeRequest({
        quizId: QUIZ_ID,
        answers: [
          { questionId: QUESTION_MC_ID, answer: 'Green' },
          { questionId: QUESTION_TF_ID, answer: 'true' },
        ],
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.attempt.score).toBe(0)
    expect(body.attempt.passed).toBe(false)
  })

  // -------------------------------------------------------------------------
  // 11. Returns 429 when max attempts exceeded
  // -------------------------------------------------------------------------
  it('returns 429 when max attempts exceeded', async () => {
    mockAuthenticated()
    setupAuthFrom({
      quiz: mockQuizWithMaxAttempts, // max_attempts: 3
      questions: [mockMCQuestion],
      lesson: mockLesson,
      enrollment: mockEnrollment,
    })
    setupServiceFrom({
      existingAttemptCount: 3, // Already used all 3 attempts
    })

    const res = await POST(
      makeRequest({
        quizId: QUIZ_ID,
        answers: [{ questionId: QUESTION_MC_ID, answer: 'Blue' }],
      })
    )

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toBe('Maximum attempts (3) reached for this quiz')
  })

  // -------------------------------------------------------------------------
  // 12. Allows submission when max_attempts is null (unlimited)
  // -------------------------------------------------------------------------
  it('allows submission when max_attempts is null (unlimited)', async () => {
    mockAuthenticated()
    setupAuthFrom({
      quiz: mockQuiz, // max_attempts: null
      questions: [mockMCQuestion],
      lesson: mockLesson,
      enrollment: mockEnrollment,
    })
    setupServiceFrom({
      existingAttemptCount: 100, // Many attempts, but no limit
    })

    const res = await POST(
      makeRequest({
        quizId: QUIZ_ID,
        answers: [{ questionId: QUESTION_MC_ID, answer: 'Blue' }],
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.attempt.attemptNumber).toBe(101)
  })

  // -------------------------------------------------------------------------
  // 13. Allows submission when under max attempts limit
  // -------------------------------------------------------------------------
  it('allows submission when under max attempts limit', async () => {
    mockAuthenticated()
    setupAuthFrom({
      quiz: mockQuizWithMaxAttempts, // max_attempts: 3
      questions: [mockMCQuestion],
      lesson: mockLesson,
      enrollment: mockEnrollment,
    })
    setupServiceFrom({
      existingAttemptCount: 2, // 2 of 3 used, one more allowed
    })

    const res = await POST(
      makeRequest({
        quizId: QUIZ_ID,
        answers: [{ questionId: QUESTION_MC_ID, answer: 'Blue' }],
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.attempt.attemptNumber).toBe(3)
  })
})
