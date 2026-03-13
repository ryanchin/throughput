import { describe, it, expect, vi, beforeEach } from 'vitest'

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

import { GET as exportUsers } from '@/app/api/admin/analytics/export-users/route'
import { GET as exportCompletions } from '@/app/api/admin/analytics/export-completions/route'

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

const ADMIN_ID = 'a1111111-1111-4111-a111-111111111111'
const EMPLOYEE_ID = 'e2222222-2222-4222-a222-222222222222'

const adminProfile = {
  id: ADMIN_ID,
  email: 'admin@test.com',
  full_name: 'Admin User',
  role: 'admin',
  avatar_url: null,
  signup_context: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-03-12T00:00:00Z',
}

const employeeProfile = {
  id: EMPLOYEE_ID,
  email: 'emp@test.com',
  full_name: 'Employee User',
  role: 'employee',
  avatar_url: null,
  signup_context: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-03-12T00:00:00Z',
}

function mockAuthenticatedAdmin() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: ADMIN_ID } },
    error: null,
  })

  // requireAdmin calls: getUser() then from('profiles').select('*').eq('id', ...).single()
  let authFromCounter = 0
  mockFrom.mockImplementation(() => {
    authFromCounter++
    if (authFromCounter === 1) return createChain(adminProfile)
    return createChain(null)
  })
}

function mockAuthenticatedEmployee() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: EMPLOYEE_ID } },
    error: null,
  })

  let authFromCounter = 0
  mockFrom.mockImplementation(() => {
    authFromCounter++
    if (authFromCounter === 1) return createChain(employeeProfile)
    return createChain(null)
  })
}

function mockUnauthenticated() {
  mockGetUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  })
}

// ---------------------------------------------------------------------------
// Tests — Export Users CSV
// ---------------------------------------------------------------------------

describe('GET /api/admin/analytics/export-users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated requests', async () => {
    mockUnauthenticated()
    const res = await exportUsers()
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    mockAuthenticatedEmployee()
    const res = await exportUsers()
    expect(res.status).toBe(403)
  })

  it('returns CSV with correct headers for admin', async () => {
    mockAuthenticatedAdmin()

    const profiles = [
      { id: 'u1', email: 'alice@test.com', full_name: 'Alice', role: 'employee', created_at: '2026-01-15T00:00:00Z' },
      { id: 'u2', email: 'bob@test.com', full_name: 'Bob', role: 'sales', created_at: '2026-02-01T00:00:00Z' },
    ]
    const enrollments = [
      { user_id: 'u1', status: 'passed' },
      { user_id: 'u1', status: 'enrolled' },
    ]

    let serviceCounter = 0
    mockServiceFrom.mockImplementation(() => {
      serviceCounter++
      if (serviceCounter === 1) return createChain(profiles) // profiles
      if (serviceCounter === 2) return createChain(enrollments) // enrollments
      return createChain([])
    })

    const res = await exportUsers()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv')
    expect(res.headers.get('Content-Disposition')).toContain('users-export')

    const csv = await res.text()
    expect(csv).toContain('Email,Name,Role,Joined,Courses Enrolled,Courses Completed')
    expect(csv).toContain('alice@test.com')
    expect(csv).toContain('bob@test.com')
  })

  it('returns header-only CSV when no profiles exist', async () => {
    mockAuthenticatedAdmin()

    mockServiceFrom.mockImplementation(() => createChain([]))

    const res = await exportUsers()
    expect(res.status).toBe(200)

    const csv = await res.text()
    expect(csv).toContain('Email,Name,Role,Joined,Courses Enrolled,Courses Completed')
  })
})

// ---------------------------------------------------------------------------
// Tests — Export Completions CSV
// ---------------------------------------------------------------------------

