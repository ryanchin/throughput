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

// Route imports (must come after mocks)
import { GET as getKnowledgeNav } from '@/app/api/knowledge/nav/route'
import { GET as getKnowledgePage } from '@/app/api/knowledge/[...slug]/route'
import { GET as getAdminKnowledge, POST as createAdminKnowledge } from '@/app/api/admin/knowledge/route'
import { PATCH as patchAdminKnowledgePage, DELETE as deleteAdminKnowledgePage } from '@/app/api/admin/knowledge/[pageId]/route'
import { GET as getSearch } from '@/app/api/search/route'
import { GET as getGroups, POST as addToGroup, DELETE as removeFromGroup } from '@/app/api/admin/users/groups/route'

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
    ilike: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
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
const SALES_USER_ID = 's3333333-3333-4333-a333-333333333333'

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

const salesProfile = {
  id: SALES_USER_ID,
  email: 'sales@test.com',
  full_name: 'Sales User',
  role: 'sales',
  avatar_url: null,
  signup_context: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-03-12T00:00:00Z',
}

function mockUnauthenticated() {
  mockGetUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  })
}

/**
 * Mock an authenticated admin for routes that use requireAdmin().
 * requireAdmin: getUser() -> from('profiles') [call 1]
 * Subsequent from() calls are for the route's own queries.
 */
function mockAuthenticatedAdmin() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: ADMIN_ID } },
    error: null,
  })

  let fromCounter = 0
  mockFrom.mockImplementation(() => {
    fromCounter++
    if (fromCounter === 1) return createChain(adminProfile) // profiles lookup
    return createChain(null)
  })
}

/**
 * Mock an authenticated employee for routes that use getProfile().
 * getProfile: getUser() -> from('profiles') [call 1]
 */
function mockAuthenticatedEmployee() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: EMPLOYEE_ID } },
    error: null,
  })

  let fromCounter = 0
  mockFrom.mockImplementation(() => {
    fromCounter++
    if (fromCounter === 1) return createChain(employeeProfile) // profiles lookup
    return createChain(null)
  })
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleNavPages = [
  {
    id: 'p1',
    title: 'Getting Started',
    slug: 'getting-started',
    parent_id: null,
    order_index: 0,
    visibility: 'internal',
  },
  {
    id: 'p2',
    title: 'Sales Playbook',
    slug: 'sales-playbook',
    parent_id: null,
    order_index: 1,
    visibility: 'group:sales',
  },
  {
    id: 'p3',
    title: 'Public FAQ',
    slug: 'public-faq',
    parent_id: null,
    order_index: 2,
    visibility: 'public',
  },
]

const samplePage = {
  id: 'p1',
  title: 'Getting Started',
  slug: 'getting-started',
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
  parent_id: null,
  visibility: 'internal',
  updated_at: '2026-03-10T00:00:00Z',
  created_by: ADMIN_ID,
}

const salesPage = {
  id: 'p2',
  title: 'Sales Playbook',
  slug: 'sales-playbook',
  content: { type: 'doc', content: [] },
  parent_id: null,
  visibility: 'group:sales',
  updated_at: '2026-03-10T00:00:00Z',
  created_by: ADMIN_ID,
}

// ---------------------------------------------------------------------------
// Helper to create a NextRequest-like object for routes that need params
// ---------------------------------------------------------------------------

function makeRequest(url: string, options?: RequestInit): Request {
  return new Request(url, options)
}

// ---------------------------------------------------------------------------
// Tests: GET /api/knowledge/nav
// ---------------------------------------------------------------------------

