import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the routes
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/requireAdmin', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/video/signed-url', () => ({
  generateSignedUrl: vi.fn(),
  getIframeUrl: vi.fn(),
}))

import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createClient } from '@/lib/supabase/server'
import { generateSignedUrl, getIframeUrl } from '@/lib/video/signed-url'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockCreateClient = vi.mocked(createClient)
const mockGenerateSignedUrl = vi.mocked(generateSignedUrl)
const mockGetIframeUrl = vi.mocked(getIframeUrl)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const ADMIN_PROFILE = {
  id: 'admin-id',
  role: 'admin',
  full_name: 'Test Admin',
  email: 'admin@example.com',
  avatar_url: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

function adminAuthorized() {
  mockRequireAdmin.mockResolvedValue({
    profile: ADMIN_PROFILE as never,
    error: null,
    supabase: {} as never,
  })
}

function adminUnauthorized() {
  mockRequireAdmin.mockResolvedValue({
    profile: null,
    error: { message: 'Unauthorized', status: 401 },
    supabase: {} as never,
  })
}

function adminForbidden() {
  mockRequireAdmin.mockResolvedValue({
    profile: null,
    error: { message: 'Forbidden: admin access required', status: 403 },
    supabase: {} as never,
  })
}

function mockSupabaseAuthenticated(userId = 'user-123') {
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId, email: 'user@example.com' } },
        error: null,
      }),
    },
  }
  mockCreateClient.mockResolvedValue(mockSupabase as never)
  return mockSupabase
}

function mockSupabaseUnauthenticated() {
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      }),
    },
  }
  mockCreateClient.mockResolvedValue(mockSupabase as never)
  return mockSupabase
}

function mockBunnyResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }
}

// ---------------------------------------------------------------------------
// Tests — POST /api/admin/video/upload-url
// ---------------------------------------------------------------------------