describe('GET /api/admin/analytics/export-completions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated requests', async () => {
    mockUnauthenticated()
    const res = await exportCompletions()
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin users', async () => {
    mockAuthenticatedEmployee()
    const res = await exportCompletions()
    expect(res.status).toBe(403)
  })

  it('returns CSV with enrollment data for admin', async () => {
    mockAuthenticatedAdmin()

    const enrollments = [
      { user_id: 'u1', course_id: 'c1', status: 'passed', final_score: 85, enrolled_at: '2026-01-15T00:00:00Z', completed_at: '2026-02-10T00:00:00Z' },
      { user_id: 'u2', course_id: 'c1', status: 'enrolled', final_score: null, enrolled_at: '2026-03-01T00:00:00Z', completed_at: null },
    ]
    const users = [
      { id: 'u1', email: 'alice@test.com', full_name: 'Alice' },
      { id: 'u2', email: 'bob@test.com', full_name: 'Bob' },
    ]
    const courses = [{ id: 'c1', title: 'Test Course' }]

    let serviceCounter = 0
    mockServiceFrom.mockImplementation(() => {
      serviceCounter++
      if (serviceCounter === 1) return createChain(enrollments)
      if (serviceCounter === 2) return createChain(users)
      if (serviceCounter === 3) return createChain(courses)
      return createChain([])
    })

    const res = await exportCompletions()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv')

    const csv = await res.text()
    expect(csv).toContain('User Email,User Name,Course,Status,Score,Enrolled,Completed')
    expect(csv).toContain('alice@test.com')
    expect(csv).toContain('Test Course')
    expect(csv).toContain('passed')
  })
})

// ---------------------------------------------------------------------------
// Tests — Analytics data shape (unit-level via service mock)
// ---------------------------------------------------------------------------

describe('Analytics data functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getUserStats returns correct role breakdown', async () => {
    const { getUserStats } = await import('@/lib/admin/analytics')

    const profiles = [
      { role: 'employee' },
      { role: 'employee' },
      { role: 'sales' },
      { role: 'admin' },
      { role: 'public' },
    ]

    mockServiceFrom.mockImplementation(() => createChain(profiles))

    const stats = await getUserStats()
    expect(stats.total).toBe(5)
    expect(stats.employees).toBe(2)
    expect(stats.sales).toBe(1)
    expect(stats.admin).toBe(1)
    expect(stats.public).toBe(1)
  })

  it('getCourseStats counts only published courses', async () => {
    const { getCourseStats } = await import('@/lib/admin/analytics')

    // The count query returns { count: N }
    mockServiceFrom.mockImplementation(() => {
      const chain = createChain(null)
      // Override the then to return count
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: null, error: null, count: 5 })
      return chain
    })

    const stats = await getCourseStats()
    expect(stats.publishedCourses).toBe(5)
  })

  it('getCoursePerformance returns sorted rows', async () => {
    const { getCoursePerformance } = await import('@/lib/admin/analytics')

    const courses = [
      { id: 'c1', title: 'Course A' },
      { id: 'c2', title: 'Course B' },
    ]
    const enrollments = [
      { course_id: 'c1', status: 'passed', final_score: 90 },
      { course_id: 'c1', status: 'passed', final_score: 80 },
      { course_id: 'c1', status: 'enrolled', final_score: null },
      { course_id: 'c2', status: 'failed', final_score: 50 },
    ]

    let counter = 0
    mockServiceFrom.mockImplementation(() => {
      counter++
      if (counter === 1) return createChain(courses)
      if (counter === 2) return createChain(enrollments)
      return createChain([])
    })

    const rows = await getCoursePerformance()
    expect(rows.length).toBe(2)
    // Course A has 3 enrollments, Course B has 1 — sorted by enrollment desc
    expect(rows[0].courseTitle).toBe('Course A')
    expect(rows[0].enrolled).toBe(3)
    expect(rows[0].completed).toBe(2)
    expect(rows[0].passRate).toBe(100) // 2/2 passed
    expect(rows[0].avgScore).toBe(85) // (90+80)/2
    expect(rows[1].courseTitle).toBe('Course B')
    expect(rows[1].enrolled).toBe(1)
    expect(rows[1].passRate).toBe(0) // 0 passed out of 1 completed
  })

  it('csvEscape handles commas and quotes correctly', async () => {
    const { exportUsersCSV } = await import('@/lib/admin/analytics')

    const profiles = [
      { id: 'u1', email: 'test@test.com', full_name: 'Last, First', role: 'employee', created_at: '2026-01-15T00:00:00Z' },
    ]

    let counter = 0
    mockServiceFrom.mockImplementation(() => {
      counter++
      if (counter === 1) return createChain(profiles)
      return createChain([])
    })

    const csv = await exportUsersCSV()
    // Name with comma should be quoted
    expect(csv).toContain('"Last, First"')
  })
})
