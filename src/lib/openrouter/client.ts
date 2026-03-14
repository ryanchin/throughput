/**
 * OpenRouter API client.
 *
 * Uses the OpenAI-compatible chat completions endpoint.
 * Server-side only — never import this in client components.
 */

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenRouterOptions {
  model?: string
  temperature?: number
  max_tokens?: number
  response_format?: { type: 'json_object' }
}

/**
 * Call the OpenRouter API with the given messages.
 *
 * @param messages - Chat messages (system, user, assistant)
 * @param options  - Model, temperature, max_tokens, response_format
 * @returns The assistant's response content as a string
 * @throws Error if the API key is missing or the request fails
 */
export async function callOpenRouter(
  messages: OpenRouterMessage[],
  options: OpenRouterOptions = {}
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  const model = options.model ?? 'openai/gpt-oss-120b'

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'https://throughput.aava.ai',
      'X-Title': 'Throughput - AAVA Product Studio Training Platform',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.max_tokens ?? 1024,
      ...(options.response_format ? { response_format: options.response_format } : {}),
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter API error (${response.status}): ${error}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content ?? ''
}