describe('GET /api/knowledge/nav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated user', async () => {
    mockUnauthenticated()
    const res = await getKnowledgeNav()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns filtered nav tree for employee user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: EMPLOYEE_ID } },
      error: null,
    })

    // Call sequence for this route:
    // 1. getProfile() -> from('profiles') - returns employee profile
    // 2. fetchNavPages() -> from('docs_pages') - returns all published pages
    // 3. fetchUserGroups() -> from('user_groups') - returns user's groups
    let fromCounter = 0
    mockFrom.mockImplementation(() => {
      fromCounter++
      if (fromCounter === 1) return createChain(employeeProfile)     // profiles
      if (fromCounter === 2) return createChain(sampleNavPages)      // docs_pages
      if (fromCounter === 3) return createChain([])                  // user_groups (no groups)
      return createChain(null)
    })

    const res = await getKnowledgeNav()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.tree).toBeDefined()
    expect(Array.isArray(body.tree)).toBe(true)

    // Employee without 'sales' group should see internal + public pages only
    const titles = body.tree.map((n: { title: string }) => n.title)
    expect(titles).toContain('Getting Started')
    expect(titles).toContain('Public FAQ')
    expect(titles).not.toContain('Sales Playbook')
  })

  it('filters out group:sales pages for non-sales employee', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: EMPLOYEE_ID } },
      error: null,
    })

    let fromCounter = 0
    mockFrom.mockImplementation(() => {
      fromCounter++
      if (fromCounter === 1) return createChain(employeeProfile)     // profiles
      if (fromCounter === 2) return createChain(sampleNavPages)      // docs_pages
      if (fromCounter === 3) return createChain([])                  // user_groups (empty)
      return createChain(null)
    })

    const res = await getKnowledgeNav()
    expect(res.status).toBe(200)

    const body = await res.json()
    const salesNodes = body.tree.filter(
      (n: { title: string }) => n.title === 'Sales Playbook'
    )
    expect(salesNodes).toHaveLength(0)
  })

  it('includes group:sales pages for user in sales group', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: SALES_USER_ID } },
      error: null,
    })

    let fromCounter = 0
    mockFrom.mockImplementation(() => {
      fromCounter++
      if (fromCounter === 1) return createChain(salesProfile)            // profiles
      if (fromCounter === 2) return createChain(sampleNavPages)          // docs_pages
      if (fromCounter === 3) return createChain([{ group_name: 'sales' }]) // user_groups
      return createChain(null)
    })

    const res = await getKnowledgeNav()
    expect(res.status).toBe(200)

    const body = await res.json()
    const titles = body.tree.map((n: { title: string }) => n.title)
    expect(titles).toContain('Sales Playbook')
    expect(titles).toContain('Getting Started')
    expect(titles).toContain('Public FAQ')
  })
})

// ---------------------------------------------------------------------------
// Tests: GET /api/knowledge/[...slug]
// ---------------------------------------------------------------------------

