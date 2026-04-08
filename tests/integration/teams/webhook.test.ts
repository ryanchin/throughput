import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies before importing the route
vi.mock('@/lib/teams/auth', () => ({
  validateBotToken: vi.fn(),
}))

vi.mock('@/lib/teams/bot-handler', () => ({
  handleMessage: vi.fn(),
  handleCardAction: vi.fn(),
  handleConversationUpdate: vi.fn(),
}))

vi.mock('@/lib/teams/reply', () => ({
  replyToActivity: vi.fn(),
}))

import { validateBotToken } from '@/lib/teams/auth'
import {
  handleMessage,
  handleCardAction,
  handleConversationUpdate,
} from '@/lib/teams/bot-handler'

const mockValidateBotToken = vi.mocked(validateBotToken)
const mockHandleMessage = vi.mocked(handleMessage)
const mockHandleCardAction = vi.mocked(handleCardAction)
const mockHandleConversationUpdate = vi.mocked(handleConversationUpdate)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createRequest(
  url: string,
  method: string,
  body?: unknown,
  headers?: Record<string, string>
): NextRequest {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new NextRequest(url, init)
}

function makeTextActivity(text: string) {
  return {
    type: 'message',
    text,
    from: { id: 'user-1', name: 'Jane Doe' },
    conversation: { id: 'conv-1', tenantId: 'tenant-1' },
    serviceUrl: 'https://smba.trafficmanager.net/teams/',
    channelId: 'msteams',
    id: 'activity-1',
  }
}

function makeCardActionActivity(value: Record<string, unknown>) {
  return {
    type: 'message',
    from: { id: 'user-1', name: 'Jane Doe' },
    conversation: { id: 'conv-1', tenantId: 'tenant-1' },
    serviceUrl: 'https://smba.trafficmanager.net/teams/',
    channelId: 'msteams',
    id: 'activity-2',
    value,
  }
}

function makeConversationUpdateActivity() {
  return {
    type: 'conversationUpdate',
    from: { id: 'bot-id', name: 'CRM Bot' },
    conversation: { id: 'conv-1', tenantId: 'tenant-1' },
    serviceUrl: 'https://smba.trafficmanager.net/teams/',
    channelId: 'msteams',
    id: 'activity-3',
  }
}

// ===========================================================================
// POST /api/teams/messages
// ===========================================================================

describe('POST /api/teams/messages', () => {
  let POST: (request: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    const mod = await import('@/app/api/teams/messages/route')
    POST = mod.POST

    // Re-acquire mocked references after resetModules
    const authMod = await import('@/lib/teams/auth')
    const handlerMod = await import('@/lib/teams/bot-handler')

    // Default: auth passes
    vi.mocked(authMod.validateBotToken).mockResolvedValue(true)
    vi.mocked(handlerMod.handleMessage).mockResolvedValue(undefined)
    vi.mocked(handlerMod.handleCardAction).mockResolvedValue(undefined)
    vi.mocked(handlerMod.handleConversationUpdate).mockResolvedValue(undefined)
  })

  // ── Status code tests ──────────────────────────────────────

  it('returns 200 for a valid text message activity', async () => {
    const req = createRequest(
      'http://localhost:3000/api/teams/messages',
      'POST',
      makeTextActivity('Log a call with Acme Corp'),
      { authorization: 'Bearer valid-token' }
    )
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  it('returns 200 for a card action activity', async () => {
    const req = createRequest(
      'http://localhost:3000/api/teams/messages',
      'POST',
      makeCardActionActivity({ type: 'confirm', actions: [] }),
      { authorization: 'Bearer valid-token' }
    )
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  it('returns 200 for conversationUpdate (bot installed)', async () => {
    const req = createRequest(
      'http://localhost:3000/api/teams/messages',
      'POST',
      makeConversationUpdateActivity(),
      { authorization: 'Bearer valid-token' }
    )
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  it('returns 200 for unknown activity types (ignored gracefully)', async () => {
    const req = createRequest(
      'http://localhost:3000/api/teams/messages',
      'POST',
      {
        type: 'typing',
        from: { id: 'user-1', name: 'Jane' },
        conversation: { id: 'conv-1' },
        serviceUrl: 'https://smba.trafficmanager.net/teams/',
        channelId: 'msteams',
        id: 'activity-4',
      },
      { authorization: 'Bearer valid-token' }
    )
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  it('returns 200 when token validation fails (Bot Framework requirement)', async () => {
    // Auth fails — still returns 200 per Bot Framework contract
    const authMod = await import('@/lib/teams/auth')
    vi.mocked(authMod.validateBotToken).mockResolvedValue(false)

    const req = createRequest(
      'http://localhost:3000/api/teams/messages',
      'POST',
      makeTextActivity('should not be processed'),
      { authorization: 'Bearer invalid-token' }
    )
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('unauthorized')
  })

  // ── Handler dispatch tests ─────────────────────────────────

  it('calls handleMessage for text messages', async () => {
    const handlerMod = await import('@/lib/teams/bot-handler')
    const activity = makeTextActivity('Log a meeting with BigCo')

    const req = createRequest(
      'http://localhost:3000/api/teams/messages',
      'POST',
      activity,
      { authorization: 'Bearer valid-token' }
    )
    await POST(req)

    expect(vi.mocked(handlerMod.handleMessage)).toHaveBeenCalledOnce()
    const callArg = vi.mocked(handlerMod.handleMessage).mock.calls[0][0]
    expect(callArg.type).toBe('message')
    expect(callArg.text).toBe('Log a meeting with BigCo')
  })

  it('calls handleCardAction for card submissions', async () => {
    const handlerMod = await import('@/lib/teams/bot-handler')
    const cardValue = { type: 'confirm', actions: [{ action: 'create_activity' }] }

    const req = createRequest(
      'http://localhost:3000/api/teams/messages',
      'POST',
      makeCardActionActivity(cardValue),
      { authorization: 'Bearer valid-token' }
    )
    await POST(req)

    expect(vi.mocked(handlerMod.handleCardAction)).toHaveBeenCalledOnce()
    const callArg = vi.mocked(handlerMod.handleCardAction).mock.calls[0][0]
    expect(callArg.type).toBe('message')
    expect(callArg.value).toEqual(cardValue)
  })

  it('returns 200 even when handler throws (Bot Framework requirement)', async () => {
    const handlerMod = await import('@/lib/teams/bot-handler')
    vi.mocked(handlerMod.handleMessage).mockRejectedValue(new Error('Database connection failed'))

    const req = createRequest(
      'http://localhost:3000/api/teams/messages',
      'POST',
      makeTextActivity('this will fail'),
      { authorization: 'Bearer valid-token' }
    )
    const res = await POST(req)

    // Must still return 200 — Bot Framework retries on non-200
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('error')
  })
})
