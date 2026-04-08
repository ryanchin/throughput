import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { callOpenRouter } from '@/lib/openrouter/client'

/**
 * POST /api/admin/crm/ai/suggest-tasks
 * AI-powered follow-up task suggestions based on a recently logged activity.
 * Returns 2-3 suggested tasks with subject, due_days, and priority.
 * On failure, returns empty suggestions (non-blocking feature).
 */
export async function POST(request: NextRequest) {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { activity_id } = body as { activity_id?: string }
  if (!activity_id) {
    return NextResponse.json({ error: 'activity_id is required' }, { status: 400 })
  }

  // Fetch the activity with company and opportunity joins
  const { data: activity, error: fetchError } = await supabase
    .from('crm_activities')
    .select('*, crm_companies(id, name), crm_opportunities(id, title, stage, value)')
    .eq('id', activity_id)
    .single()

  if (fetchError || !activity) {
    return NextResponse.json({ suggestions: [] })
  }

  const act = activity as Record<string, unknown>
  const company = act.crm_companies as { name: string } | null
  const opportunity = act.crm_opportunities as { title: string; stage: string; value: number } | null

  try {
    const prompt = `Given this sales activity and context, suggest 2-3 concrete follow-up tasks.

Activity: ${act.type} - ${act.subject}${act.description ? ` - ${act.description}` : ''}
${company ? `Company: ${company.name}` : ''}
${opportunity ? `Deal: ${opportunity.title} (stage: ${opportunity.stage}, value: ${opportunity.value})` : ''}

Return ONLY a JSON array: [{ "subject": "task name", "due_days": 3, "priority": 1 }]
where priority 1=high, 2=normal and due_days is days from now.`

    const result = await callOpenRouter(
      [
        { role: 'system', content: 'You are an experienced sales coach providing actionable follow-up tasks.' },
        { role: 'user', content: prompt },
      ],
      {
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 512,
      }
    )

    let suggestions: { subject: string; due_days: number; priority: number }[]
    try {
      const parsed = JSON.parse(result)
      if (Array.isArray(parsed)) {
        suggestions = parsed
      } else if (Array.isArray(parsed.suggestions)) {
        suggestions = parsed.suggestions
      } else if (Array.isArray(parsed.tasks)) {
        suggestions = parsed.tasks
      } else {
        suggestions = []
      }
    } catch {
      suggestions = []
    }

    return NextResponse.json({ suggestions })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[CRM AI Suggest Tasks] Error:', message)
    return NextResponse.json({ suggestions: [] })
  }
}
