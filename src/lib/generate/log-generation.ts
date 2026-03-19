import 'server-only'

import { createServiceClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/database.types'

/**
 * Log an AI generation to the generation_logs table.
 * Non-blocking — failures are logged but never prevent the generation from succeeding.
 */
export async function logGeneration(params: {
  adminId: string
  generationType: 'course' | 'lesson' | 'certification'
  inputs: Record<string, unknown>
  outputSummary?: string
  model?: string
  tokensUsed?: number
  durationMs?: number
  status?: 'success' | 'error'
  errorMessage?: string
}): Promise<void> {
  try {
    const serviceClient = createServiceClient()
    await serviceClient.from('generation_logs').insert({
      admin_id: params.adminId,
      generation_type: params.generationType,
      inputs: params.inputs as Json,
      output_summary: params.outputSummary ?? null,
      model: params.model ?? 'openai/gpt-oss-120b',
      tokens_used: params.tokensUsed ?? null,
      duration_ms: params.durationMs ?? null,
      status: params.status ?? 'success',
      error_message: params.errorMessage ?? null,
    })
  } catch (err) {
    // Non-blocking: log error but don't throw
    console.error('[generation_logs] Failed to log generation:', err)
  }
}
