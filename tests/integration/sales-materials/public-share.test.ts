import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the route
// ---------------------------------------------------------------------------

const mockFrom = vi.fn()
const mockStorage = {
  from: vi.fn().mockReturnValue({
    createSignedUrl: vi.fn().mockResolvedValue({
      data: null,
      error: null,
    }),
  }),
}

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: mockFrom,
    storage: mockStorage,
  })),
}))

import { GET } from '@/app/api/public/materials/[shareToken]/route'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

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

function createRequest(url: string): NextRequest {
  return new NextRequest(url)
}

const VALID_SHARE_TOKEN = 'abc123def456'
const SHORT_TOKEN = 'abc'

const MOCK_PUBLIC_MATERIAL = {
  id: 'aaaaaaaa-1111-4111-a111-111111111111',
  title: 'Battle Card: Competitor X',
  slug: 'battle-card-competitor-x',
  description: 'Competitive analysis against X',
  material_type: 'battle_card',
  category: 'competitive',
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Analysis content' }] }] },
  file_name: null,
  file_mime_type: null,
  file_size_bytes: null,
  file_path: null,
  updated_at: '2026-03-01T00:00:00Z',
}

const MOCK_MATERIAL_WITH_FILE = {
  ...MOCK_PUBLIC_MATERIAL,
  file_name: 'battle-card.pdf',
  file_mime_type: 'application/pdf',
  file_size_bytes: 1048576,
  file_path: 'materials/battle-card.pdf',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/public/materials/[shareToken]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 for a share token that is too short', async () => {
    const req = createRequest(
      `http://localhost:3000/api/public/materials/${SHORT_TOKEN}`
    )
    const res = await GET(req, {
      params: Promise.resolve({ shareToken: SHORT_TOKEN }),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Not found')
  })

  it('returns 404 for an empty share token', async () => {
    const req = createRequest(
      'http://localhost:3000/api/public/materials/'
    )
    const res = await GET(req, {
      params: Promise.resolve({ shareToken: '' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 when no material matches the share token', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => createChainMock({ data: null, error: { message: 'not found', code: 'PGRST116' } }),
    }))

    const req = createRequest(
      `http://localhost:3000/api/public/materials/${VALID_SHARE_TOKEN}`
    )
    const res = await GET(req, {
      params: Promise.resolve({ shareToken: VALID_SHARE_TOKEN }),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Not found')
  })

  it('returns 404 for a material that is not shareable', async () => {
    // The route applies .eq('shareable', true) — so a non-shareable material
    // will not be returned by the query, resulting in 404
    mockFrom.mockImplementation(() => ({
      select: () => createChainMock({ data: null, error: null }),
    }))

    const req = createRequest(
      `http://localhost:3000/api/public/materials/${VALID_SHARE_TOKEN}`
    )
    const res = await GET(req, {
      params: Promise.resolve({ shareToken: VALID_SHARE_TOKEN }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 for a material that is in draft status', async () => {
    // The route applies .eq('status', 'published') — so a draft material
    // will not be returned by the query, resulting in 404
    mockFrom.mockImplementation(() => ({
      select: () => createChainMock({ data: null, error: null }),
    }))

    const req = createRequest(
      `http://localhost:3000/api/public/materials/${VALID_SHARE_TOKEN}`
    )
    const res = await GET(req, {
      params: Promise.resolve({ shareToken: VALID_SHARE_TOKEN }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 200 with content for a valid shareable published material', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => createChainMock({ data: MOCK_PUBLIC_MATERIAL, error: null }),
    }))

    const req = createRequest(
      `http://localhost:3000/api/public/materials/${VALID_SHARE_TOKEN}`
    )
    const res = await GET(req, {
      params: Promise.resolve({ shareToken: VALID_SHARE_TOKEN }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.material).toBeDefined()
    expect(body.material.title).toBe('Battle Card: Competitor X')
    expect(body.material.content).toBeDefined()
    expect(body.material.download_url).toBeNull()
  })

  it('does not expose file_path in the response', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => createChainMock({ data: MOCK_MATERIAL_WITH_FILE, error: null }),
    }))

    // Mock storage signed URL generation
    mockStorage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://cdn.example.com/signed-url' },
        error: null,
      }),
    })

    const req = createRequest(
      `http://localhost:3000/api/public/materials/${VALID_SHARE_TOKEN}`
    )
    const res = await GET(req, {
      params: Promise.resolve({ shareToken: VALID_SHARE_TOKEN }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()

    // file_path should be stripped from the response
    expect(body.material.file_path).toBeUndefined()
    // download_url should be populated from the signed URL
    expect(body.material.download_url).toBe('https://cdn.example.com/signed-url')
    // Other file metadata should still be present
    expect(body.material.file_name).toBe('battle-card.pdf')
    expect(body.material.file_mime_type).toBe('application/pdf')
    expect(body.material.file_size_bytes).toBe(1048576)
  })

  it('returns download_url as null when file_path exists but signed URL fails', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => createChainMock({ data: MOCK_MATERIAL_WITH_FILE, error: null }),
    }))

    // Mock storage signed URL failure
    mockStorage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Storage error' },
      }),
    })

    const req = createRequest(
      `http://localhost:3000/api/public/materials/${VALID_SHARE_TOKEN}`
    )
    const res = await GET(req, {
      params: Promise.resolve({ shareToken: VALID_SHARE_TOKEN }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.material.download_url).toBeNull()
    expect(body.material.file_path).toBeUndefined()
  })

  it('does not require authentication', async () => {
    // This is a public endpoint — no auth mock needed
    mockFrom.mockImplementation(() => ({
      select: () => createChainMock({ data: MOCK_PUBLIC_MATERIAL, error: null }),
    }))

    const req = createRequest(
      `http://localhost:3000/api/public/materials/${VALID_SHARE_TOKEN}`
    )
    const res = await GET(req, {
      params: Promise.resolve({ shareToken: VALID_SHARE_TOKEN }),
    })
    // Should succeed without any auth setup
    expect(res.status).toBe(200)
  })
})
