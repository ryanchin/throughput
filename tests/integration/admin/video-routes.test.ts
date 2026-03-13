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

function mockCloudflareResponse(body: unknown, ok = true, status = 200) {
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
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
      CLOUDFLARE_STREAM_API_TOKEN: process.env.CLOUDFLARE_STREAM_API_TOKEN,
    }

    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id'
    process.env.CLOUDFLARE_STREAM_API_TOKEN = 'test-stream-token'

    const mod = await import('@/app/api/admin/video/upload-url/route')
    POST = mod.POST
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.CLOUDFLARE_ACCOUNT_ID = savedEnv.CLOUDFLARE_ACCOUNT_ID
    process.env.CLOUDFLARE_STREAM_API_TOKEN = savedEnv.CLOUDFLARE_STREAM_API_TOKEN
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

  it('returns upload URL and uid on successful Cloudflare response', async () => {
    adminAuthorized()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockCloudflareResponse({
          success: true,
          result: {
            uid: 'cf-video-uid-123',
            uploadURL: 'https://upload.cloudflarestream.com/tus/abc123',
          },
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
    expect(body.uploadUrl).toBeDefined()
    expect(body.uid).toBe('cf-video-uid-123')
  })

  it('passes maxDurationSeconds to Cloudflare when provided', async () => {
    adminAuthorized()

    const mockFetch = vi.fn().mockResolvedValue(
      mockCloudflareResponse({
        success: true,
        result: {
          uid: 'cf-video-uid-456',
          uploadURL: 'https://upload.cloudflarestream.com/tus/def456',
        },
      })
    )
    vi.stubGlobal('fetch', mockFetch)

    const req = new NextRequest('http://localhost:3000/api/admin/video/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxDurationSeconds: 3600 }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.uid).toBe('cf-video-uid-456')

    // Verify the Cloudflare API was called
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const fetchCall = mockFetch.mock.calls[0]
    expect(fetchCall[0]).toContain('test-account-id')
  })

  it('returns 400 when body has invalid maxDurationSeconds', async () => {
    adminAuthorized()

    const req = new NextRequest('http://localhost:3000/api/admin/video/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxDurationSeconds: -1 }),
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('returns 502 when Cloudflare API fails', async () => {
    adminAuthorized()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockCloudflareResponse(
          { success: false, errors: [{ message: 'Internal error' }] },
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

  it('returns 500 when CLOUDFLARE_ACCOUNT_ID is not set', async () => {
    adminAuthorized()
    delete process.env.CLOUDFLARE_ACCOUNT_ID

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

  it('returns 500 when CLOUDFLARE_STREAM_API_TOKEN is not set', async () => {
    adminAuthorized()
    delete process.env.CLOUDFLARE_STREAM_API_TOKEN

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

  it('returns 502 when fetch to Cloudflare throws a network error', async () => {
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
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
      CLOUDFLARE_STREAM_API_TOKEN: process.env.CLOUDFLARE_STREAM_API_TOKEN,
    }

    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id'
    process.env.CLOUDFLARE_STREAM_API_TOKEN = 'test-stream-token'

    const mod = await import('@/app/api/admin/video/status/[uid]/route')
    GET = mod.GET
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.CLOUDFLARE_ACCOUNT_ID = savedEnv.CLOUDFLARE_ACCOUNT_ID
    process.env.CLOUDFLARE_STREAM_API_TOKEN = savedEnv.CLOUDFLARE_STREAM_API_TOKEN
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

  it('returns video status on successful Cloudflare response', async () => {
    adminAuthorized()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockCloudflareResponse({
          success: true,
          result: {
            uid: 'test-uid',
            status: { state: 'ready' },
            duration: 120.5,
            thumbnail: 'https://cloudflarestream.com/test-uid/thumbnails/thumbnail.jpg',
            readyToStream: true,
          },
        })
      )
    )

    const req = new NextRequest('http://localhost:3000/api/admin/video/status/test-uid')
    const res = await GET(req, { params: Promise.resolve({ uid: 'test-uid' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBeDefined()
    expect(body.duration).toBe(120.5)
    expect(body.thumbnail).toBeDefined()
    expect(body.readyToStream).toBe(true)
  })

  it('returns correct shape for in-progress video', async () => {
    adminAuthorized()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockCloudflareResponse({
          success: true,
          result: {
            uid: 'processing-uid',
            status: { state: 'inprogress' },
            duration: 0,
            thumbnail: '',
            readyToStream: false,
          },
        })
      )
    )

    const req = new NextRequest('http://localhost:3000/api/admin/video/status/processing-uid')
    const res = await GET(req, { params: Promise.resolve({ uid: 'processing-uid' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.readyToStream).toBe(false)
  })

  it('returns 502 when Cloudflare API fails', async () => {
    adminAuthorized()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockCloudflareResponse(
          { success: false, errors: [{ message: 'Not found' }] },
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
    delete process.env.CLOUDFLARE_ACCOUNT_ID

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
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
      CLOUDFLARE_STREAM_API_TOKEN: process.env.CLOUDFLARE_STREAM_API_TOKEN,
    }

    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id'
    process.env.CLOUDFLARE_STREAM_API_TOKEN = 'test-stream-token'

    const mod = await import('@/app/api/admin/video/[uid]/route')
    DELETE = mod.DELETE
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.CLOUDFLARE_ACCOUNT_ID = savedEnv.CLOUDFLARE_ACCOUNT_ID
    process.env.CLOUDFLARE_STREAM_API_TOKEN = savedEnv.CLOUDFLARE_STREAM_API_TOKEN
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
        mockCloudflareResponse({ success: true, result: null }, true, 200)
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

  it('calls Cloudflare DELETE API with correct uid', async () => {
    adminAuthorized()

    const mockFetch = vi.fn().mockResolvedValue(
      mockCloudflareResponse({ success: true, result: null }, true, 200)
    )
    vi.stubGlobal('fetch', mockFetch)

    const req = new NextRequest('http://localhost:3000/api/admin/video/my-video-uid', {
      method: 'DELETE',
    })
    await DELETE(req, { params: Promise.resolve({ uid: 'my-video-uid' }) })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const fetchUrl = mockFetch.mock.calls[0][0]
    expect(fetchUrl).toContain('my-video-uid')
    expect(fetchUrl).toContain('test-account-id')
  })

  it('returns 502 when Cloudflare API fails', async () => {
    adminAuthorized()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockCloudflareResponse(
          { success: false, errors: [{ message: 'Video not found' }] },
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
    delete process.env.CLOUDFLARE_ACCOUNT_ID

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
      CLOUDFLARE_STREAM_SIGNING_KEY: process.env.CLOUDFLARE_STREAM_SIGNING_KEY,
      CLOUDFLARE_STREAM_KEY_ID: process.env.CLOUDFLARE_STREAM_KEY_ID,
    }

    // Default: no signing keys (tests that need them will set them)
    delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY
    delete process.env.CLOUDFLARE_STREAM_KEY_ID

    const mod = await import('@/app/api/video/signed/[uid]/route')
    GET = mod.GET
  })

  afterEach(() => {
    if (savedEnv.CLOUDFLARE_STREAM_SIGNING_KEY !== undefined) {
      process.env.CLOUDFLARE_STREAM_SIGNING_KEY = savedEnv.CLOUDFLARE_STREAM_SIGNING_KEY
    } else {
      delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY
    }
    if (savedEnv.CLOUDFLARE_STREAM_KEY_ID !== undefined) {
      process.env.CLOUDFLARE_STREAM_KEY_ID = savedEnv.CLOUDFLARE_STREAM_KEY_ID
    } else {
      delete process.env.CLOUDFLARE_STREAM_KEY_ID
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

  it('returns signed URL and iframe URL when signing keys are configured', async () => {
    mockSupabaseAuthenticated('user-abc')

    process.env.CLOUDFLARE_STREAM_SIGNING_KEY = 'test-signing-key'
    process.env.CLOUDFLARE_STREAM_KEY_ID = 'test-key-id'

    mockGenerateSignedUrl.mockReturnValue(
      'https://cloudflarestream.com/signed-token/manifest/video.m3u8'
    )
    mockGetIframeUrl.mockReturnValue(
      'https://customer-test.cloudflarestream.com/test-uid/iframe'
    )

    const req = new NextRequest('http://localhost:3000/api/video/signed/test-uid')
    const res = await GET(req, { params: Promise.resolve({ uid: 'test-uid' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('https://cloudflarestream.com/signed-token/manifest/video.m3u8')
    expect(body.iframe).toBe('https://customer-test.cloudflarestream.com/test-uid/iframe')
  })

  it('falls back to iframe URL when signing keys are not configured', async () => {
    mockSupabaseAuthenticated('user-abc')

    delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY
    delete process.env.CLOUDFLARE_STREAM_KEY_ID

    mockGetIframeUrl.mockReturnValue(
      'https://customer-test.cloudflarestream.com/test-uid/iframe'
    )

    const req = new NextRequest('http://localhost:3000/api/video/signed/test-uid')
    const res = await GET(req, { params: Promise.resolve({ uid: 'test-uid' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    // Without signing keys, url falls back to getIframeUrl
    expect(body.url).toBe('https://customer-test.cloudflarestream.com/test-uid/iframe')
    expect(body.iframe).toBe('https://customer-test.cloudflarestream.com/test-uid/iframe')
    expect(mockGenerateSignedUrl).not.toHaveBeenCalled()
  })

  it('calls generateSignedUrl with the correct video uid when signing keys exist', async () => {
    mockSupabaseAuthenticated()

    process.env.CLOUDFLARE_STREAM_SIGNING_KEY = 'test-signing-key'
    process.env.CLOUDFLARE_STREAM_KEY_ID = 'test-key-id'

    mockGenerateSignedUrl.mockReturnValue('https://cloudflarestream.com/token/manifest/video.m3u8')
    mockGetIframeUrl.mockReturnValue('https://customer-test.cloudflarestream.com/my-vid/iframe')

    const req = new NextRequest('http://localhost:3000/api/video/signed/my-vid')
    await GET(req, { params: Promise.resolve({ uid: 'my-vid' }) })

    expect(mockGenerateSignedUrl).toHaveBeenCalledWith('my-vid')
  })

  it('calls getIframeUrl with the correct video uid', async () => {
    mockSupabaseAuthenticated()

    delete process.env.CLOUDFLARE_STREAM_SIGNING_KEY
    delete process.env.CLOUDFLARE_STREAM_KEY_ID

    mockGetIframeUrl.mockReturnValue('https://customer-test.cloudflarestream.com/my-vid/iframe')

    const req = new NextRequest('http://localhost:3000/api/video/signed/my-vid')
    await GET(req, { params: Promise.resolve({ uid: 'my-vid' }) })

    expect(mockGetIframeUrl).toHaveBeenCalledWith('my-vid')
  })

  it('returns 500 when generateSignedUrl throws', async () => {
    mockSupabaseAuthenticated()

    process.env.CLOUDFLARE_STREAM_SIGNING_KEY = 'test-signing-key'
    process.env.CLOUDFLARE_STREAM_KEY_ID = 'test-key-id'

    mockGenerateSignedUrl.mockImplementation(() => {
      throw new Error('Cloudflare Stream signing keys not configured')
    })

    const req = new NextRequest('http://localhost:3000/api/video/signed/test-uid')
    const res = await GET(req, { params: Promise.resolve({ uid: 'test-uid' }) })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('does not require admin role — any authenticated user is allowed', async () => {
    mockSupabaseAuthenticated('regular-employee-id')

    mockGenerateSignedUrl.mockReturnValue('https://cloudflarestream.com/token/manifest/video.m3u8')
    mockGetIframeUrl.mockReturnValue('https://customer-test.cloudflarestream.com/uid/iframe')

    const req = new NextRequest('http://localhost:3000/api/video/signed/test-uid')
    const res = await GET(req, { params: Promise.resolve({ uid: 'test-uid' }) })

    expect(res.status).toBe(200)
    // requireAdmin should NOT have been called for this route
    expect(mockRequireAdmin).not.toHaveBeenCalled()
  })
})
