/**
 * Helper to send replies back to Microsoft Teams via the Bot Framework REST API.
 *
 * Uses the Bot Framework v3 conversation API:
 *   POST {serviceUrl}/v3/conversations/{conversationId}/activities
 *
 * Server-side only. Never import in client components.
 */

import { getBotToken } from './auth'

interface TextContent {
  type: 'message'
  text: string
}

interface CardContent {
  type: 'card'
  card: object
}

/**
 * Send a reply to a Teams activity (message or card action).
 *
 * Handles errors gracefully — logs and does not throw, because the
 * Bot Framework webhook must always return 200 regardless of reply success.
 */
export async function replyToActivity(
  serviceUrl: string,
  conversationId: string,
  activityId: string | undefined,
  content: TextContent | CardContent
): Promise<void> {
  try {
    const token = await getBotToken()

    // Ensure serviceUrl ends without trailing slash
    const baseUrl = serviceUrl.replace(/\/+$/, '')
    const url = `${baseUrl}/v3/conversations/${conversationId}/activities`

    let body: Record<string, unknown>

    if (content.type === 'message') {
      body = {
        type: 'message',
        text: content.text,
        replyToId: activityId,
      }
    } else {
      body = {
        type: 'message',
        replyToId: activityId,
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: content.card,
          },
        ],
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `[Teams Bot] Failed to send reply (${response.status}): ${errorText}`
      )
    }
  } catch (error) {
    console.error(
      '[Teams Bot] Error sending reply:',
      error instanceof Error ? error.message : error
    )
  }
}