describe('GET /api/knowledge/[...slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated user', async () => {
    mockUnauthenticated()

    const res = await getKnowledgePage(
      makeRequest('http://localhost/api/knowledge/getting-started'),
      { params: Promise.resolve({ slug: ['getting-started'] }) }
    )
    expect(res.status).toBe(401)
  })

  it('returns page content for accessible page', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: EMPLOYEE_ID } },
      error: null,
    })

    // Call sequence:
    // 1. getProfile() -> from('profiles')
    // 2. fetchPageBySlug() -> from('docs_pages') - returns array of matching pages
    // 3. fetchUserGroups() -> from('user_groups')
    // 4. fetchNavPages() -> from('docs_pages') - returns nav pages
    let fromCounter = 0
    mockFrom.mockImplementation(() => {
      fromCounter++
      if (fromCounter === 1) return createChain(employeeProfile)       // profiles
      if (fromCounter === 2) return createChain([samplePage])          // docs_pages (slug lookup)
      if (fromCounter === 3) return createChain([])                    // user_groups
      if (fromCounter === 4) return createChain(sampleNavPages)        // docs_pages (nav)
      return createChain(null)
    })

    const res = await getKnowledgePage(
      makeRequest('http://localhost/api/knowledge/getting-started'),
      { params: Promise.resolve({ slug: ['getting-started'] }) }
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.page).toBeDefined()
    expect(body.page.title).toBe('Getting Started')
    expect(body.page.content).toBeDefined()
    expect(body.tree).toBeDefined()
    expect(body.breadcrumbs).toBeDefined()
  })

  it('returns 404 for non-existent page', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: EMPLOYEE_ID } },
      error: null,
    })

    // Call sequence:
    // 1. getProfile() -> from('profiles')
    // 2. fetchPageBySlug() -> from('docs_pages') - returns empty array (no match)
    let fromCounter = 0
    mockFrom.mockImplementation(() => {
      fromCounter++
      if (fromCounter === 1) return createChain(employeeProfile)       // profiles
      if (fromCounter === 2) return createChain([])                    // docs_pages (empty)
      return createChain(null)
    })

    const res = await getKnowledgePage(
      makeRequest('http://localhost/api/knowledge/nonexistent'),
      { params: Promise.resolve({ slug: ['nonexistent'] }) }
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Page not found')
  })

  it('returns 404 for page outside user visibility (group:sales for non-sales user)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: EMPLOYEE_ID } },
      error: null,
    })

    // Call sequence:
    // 1. getProfile() -> from('profiles')
    // 2. fetchPageBySlug() -> from('docs_pages') - returns sales page
    // 3. fetchUserGroups() -> from('user_groups') - returns empty (no sales group)
    let fromCounter = 0
    mockFrom.mockImplementation(() => {
      fromCounter++
      if (fromCounter === 1) return createChain(employeeProfile)       // profiles
      if (fromCounter === 2) return createChain([salesPage])           // docs_pages (found the page)
      if (fromCounter === 3) return createChain([])                    // user_groups (empty)
      return createChain(null)
    })

    const res = await getKnowledgePage(
      makeRequest('http://localhost/api/knowledge/sales-playbook'),
      { params: Promise.resolve({ slug: ['sales-playbook'] }) }
    )
    // Returns 404 (not 403) to avoid revealing existence
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Page not found')
  })
})

// ---------------------------------------------------------------------------
// Tests: GET /api/admin/knowledge (list)
// ---------------------------------------------------------------------------

describe('GET /api/admin/knowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated user', async () => {
    mockUnauthenticated()
    const res = await getAdminKnowledge()
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    mockAuthenticatedEmployee()
    const res = await getAdminKnowledge()
    expect(res.status).toBe(403)
  })

  it('returns all pages for admin', async () => {
    mockAuthenticatedAdmin()

    const allPages = [
      { id: 'p1', title: 'Getting Started', slug: 'getting-started', parent_id: null, order_index: 0, status: 'published', visibility: 'internal', updated_at: '2026-03-10T00:00:00Z' },
      { id: 'p2', title: 'Draft Page', slug: 'draft-page', parent_id: null, order_index: 1, status: 'draft', visibility: 'internal', updated_at: '2026-03-11T00:00:00Z' },
      { id: 'p3', title: 'Sales Only', slug: 'sales-only', parent_id: null, order_index: 2, status: 'published', visibility: 'group:sales', updated_at: '2026-03-12T00:00:00Z' },
    ]

    // fetchAllPagesAdmin uses createServiceClient -> mockServiceFrom
    mockServiceFrom.mockImplementation(() => createChain(allPages))

    const res = await getAdminKnowledge()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.pages).toBeDefined()
    expect(body.pages).toHaveLength(3)
    // Admin sees all statuses and visibilities
    const titles = body.pages.map((p: { title: string }) => p.title)
    expect(titles).toContain('Draft Page')
    expect(titles).toContain('Sales Only')
  })
})

// ---------------------------------------------------------------------------
// Tests: POST /api/admin/knowledge (create)
// ---------------------------------------------------------------------------