describe('POST /api/admin/video/upload-url', () => {
  let POST: (request: NextRequest) => Promise<Response>
  let originalFetch: typeof global.fetch
  let savedEnv: Record<string, string | undefined>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    originalFetch = global.fetch

    savedEnv = {
      BUNNY_STREAM_API_KEY: process.env.BUNNY_STREAM_API_KEY,
      BUNNY_STREAM_LIBRARY_ID: process.env.BUNNY_STREAM_LIBRARY_ID,
    }

    process.env.BUNNY_STREAM_API_KEY = 'test-bunny-api-key'
    process.env.BUNNY_STREAM_LIBRARY_ID = 'test-library-id'

    const mod = await import('@/app/api/admin/video/upload-url/route')
    POST = mod.POST
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.BUNNY_STREAM_API_KEY = savedEnv.BUNNY_STREAM_API_KEY
    process.env.BUNNY_STREAM_LIBRARY_ID = savedEnv.BUNNY_STREAM_LIBRARY_ID
  })

  it('returns 401 when user is not authenticated', async () => {
    adminUnauthorized()

    const req = new NextRequest('http://localhost:3000/api/admin/video/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when user is not an admin', async () => {
    adminForbidden()

    const req = new NextRequest('http://localhost:3000/api/admin/video/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('Forbidden')
  })

  it('returns upload URL, uid, and authKey on successful Bunny.net response', async () => {
    adminAuthorized()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockBunnyResponse({
          guid: 'bunny-video-guid-123',
          title: 'Untitled Video',
        })
      )
    )

    const req = new NextRequest('http://localhost:3000/api/admin/video/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.uploadUrl).toContain('video.bunnycdn.com')
    expect(body.uploadUrl).toContain('bunny-video-guid-123')
    expect(body.uid).toBe('bunny-video-guid-123')
    expect(body.authKey).toBe('test-bunny-api-key')
  })

  it('passes title to Bunny.net when provided', async () => {
    adminAuthorized()

    const mockFetch = vi.fn().mockResolvedValue(
      mockBunnyResponse({
        guid: 'bunny-video-guid-456',
        title: 'My Video Title',
      })
    )
    vi.stubGlobal('fetch', mockFetch)

    const req = new NextRequest('http://localhost:3000/api/admin/video/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'My Video Title' }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.uid).toBe('bunny-video-guid-456')

    // Verify the Bunny.net API was called with correct URL
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const fetchCall = mockFetch.mock.calls[0]
    expect(fetchCall[0]).toContain('test-library-id')
    expect(fetchCall[0]).toContain('video.bunnycdn.com')
  })

  it('returns 502 when Bunny.net API fails', async () => {
    adminAuthorized()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockBunnyResponse(
          { message: 'Internal error' },
          false,
          500
        )
      )
    )

    const req = new NextRequest('http://localhost:3000/api/admin/video/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)

    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 500 when BUNNY_STREAM_API_KEY is not set', async () => {
    adminAuthorized()
    delete process.env.BUNNY_STREAM_API_KEY

    const req = new NextRequest('http://localhost:3000/api/admin/video/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 500 when BUNNY_STREAM_LIBRARY_ID is not set', async () => {
    adminAuthorized()
    delete process.env.BUNNY_STREAM_LIBRARY_ID

    const req = new NextRequest('http://localhost:3000/api/admin/video/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 502 when fetch to Bunny.net throws a network error', async () => {
    adminAuthorized()

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const req = new NextRequest('http://localhost:3000/api/admin/video/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)

    // Could be 502 or 500 depending on implementation error handling
    expect(res.status).toBeGreaterThanOrEqual(500)
  })
})

// ---------------------------------------------------------------------------
// Tests — GET /api/admin/video/status/[uid]
// ---------------------------------------------------------------------------

describe('GET /api/admin/video/status/[uid]', () => {
  let GET: (
    request: NextRequest,
    context: { params: Promise<{ uid: string }> }
  ) => Promise<Response>
  let originalFetch: typeof global.fetch
  let savedEnv: Record<string, string | undefined>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    originalFetch = global.fetch

    savedEnv = {
      BUNNY_STREAM_API_KEY: process.env.BUNNY_STREAM_API_KEY,
      BUNNY_STREAM_LIBRARY_ID: process.env.BUNNY_STREAM_LIBRARY_ID,
      BUNNY_STREAM_CDN_HOSTNAME: process.env.BUNNY_STREAM_CDN_HOSTNAME,
    }

    process.env.BUNNY_STREAM_API_KEY = 'test-bunny-api-key'
    process.env.BUNNY_STREAM_LIBRARY_ID = 'test-library-id'
    process.env.BUNNY_STREAM_CDN_HOSTNAME = 'vz-test123.b-cdn.net'

    const mod = await import('@/app/api/admin/video/status/[uid]/route')
    GET = mod.GET
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.BUNNY_STREAM_API_KEY = savedEnv.BUNNY_STREAM_API_KEY
    process.env.BUNNY_STREAM_LIBRARY_ID = savedEnv.BUNNY_STREAM_LIBRARY_ID
    process.env.BUNNY_STREAM_CDN_HOSTNAME = savedEnv.BUNNY_STREAM_CDN_HOSTNAME
  })

  it('returns 401 when user is not authenticated', async () => {
    adminUnauthorized()

    const req = new NextRequest('http://localhost:3000/api/admin/video/status/test-uid')
    const res = await GET(req, { params: Promise.resolve({ uid: 'test-uid' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when user is not an admin', async () => {
    adminForbidden()

    const req = new NextRequest('http://localhost:3000/api/admin/video/status/test-uid')
    const res = await GET(req, { params: Promise.resolve({ uid: 'test-uid' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('Forbidden')
  })

  it('returns video status on successful Bunny.net response (finished)', async () => {
    adminAuthorized()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockBunnyResponse({
          guid: 'test-uid',
          status: 4,
          length: 120.5,
          thumbnailFileName: 'thumbnail.jpg',
        })
      )
    )

    const req = new NextRequest('http://localhost:3000/api/admin/video/status/test-uid')
    const res = await GET(req, { params: Promise.resolve({ uid: 'test-uid' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe(4)
    expect(body.duration).toBe(120.5)
    expect(body.thumbnail).toBe('https://vz-test123.b-cdn.net/test-uid/thumbnail.jpg')
    expect(body.readyToStream).toBe(true)
  })

  it('returns correct shape for processing video (not ready)', async () => {
    adminAuthorized()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockBunnyResponse({
          guid: 'processing-uid',
          status: 2,
          length: 0,
          thumbnailFileName: null,
        })
      )
    )

    const req = new NextRequest('http://localhost:3000/api/admin/video/status/processing-uid')
    const res = await GET(req, { params: Promise.resolve({ uid: 'processing-uid' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.readyToStream).toBe(false)
    expect(body.status).toBe(2)
  })

  it('returns 502 when Bunny.net API fails', async () => {
    adminAuthorized()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockBunnyResponse(
          { message: 'Not found' },
          false,
          404
        )
      )
    )

    const req = new NextRequest('http://localhost:3000/api/admin/video/status/nonexistent-uid')
    const res = await GET(req, { params: Promise.resolve({ uid: 'nonexistent-uid' }) })

    expect(res.status).toBe(502)
  })

  it('returns 500 when env vars are missing', async () => {
    adminAuthorized()
    delete process.env.BUNNY_STREAM_API_KEY

    const req = new NextRequest('http://localhost:3000/api/admin/video/status/test-uid')
    const res = await GET(req, { params: Promise.resolve({ uid: 'test-uid' }) })

    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// Tests — DELETE /api/admin/video/[uid]
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/video/[uid]', () => {
  let DELETE: (
    request: NextRequest,
    context: { params: Promise<{ uid: string }> }
  ) => Promise<Response>
  let originalFetch: typeof global.fetch
  let savedEnv: Record<string, string | undefined>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    originalFetch = global.fetch

    savedEnv = {
      BUNNY_STREAM_API_KEY: process.env.BUNNY_STREAM_API_KEY,
      BUNNY_STREAM_LIBRARY_ID: process.env.BUNNY_STREAM_LIBRARY_ID,
    }

    process.env.BUNNY_STREAM_API_KEY = 'test-bunny-api-key'
    process.env.BUNNY_STREAM_LIBRARY_ID = 'test-library-id'

    const mod = await import('@/app/api/admin/video/[uid]/route')
    DELETE = mod.DELETE
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.BUNNY_STREAM_API_KEY = savedEnv.BUNNY_STREAM_API_KEY
    process.env.BUNNY_STREAM_LIBRARY_ID = savedEnv.BUNNY_STREAM_LIBRARY_ID
  })

  it('returns 401 when user is not authenticated', async () => {
    adminUnauthorized()

    const req = new NextRequest('http://localhost:3000/api/admin/video/test-uid', {
      method: 'DELETE',
    })
    const res = await DELETE(req, { params: Promise.resolve({ uid: 'test-uid' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when user is not an admin', async () => {
    adminForbidden()

    const req = new NextRequest('http://localhost:3000/api/admin/video/test-uid', {
      method: 'DELETE',
    })
    const res = await DELETE(req, { params: Promise.resolve({ uid: 'test-uid' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('Forbidden')
  })

  it('returns success when video is deleted successfully', async () => {
    adminAuthorized()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockBunnyResponse({ success: true }, true, 200)
      )
    )

    const req = new NextRequest('http://localhost:3000/api/admin/video/test-uid', {
      method: 'DELETE',
    })
    const res = await DELETE(req, { params: Promise.resolve({ uid: 'test-uid' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('calls Bunny.net DELETE API with correct uid', async () => {
    adminAuthorized()

    const mockFetch = vi.fn().mockResolvedValue(
      mockBunnyResponse({ success: true }, true, 200)
    )
    vi.stubGlobal('fetch', mockFetch)

    const req = new NextRequest('http://localhost:3000/api/admin/video/my-video-uid', {
      method: 'DELETE',
    })
    await DELETE(req, { params: Promise.resolve({ uid: 'my-video-uid' }) })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const fetchUrl = mockFetch.mock.calls[0][0]
    expect(fetchUrl).toContain('my-video-uid')
    expect(fetchUrl).toContain('test-library-id')
    expect(fetchUrl).toContain('video.bunnycdn.com')
  })

  it('returns 502 when Bunny.net API fails', async () => {
    adminAuthorized()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockBunnyResponse(
          { message: 'Video not found' },
          false,
          404
        )
      )
    )

    const req = new NextRequest('http://localhost:3000/api/admin/video/nonexistent-uid', {
      method: 'DELETE',
    })
    const res = await DELETE(req, { params: Promise.resolve({ uid: 'nonexistent-uid' }) })

    expect(res.status).toBe(502)
  })

  it('returns 500 when env vars are missing', async () => {
    adminAuthorized()
    delete process.env.BUNNY_STREAM_API_KEY

    const req = new NextRequest('http://localhost:3000/api/admin/video/test-uid', {
      method: 'DELETE',
    })
    const res = await DELETE(req, { params: Promise.resolve({ uid: 'test-uid' }) })

    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// Tests — GET /api/video/signed/[uid]
// ---------------------------------------------------------------------------

describe('GET /api/video/signed/[uid]', () => {
  let GET: (
    request: NextRequest,
    context: { params: Promise<{ uid: string }> }
  ) => Promise<Response>
  let savedEnv: Record<string, string | undefined>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    savedEnv = {
      BUNNY_STREAM_TOKEN_SECRET: process.env.BUNNY_STREAM_TOKEN_SECRET,
      BUNNY_STREAM_LIBRARY_ID: process.env.BUNNY_STREAM_LIBRARY_ID,
    }

    // Default: no signing keys (tests that need them will set them)
    delete process.env.BUNNY_STREAM_TOKEN_SECRET
    delete process.env.BUNNY_STREAM_LIBRARY_ID

    const mod = await import('@/app/api/video/signed/[uid]/route')
    GET = mod.GET
  })

  afterEach(() => {
    if (savedEnv.BUNNY_STREAM_TOKEN_SECRET !== undefined) {
      process.env.BUNNY_STREAM_TOKEN_SECRET = savedEnv.BUNNY_STREAM_TOKEN_SECRET
    } else {
      delete process.env.BUNNY_STREAM_TOKEN_SECRET
    }
    if (savedEnv.BUNNY_STREAM_LIBRARY_ID !== undefined) {
      process.env.BUNNY_STREAM_LIBRARY_ID = savedEnv.BUNNY_STREAM_LIBRARY_ID
    } else {
      delete process.env.BUNNY_STREAM_LIBRARY_ID
    }
  })

  it('returns 401 when user is not authenticated', async () => {
    mockSupabaseUnauthenticated()

    const req = new NextRequest('http://localhost:3000/api/video/signed/test-uid')
    const res = await GET(req, { params: Promise.resolve({ uid: 'test-uid' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns signed URL when signing keys are configured', async () => {
    mockSupabaseAuthenticated('user-abc')

    process.env.BUNNY_STREAM_TOKEN_SECRET = 'test-token-secret'
    process.env.BUNNY_STREAM_LIBRARY_ID = 'test-lib-id'

    mockGenerateSignedUrl.mockReturnValue(
      'https://iframe.mediadelivery.net/embed/test-lib-id/test-uid?token=abc123&expires=999'
    )

    const req = new NextRequest('http://localhost:3000/api/video/signed/test-uid')
    const res = await GET(req, { params: Promise.resolve({ uid: 'test-uid' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toContain('iframe.mediadelivery.net')
    expect(body.iframe).toContain('iframe.mediadelivery.net')
    // For Bunny.net, url and iframe are the same signed embed URL
    expect(body.url).toBe(body.iframe)
  })

  it('falls back to iframe URL when signing keys are not configured', async () => {
    mockSupabaseAuthenticated('user-abc')

    delete process.env.BUNNY_STREAM_TOKEN_SECRET
    delete process.env.BUNNY_STREAM_LIBRARY_ID

    mockGetIframeUrl.mockReturnValue(
      'https://iframe.mediadelivery.net/embed/dev/test-uid'
    )

    const req = new NextRequest('http://localhost:3000/api/video/signed/test-uid')
    const res = await GET(req, { params: Promise.resolve({ uid: 'test-uid' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('https://iframe.mediadelivery.net/embed/dev/test-uid')
    expect(body.iframe).toBe('https://iframe.mediadelivery.net/embed/dev/test-uid')
    expect(mockGenerateSignedUrl).not.toHaveBeenCalled()
  })

  it('calls generateSignedUrl with the correct video uid when signing keys exist', async () => {
    mockSupabaseAuthenticated()

    process.env.BUNNY_STREAM_TOKEN_SECRET = 'test-token-secret'
    process.env.BUNNY_STREAM_LIBRARY_ID = 'test-lib-id'

    mockGenerateSignedUrl.mockReturnValue('https://iframe.mediadelivery.net/embed/test-lib-id/my-vid?token=t&expires=e')

    const req = new NextRequest('http://localhost:3000/api/video/signed/my-vid')
    await GET(req, { params: Promise.resolve({ uid: 'my-vid' }) })

    expect(mockGenerateSignedUrl).toHaveBeenCalledWith('my-vid')
  })

  it('calls getIframeUrl with the correct video uid', async () => {
    mockSupabaseAuthenticated()

    delete process.env.BUNNY_STREAM_TOKEN_SECRET
    delete process.env.BUNNY_STREAM_LIBRARY_ID

    mockGetIframeUrl.mockReturnValue('https://iframe.mediadelivery.net/embed/dev/my-vid')

    const req = new NextRequest('http://localhost:3000/api/video/signed/my-vid')
    await GET(req, { params: Promise.resolve({ uid: 'my-vid' }) })

    expect(mockGetIframeUrl).toHaveBeenCalledWith('my-vid')
  })

  it('returns 500 when generateSignedUrl throws', async () => {
    mockSupabaseAuthenticated()

    process.env.BUNNY_STREAM_TOKEN_SECRET = 'test-token-secret'
    process.env.BUNNY_STREAM_LIBRARY_ID = 'test-lib-id'

    mockGenerateSignedUrl.mockImplementation(() => {
      throw new Error('Bunny.net Stream signing keys not configured')
    })

    const req = new NextRequest('http://localhost:3000/api/video/signed/test-uid')
    const res = await GET(req, { params: Promise.resolve({ uid: 'test-uid' }) })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('does not require admin role — any authenticated user is allowed', async () => {
    mockSupabaseAuthenticated('regular-employee-id')

    mockGenerateSignedUrl.mockReturnValue('https://iframe.mediadelivery.net/embed/lib/uid?token=t&expires=e')
    mockGetIframeUrl.mockReturnValue('https://iframe.mediadelivery.net/embed/dev/uid')

    const req = new NextRequest('http://localhost:3000/api/video/signed/test-uid')
    const res = await GET(req, { params: Promise.resolve({ uid: 'test-uid' }) })

    expect(res.status).toBe(200)
    // requireAdmin should NOT have been called for this route
    expect(mockRequireAdmin).not.toHaveBeenCalled()
  })
})
