import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the Supabase server client before importing routes
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock the share token generator so tests are deterministic
vi.mock('@/lib/sales/share-token', () => ({
  generateShareToken: vi.fn(() => 'mock-token-12'),
}))

import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createRequest(
  url: string,
  method: string,
  body?: unknown
): NextRequest {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new NextRequest(url, init)
}

/**
 * Creates a chainable mock that supports arbitrary .method() chains
 * and resolves to the given value at the end of the chain.
 */
function createChainMock(resolveValue: unknown) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve(resolveValue)
      }
      return (..._args: unknown[]) => new Proxy({}, handler)
    },
  }
  return new Proxy({}, handler)
}

// ---------------------------------------------------------------------------
// Table-aware mock builder
// ---------------------------------------------------------------------------

interface TableMockConfig {
  [table: string]: {
    selectResult?: unknown
    insertResult?: unknown
    updateResult?: unknown
    deleteResult?: unknown
  }
}

interface MockSupabaseOptions {
  user?: { id: string } | null
  authError?: { message: string } | null
  profile?: { role: string; id: string } | null
  profileError?: { message: string } | null
  tables?: TableMockConfig
}

function setupMockSupabase(options: MockSupabaseOptions = {}) {
  const {
    user = { id: 'admin-id' },
    authError = null,
    profile = { role: 'admin', id: 'admin-id' },
    profileError = null,
    tables = {},
  } = options

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'profiles') {
      return createChainMock({ data: profile, error: profileError })
    }

    const config = tables[table] ?? {}

    return {
      select: (..._args: unknown[]) => {
        return createChainMock(
          config.selectResult ?? { data: null, error: null }
        )
      },
      insert: (..._args: unknown[]) => {
        return createChainMock(
          config.insertResult ?? { data: null, error: null }
        )
      },
      update: (..._args: unknown[]) => {
        return createChainMock(
          config.updateResult ?? { data: null, error: null }
        )
      },
      delete: (..._args: unknown[]) => {
        return createChainMock(
          config.deleteResult ?? { error: null }
        )
      },
    }
  })

  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: authError,
      }),
    },
    from: mockFrom,
  } as unknown as Awaited<ReturnType<typeof createClient>>)

  return { mockFrom }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MATERIAL_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

const VALID_CREATE_BODY = {
  title: 'Battle Card: Competitor X',
  slug: 'battle-card-competitor-x',
  material_type: 'battle_card',
}