describe('POST /api/admin/knowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated user', async () => {
    mockUnauthenticated()
    const req = new Request('http://localhost/api/admin/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', slug: 'test' }),
    }) as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/admin/knowledge') })

    const res = await createAdminKnowledge(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    mockAuthenticatedEmployee()
    const req = new Request('http://localhost/api/admin/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', slug: 'test' }),
    }) as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/admin/knowledge') })

    const res = await createAdminKnowledge(req)
    expect(res.status).toBe(403)
  })

  it('creates page with valid data for admin', async () => {
    mockAuthenticatedAdmin()

    const createdPage = {
      id: 'new-page-id',
      title: 'New Knowledge Page',
      slug: 'new-knowledge-page',
      parent_id: null,
      visibility: 'internal',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      status: 'draft',
      order_index: 0,
    }

    // POST uses createServiceClient for:
    // 1. sibling order_index query (from('docs_pages'))
    // 2. insert (from('docs_pages'))
    let serviceCounter = 0
    mockServiceFrom.mockImplementation(() => {
      serviceCounter++
      if (serviceCounter === 1) return createChain([])              // sibling query (empty)
      if (serviceCounter === 2) return createChain(createdPage)     // insert
      return createChain(null)
    })

    const req = new Request('http://localhost/api/admin/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Knowledge Page',
        slug: 'new-knowledge-page',
      }),
    }) as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/admin/knowledge') })

    const res = await createAdminKnowledge(req)
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.page).toBeDefined()
    expect(body.page.title).toBe('New Knowledge Page')
    expect(body.page.slug).toBe('new-knowledge-page')
  })

  it('returns 400 for invalid data (missing title)', async () => {
    mockAuthenticatedAdmin()

    const req = new Request('http://localhost/api/admin/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'missing-title' }),
    }) as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/admin/knowledge') })

    const res = await createAdminKnowledge(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('Validation failed')
    expect(body.details).toBeDefined()
  })

  it('returns 400 for invalid data (missing slug)', async () => {
    mockAuthenticatedAdmin()

    const req = new Request('http://localhost/api/admin/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'No Slug' }),
    }) as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/admin/knowledge') })

    const res = await createAdminKnowledge(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('Validation failed')
  })
})

// ---------------------------------------------------------------------------
// Tests: PATCH /api/admin/knowledge/[pageId]
// ---------------------------------------------------------------------------

describe('PATCH /api/admin/knowledge/[pageId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 for non-admin user', async () => {
    mockAuthenticatedEmployee()

    const req = new Request('http://localhost/api/admin/knowledge/p1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Title' }),
    }) as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/admin/knowledge/p1') })

    const res = await patchAdminKnowledgePage(req, {
      params: Promise.resolve({ pageId: 'p1' }),
    })
    expect(res.status).toBe(403)
  })

  it('updates page for admin', async () => {
    mockAuthenticatedAdmin()

    const updatedPage = {
      id: 'p1',
      title: 'Updated Title',
      slug: 'getting-started',
      parent_id: null,
      visibility: 'internal',
      content: { type: 'doc', content: [] },
      status: 'published',
      order_index: 0,
    }

    // PATCH uses createServiceClient for update
    mockServiceFrom.mockImplementation(() => createChain(updatedPage))

    const req = new Request('http://localhost/api/admin/knowledge/p1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Title' }),
    }) as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/admin/knowledge/p1') })

    const res = await patchAdminKnowledgePage(req, {
      params: Promise.resolve({ pageId: 'p1' }),
    })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.page.title).toBe('Updated Title')
  })

  it('returns 400 when no fields to update', async () => {
    mockAuthenticatedAdmin()

    const req = new Request('http://localhost/api/admin/knowledge/p1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }) as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/admin/knowledge/p1') })

    const res = await patchAdminKnowledgePage(req, {
      params: Promise.resolve({ pageId: 'p1' }),
    })
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('No fields to update')
  })
})

