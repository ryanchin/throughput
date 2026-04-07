import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { suggestActionsRequestSchema } from '@/lib/crm/schemas'
import { buildNextActionPrompt } from '@/lib/crm/ai-prompts'
import { callOpenRouter } from '@/lib/openrouter/client'

/**
 * POST /api/admin/crm/ai/suggest-actions
 * AI-powered next action suggestions based on a recently logged activity.
 * Returns 2-3 suggested actions with priority levels.
 * On failure, returns empty suggestions (this is an optional/non-critical feature).
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = suggestActionsRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const data = parsed.data

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const prompt = buildNextActionPrompt({
      activityType: data.activity_type,
      subject: data.subject,
      description: data.description,
      companyName: data.company_name,
      stage: data.stage,
      value: data.value,
      daysInStage: data.days_in_stage,
    })

    const result = await callOpenRouter(
      [
        { role: 'system', content: 'You are an experienced sales coach providing actionable next steps.' },
        { role: 'user', content: prompt },
      ],
      {
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 512,
      }
    )

    clearTimeout(timeout)

    let suggestions: { action: string; priority: string }[]
    try {
      const parsed = JSON.parse(result)
      if (Array.isArray(parsed)) {
        suggestions = parsed
      } else if (Array.isArray(parsed.suggestions)) {
        suggestions = parsed.suggestions
      } else {
        suggestions = []
      }
    } catch {
      // Non-critical: return empty suggestions on parse failure
      suggestions = []
    }

    return NextResponse.json({ suggestions })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[CRM AI Suggest Actions] Error:', message)
    // Non-critical feature: return empty suggestions instead of erroring
    return NextResponse.json({ suggestions: [] })
  }
}
