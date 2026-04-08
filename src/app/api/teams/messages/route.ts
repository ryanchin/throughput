/**
 * POST /api/teams/messages
 *
 * Bot Framework webhook endpoint. Azure Bot Service relays all Teams
 * messages and card actions to this URL.
 *
 * IMPORTANT: This endpoint must ALWAYS return 200, even on errors.
 * Errors are communicated back to the user as reply messages, not
 * HTTP error codes. The Bot Framework treats non-200 responses as
 * delivery failures and will retry, causing duplicate processing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateBotToken } from '@/lib/teams/auth'
import {
  handleMessage,
  handleCardAction,
  handleConversationUpdate,
  type TeamsActivity,
} from '@/lib/teams/bot-handler'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate the incoming token from Bot Framework
    const authHeader = request.headers.get('authorization')
    const isValid = await validateBotToken(authHeader)

    if (!isValid) {
      // Still return 200 to avoid retries, but don't process
      console.warn('[Teams Bot] Invalid or missing auth token')
      return NextResponse.json({ status: 'unauthorized' }, { status: 200 })
    }

    // Parse the activity
    let activity: TeamsActivity
    try {
      activity = (await request.json()) as TeamsActivity
    } catch {
      console.error('[Teams Bot] Failed to parse request body')
      return NextResponse.json({ status: 'bad_request' }, { status: 200 })
    }

    // Route based on activity type
    switch (activity.type) {
      case 'message': {
        if (activity.value && typeof activity.value === 'object') {
          // Card action submission (user clicked a button on an Adaptive Card)
          await handleCardAction(activity)
        } else {
          // Regular text message
          await handleMessage(activity)
        }
        break
      }

      case 'conversationUpdate': {
        // Bot installed or user added to conversation
        await handleConversationUpdate(activity)
        break
      }

      case 'invoke': {
        // Some card actions come as invoke activities in Teams
        if (activity.value && typeof activity.value === 'object') {
          await handleCardAction(activity)
        }
        break
      }

      default: {
        // Ignore other activity types (typing, messageReaction, etc.)
        // Still return 200 so Bot Framework doesn't retry
        break
      }
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 })
  } catch (error) {
    // Catch-all: log but always return 200
    console.error(
      '[Teams Bot] Unhandled error:',
      error instanceof Error ? error.message : error
    )
    return NextResponse.json({ status: 'error' }, { status: 200 })
  }
}