// ---------------------------------------------------------------------------
// Tests: DELETE /api/admin/knowledge/[pageId]
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/knowledge/[pageId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 for non-admin user', async () => {
    mockAuthenticatedEmployee()

    const req = new Request('http://localhost/api/admin/knowledge/p1', {
      method: 'DELETE',
    }) as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/admin/knowledge/p1') })

    const res = await deleteAdminKnowledgePage(req, {
      params: Promise.resolve({ pageId: 'p1' }),
    })
    expect(res.status).toBe(403)
  })

  it('deletes page for admin', async () => {
    mockAuthenticatedAdmin()

    // DELETE uses createServiceClient
    mockServiceFrom.mockImplementation(() => {
      const chain = createChain(null)
      // Override then to simulate successful delete (no error)
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: null, error: null })
      return chain
    })

    const req = new Request('http://localhost/api/admin/knowledge/p1', {
      method: 'DELETE',
    }) as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/admin/knowledge/p1') })

    const res = await deleteAdminKnowledgePage(req, {
      params: Promise.resolve({ pageId: 'p1' }),
    })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 401 for unauthenticated user', async () => {
    mockUnauthenticated()

    const req = new Request('http://localhost/api/admin/knowledge/p1', {
      method: 'DELETE',
    }) as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/admin/knowledge/p1') })

    const res = await deleteAdminKnowledgePage(req, {
      params: Promise.resolve({ pageId: 'p1' }),
    })
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// Tests: GET /api/search
// ---------------------------------------------------------------------------

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated user', async () => {
    mockUnauthenticated()

    const req = new Request('http://localhost/api/search?q=test') as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/search?q=test') })

    const res = await getSearch(req)
    expect(res.status).toBe(401)
  })

  it('returns results for valid query', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: EMPLOYEE_ID } },
      error: null,
    })

    const knowledgeResults = [
      { id: 'k1', title: 'Getting Started Guide', slug: 'getting-started', parent_id: null },
    ]
    const courseResults = [
      { id: 'c1', title: 'Getting Started Course', slug: 'getting-started-course', description: 'A course about getting started' },
    ]
    const lessonResults: unknown[] = []
    const certResults: unknown[] = []

    // Call sequence:
    // 1. getProfile() -> from('profiles')
    // 2. globalSearch() -> from('docs_pages') - knowledge search
    // 3. globalSearch() -> from('courses') - course search
    // 4. globalSearch() -> from('lessons') - lesson search
    // 5. globalSearch() -> from('certification_tracks') - cert search
    let fromCounter = 0
    mockFrom.mockImplementation(() => {
      fromCounter++
      if (fromCounter === 1) return createChain(employeeProfile)       // profiles
      if (fromCounter === 2) return createChain(knowledgeResults)      // docs_pages
      if (fromCounter === 3) return createChain(courseResults)         // courses
      if (fromCounter === 4) return createChain(lessonResults)         // lessons
      if (fromCounter === 5) return createChain(certResults)           // certification_tracks
      return createChain(null)
    })

    const req = new Request('http://localhost/api/search?q=getting started') as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/search?q=getting started') })

    const res = await getSearch(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.results).toBeDefined()
    expect(body.results.length).toBe(2)

    const types = body.results.map((r: { type: string }) => r.type)
    expect(types).toContain('knowledge')
    expect(types).toContain('course')
  })

  it('returns 400 for short query (less than 2 chars)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: EMPLOYEE_ID } },
      error: null,
    })

    // getProfile still needs to succeed
    let fromCounter = 0
    mockFrom.mockImplementation(() => {
      fromCounter++
      if (fromCounter === 1) return createChain(employeeProfile)
      return createChain(null)
    })

    const req = new Request('http://localhost/api/search?q=a') as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/search?q=a') })

    const res = await getSearch(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toContain('at least 2 characters')
  })

  it('returns 400 for empty query', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: EMPLOYEE_ID } },
      error: null,
    })

    let fromCounter = 0
    mockFrom.mockImplementation(() => {
      fromCounter++
      if (fromCounter === 1) return createChain(employeeProfile)
      return createChain(null)
    })

    const req = new Request('http://localhost/api/search?q=') as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/search?q=') })

    const res = await getSearch(req)
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// Tests: User Groups management (/api/admin/users/groups)
// ---------------------------------------------------------------------------