const MOCK_MATERIAL = {
  id: MATERIAL_ID,
  title: 'Battle Card: Competitor X',
  slug: 'battle-card-competitor-x',
  description: null,
  material_type: 'battle_card',
  category: null,
  tags: [],
  content: null,
  file_name: null,
  file_mime_type: null,
  file_size_bytes: null,
  file_path: null,
  shareable: false,
  share_token: 'mock-token-12',
  status: 'draft',
  created_by: 'admin-id',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

// ===========================================================================
// POST /api/admin/sales-materials — Create
// ===========================================================================

describe('POST /api/admin/sales-materials', () => {
  let POST: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@/app/api/admin/sales-materials/route')
    POST = mod.POST
  })

  it('creates a material with valid data and returns 201', async () => {
    setupMockSupabase({
      tables: {
        sales_materials: {
          // slug uniqueness check -> no existing material
          selectResult: { data: null, error: null },
          // insert result
          insertResult: { data: MOCK_MATERIAL, error: null },
        },
      },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/sales-materials',
      'POST',
      VALID_CREATE_BODY
    )
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.material).toBeDefined()
    expect(body.material.title).toBe('Battle Card: Competitor X')
    expect(body.material.share_token).toBe('mock-token-12')
  })

  it('creates a material with all optional fields', async () => {
    const fullBody = {
      ...VALID_CREATE_BODY,
      description: 'Detailed competitive analysis',
      category: 'competitive',
      tags: ['enterprise', 'competitor-x'],
      shareable: true,
      status: 'published',
    }
    const fullMaterial = {
      ...MOCK_MATERIAL,
      description: 'Detailed competitive analysis',
      category: 'competitive',
      tags: ['enterprise', 'competitor-x'],
      shareable: true,
      status: 'published',
    }

    setupMockSupabase({
      tables: {
        sales_materials: {
          selectResult: { data: null, error: null },
          insertResult: { data: fullMaterial, error: null },
        },
      },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/sales-materials',
      'POST',
      fullBody
    )
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.material.shareable).toBe(true)
    expect(body.material.category).toBe('competitive')
  })

  it('returns 400 when title is missing', async () => {
    setupMockSupabase()

    const req = createRequest(
      'http://localhost:3000/api/admin/sales-materials',
      'POST',
      { slug: 'no-title', material_type: 'battle_card' }
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  it('returns 400 when slug is missing', async () => {
    setupMockSupabase()

    const req = createRequest(
      'http://localhost:3000/api/admin/sales-materials',
      'POST',
      { title: 'No Slug', material_type: 'battle_card' }
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when slug has invalid format', async () => {
    setupMockSupabase()

    const req = createRequest(
      'http://localhost:3000/api/admin/sales-materials',
      'POST',
      { title: 'Test', slug: 'INVALID SLUG!', material_type: 'battle_card' }
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when material_type is missing', async () => {
    setupMockSupabase()

    const req = createRequest(
      'http://localhost:3000/api/admin/sales-materials',
      'POST',
      { title: 'Test', slug: 'test' }
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when material_type is invalid', async () => {
    setupMockSupabase()

    const req = createRequest(
      'http://localhost:3000/api/admin/sales-materials',
      'POST',
      { title: 'Test', slug: 'test', material_type: 'not_a_valid_type' }
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    setupMockSupabase()

    const req = new NextRequest(
      'http://localhost:3000/api/admin/sales-materials',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json{{{',
      }
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 409 when slug already exists', async () => {
    setupMockSupabase({
      tables: {
        sales_materials: {
          // slug uniqueness check -> existing material found
          selectResult: { data: { id: 'existing-id' }, error: null },
        },
      },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/sales-materials',
      'POST',
      VALID_CREATE_BODY
    )
    const res = await POST(req)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('slug already exists')
  })

  it('returns 401 for unauthenticated user', async () => {
    setupMockSupabase({ user: null, authError: { message: 'Not auth' } })

    const req = createRequest(
      'http://localhost:3000/api/admin/sales-materials',
      'POST',
      VALID_CREATE_BODY
    )
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'employee', id: 'emp-id' } })

    const req = createRequest(
      'http://localhost:3000/api/admin/sales-materials',
      'POST',
      VALID_CREATE_BODY
    )
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 for sales role user', async () => {
    setupMockSupabase({ profile: { role: 'sales', id: 'sales-id' } })

    const req = createRequest(
      'http://localhost:3000/api/admin/sales-materials',
      'POST',
      VALID_CREATE_BODY
    )
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 500 on Supabase insert error', async () => {
    setupMockSupabase({
      tables: {
        sales_materials: {
          selectResult: { data: null, error: null },
          insertResult: { data: null, error: { message: 'DB insert error' } },
        },
      },
    })

    const req = createRequest(
      'http://localhost:3000/api/admin/sales-materials',
      'POST',
      VALID_CREATE_BODY
    )
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to create material')
  })
})

// ===========================================================================
// GET /api/admin/sales-materials — Admin list (all statuses)
// ===========================================================================

describe('GET /api/admin/sales-materials', () => {
  let GET: () => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@/app/api/admin/sales-materials/route')
    GET = mod.GET
  })

  it('returns all materials for admin user', async () => {
    const draftMaterial = { ...MOCK_MATERIAL, status: 'draft' }
    const publishedMaterial = { ...MOCK_MATERIAL, id: 'bbbb', status: 'published' }
    const archivedMaterial = { ...MOCK_MATERIAL, id: 'cccc', status: 'archived' }

    setupMockSupabase({
      tables: {
        sales_materials: {
          selectResult: {
            data: [draftMaterial, publishedMaterial, archivedMaterial],
            error: null,
          },
        },
      },
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.materials).toHaveLength(3)
  })

  it('returns 401 for unauthenticated user', async () => {
    setupMockSupabase({ user: null, authError: { message: 'Not auth' } })

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'sales', id: 'sales-id' } })

    const res = await GET()
    expect(res.status).toBe(403)
  })
})

// ===========================================================================
// PATCH /api/admin/sales-materials/[id] — Update
// ===========================================================================

describe('PATCH /api/admin/sales-materials/[id]', () => {
  let PATCH: (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@/app/api/admin/sales-materials/[id]/route')
    PATCH = mod.PATCH
  })

  it('updates a material with partial fields and returns 200', async () => {
    const updatedMaterial = { ...MOCK_MATERIAL, title: 'Updated Battle Card' }
    setupMockSupabase({
      tables: {
        sales_materials: {
          // Slug uniqueness check (not needed since we are not changing slug)
          selectResult: { data: null, error: null },
          updateResult: { data: updatedMaterial, error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/sales-materials/${MATERIAL_ID}`,
      'PATCH',
      { title: 'Updated Battle Card' }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ id: MATERIAL_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.material.title).toBe('Updated Battle Card')
  })

  it('updates status from draft to published', async () => {
    const publishedMaterial = { ...MOCK_MATERIAL, status: 'published' }
    setupMockSupabase({
      tables: {
        sales_materials: {
          selectResult: { data: null, error: null },
          updateResult: { data: publishedMaterial, error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/sales-materials/${MATERIAL_ID}`,
      'PATCH',
      { status: 'published' }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ id: MATERIAL_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.material.status).toBe('published')
  })

  it('returns 409 when changing slug to one that already exists', async () => {
    setupMockSupabase({
      tables: {
        sales_materials: {
          // slug uniqueness check -> conflict found
          selectResult: { data: { id: 'other-id' }, error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/sales-materials/${MATERIAL_ID}`,
      'PATCH',
      { slug: 'existing-slug' }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ id: MATERIAL_ID }),
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('slug already exists')
  })

  it('proceeds with default values when body is empty (Zod defaults apply)', async () => {
    // updateMaterialSchema is createMaterialSchema.partial(), so an empty {}
    // still gets default values from Zod (tags=[], shareable=false, status='draft').
    // The route will attempt the update with those defaults.
    const updatedMaterial = { ...MOCK_MATERIAL }
    setupMockSupabase({
      tables: {
        sales_materials: {
          selectResult: { data: null, error: null },
          updateResult: { data: updatedMaterial, error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/sales-materials/${MATERIAL_ID}`,
      'PATCH',
      {}
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ id: MATERIAL_ID }),
    })
    expect(res.status).toBe(200)
  })

  it('returns 400 for invalid JSON body', async () => {
    setupMockSupabase()

    const req = new NextRequest(
      `http://localhost:3000/api/admin/sales-materials/${MATERIAL_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json{{{',
      }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ id: MATERIAL_ID }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 404 when material does not exist', async () => {
    setupMockSupabase({
      tables: {
        sales_materials: {
          selectResult: { data: null, error: null },
          updateResult: { data: null, error: { message: 'not found' } },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/sales-materials/${MATERIAL_ID}`,
      'PATCH',
      { title: 'New Title' }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ id: MATERIAL_ID }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 401 for unauthenticated user', async () => {
    setupMockSupabase({ user: null, authError: { message: 'Not auth' } })

    const req = createRequest(
      `http://localhost:3000/api/admin/sales-materials/${MATERIAL_ID}`,
      'PATCH',
      { title: 'New Title' }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ id: MATERIAL_ID }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'employee', id: 'emp-id' } })

    const req = createRequest(
      `http://localhost:3000/api/admin/sales-materials/${MATERIAL_ID}`,
      'PATCH',
      { title: 'Hacked' }
    )
    const res = await PATCH(req, {
      params: Promise.resolve({ id: MATERIAL_ID }),
    })
    expect(res.status).toBe(403)
  })
})

// ===========================================================================
// DELETE /api/admin/sales-materials/[id] — Soft delete (archive)
// ===========================================================================

describe('DELETE /api/admin/sales-materials/[id]', () => {
  let DELETE: (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@/app/api/admin/sales-materials/[id]/route')
    DELETE = mod.DELETE
  })

  it('archives a material and returns 200', async () => {
    setupMockSupabase({
      tables: {
        sales_materials: {
          updateResult: { error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/sales-materials/${MATERIAL_ID}`,
      'DELETE'
    )
    const res = await DELETE(req, {
      params: Promise.resolve({ id: MATERIAL_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 on Supabase error during archive', async () => {
    setupMockSupabase({
      tables: {
        sales_materials: {
          updateResult: { error: { message: 'DB error' } },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/sales-materials/${MATERIAL_ID}`,
      'DELETE'
    )
    const res = await DELETE(req, {
      params: Promise.resolve({ id: MATERIAL_ID }),
    })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to archive material')
  })

  it('returns 401 for unauthenticated user', async () => {
    setupMockSupabase({ user: null, authError: { message: 'Not auth' } })

    const req = createRequest(
      `http://localhost:3000/api/admin/sales-materials/${MATERIAL_ID}`,
      'DELETE'
    )
    const res = await DELETE(req, {
      params: Promise.resolve({ id: MATERIAL_ID }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'sales', id: 'sales-id' } })

    const req = createRequest(
      `http://localhost:3000/api/admin/sales-materials/${MATERIAL_ID}`,
      'DELETE'
    )
    const res = await DELETE(req, {
      params: Promise.resolve({ id: MATERIAL_ID }),
    })
    expect(res.status).toBe(403)
  })
})

// ===========================================================================
// GET /api/admin/sales-materials/[id] — Single material
// ===========================================================================

describe('GET /api/admin/sales-materials/[id]', () => {
  let GET: (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@/app/api/admin/sales-materials/[id]/route')
    GET = mod.GET
  })

  it('returns 200 with material data for an existing material', async () => {
    setupMockSupabase({
      tables: {
        sales_materials: {
          selectResult: { data: MOCK_MATERIAL, error: null },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/sales-materials/${MATERIAL_ID}`,
      'GET'
    )
    const res = await GET(req, {
      params: Promise.resolve({ id: MATERIAL_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.material.id).toBe(MATERIAL_ID)
    expect(body.material.title).toBe('Battle Card: Competitor X')
    // download_url should be null when no file_path
    expect(body.material.download_url).toBeNull()
  })

  it('returns 404 for a non-existent material', async () => {
    setupMockSupabase({
      tables: {
        sales_materials: {
          selectResult: { data: null, error: { message: 'not found' } },
        },
      },
    })

    const req = createRequest(
      `http://localhost:3000/api/admin/sales-materials/${MATERIAL_ID}`,
      'GET'
    )
    const res = await GET(req, {
      params: Promise.resolve({ id: MATERIAL_ID }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 401 for unauthenticated user', async () => {
    setupMockSupabase({ user: null, authError: { message: 'Not auth' } })

    const req = createRequest(
      `http://localhost:3000/api/admin/sales-materials/${MATERIAL_ID}`,
      'GET'
    )
    const res = await GET(req, {
      params: Promise.resolve({ id: MATERIAL_ID }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    setupMockSupabase({ profile: { role: 'employee', id: 'emp-id' } })

    const req = createRequest(
      `http://localhost:3000/api/admin/sales-materials/${MATERIAL_ID}`,
      'GET'
    )
    const res = await GET(req, {
      params: Promise.resolve({ id: MATERIAL_ID }),
    })
    expect(res.status).toBe(403)
  })
})