describe('GET /api/admin/users/groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated user', async () => {
    mockUnauthenticated()
    const res = await getGroups()
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    mockAuthenticatedEmployee()
    const res = await getGroups()
    expect(res.status).toBe(403)
  })

  it('returns distinct groups for admin', async () => {
    mockAuthenticatedAdmin()

    const groupRows = [
      { group_name: 'sales' },
      { group_name: 'sales' },
      { group_name: 'engineering' },
    ]

    mockServiceFrom.mockImplementation(() => createChain(groupRows))

    const res = await getGroups()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.groups).toBeDefined()
    // Should deduplicate
    expect(body.groups).toHaveLength(2)
    expect(body.groups).toContain('sales')
    expect(body.groups).toContain('engineering')
  })
})

describe('POST /api/admin/users/groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated user', async () => {
    mockUnauthenticated()

    const req = new Request('http://localhost/api/admin/users/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: EMPLOYEE_ID, groupName: 'sales' }),
    }) as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/admin/users/groups') })

    const res = await addToGroup(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    mockAuthenticatedEmployee()

    const req = new Request('http://localhost/api/admin/users/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: EMPLOYEE_ID, groupName: 'sales' }),
    }) as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/admin/users/groups') })

    const res = await addToGroup(req)
    expect(res.status).toBe(403)
  })

  it('adds user to group for admin', async () => {
    // For POST, requireAdmin returns profile (needed for added_by)
    mockGetUser.mockResolvedValue({
      data: { user: { id: ADMIN_ID } },
      error: null,
    })

    let fromCounter = 0
    mockFrom.mockImplementation(() => {
      fromCounter++
      if (fromCounter === 1) return createChain(adminProfile) // profiles lookup
      return createChain(null)
    })

    // Service client for the insert
    mockServiceFrom.mockImplementation(() => {
      const chain = createChain(null)
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: null, error: null })
      return chain
    })

    const req = new Request('http://localhost/api/admin/users/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: EMPLOYEE_ID, groupName: 'sales' }),
    }) as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/admin/users/groups') })

    const res = await addToGroup(req)
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 409 for duplicate group membership', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: ADMIN_ID } },
      error: null,
    })

    let fromCounter = 0
    mockFrom.mockImplementation(() => {
      fromCounter++
      if (fromCounter === 1) return createChain(adminProfile)
      return createChain(null)
    })

    // Service client returns duplicate key error
    mockServiceFrom.mockImplementation(() => {
      const chain = createChain(null, null)
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: null, error: { code: '23505', message: 'duplicate key' } })
      return chain
    })

    const req = new Request('http://localhost/api/admin/users/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: EMPLOYEE_ID, groupName: 'sales' }),
    }) as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/admin/users/groups') })

    const res = await addToGroup(req)
    expect(res.status).toBe(409)

    const body = await res.json()
    expect(body.error).toContain('already in this group')
  })
})

describe('DELETE /api/admin/users/groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 for non-admin user', async () => {
    mockAuthenticatedEmployee()

    const req = new Request('http://localhost/api/admin/users/groups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: EMPLOYEE_ID, groupName: 'sales' }),
    }) as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/admin/users/groups') })

    const res = await removeFromGroup(req)
    expect(res.status).toBe(403)
  })

  it('removes user from group for admin', async () => {
    mockAuthenticatedAdmin()

    // Service client for the delete
    mockServiceFrom.mockImplementation(() => {
      const chain = createChain(null)
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: null, error: null })
      return chain
    })

    const req = new Request('http://localhost/api/admin/users/groups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: EMPLOYEE_ID, groupName: 'sales' }),
    }) as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/admin/users/groups') })

    const res = await removeFromGroup(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 400 for invalid input (missing groupName)', async () => {
    mockAuthenticatedAdmin()

    const req = new Request('http://localhost/api/admin/users/groups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: EMPLOYEE_ID }),
    }) as unknown as import('next/server').NextRequest
    Object.defineProperty(req, 'nextUrl', { value: new URL('http://localhost/api/admin/users/groups') })

    const res = await removeFromGroup(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('Validation failed')
  })
})
