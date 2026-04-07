import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { activityCreateSchema } from '@/lib/crm/schemas'

/**
 * GET /api/admin/crm/activities
 * Lists activities with optional filters for company_id, type, and date range.
 * Supports pagination via offset/limit (default limit 50).
 * Includes the related company name via join.
 */
export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { searchParams } = request.nextUrl
  const companyId = searchParams.get('company_id')
  const type = searchParams.get('type')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1), 100)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)

  let query = supabase
    .from('crm_activities')
    .select('*, crm_companies(name)', { count: 'exact' })
    .order('activity_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  if (type) {
    query = query.eq('type', type)
  }

  if (from) {
    query = query.gte('activity_date', from)
  }

  if (to) {
    query = query.lte('activity_date', to)
  }

  const { data: activities, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }

  return NextResponse.json({ activities, total: count })
}

/**
 * POST /api/admin/crm/activities
 * Creates a new activity. Non-task activities are auto-completed.
 * Task activities default to completed=false unless explicitly set.
 * Cleans empty strings (contact_id, opportunity_id, description) to null.
 */
export async function POST(request: NextRequest) {
  const { error: authError, supabase, profile } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = activityCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const data = parsed.data

  // Auto-set completed based on type
  let completed: boolean
  if (data.completed !== undefined) {
    completed = data.completed
  } else if (data.type !== 'task') {
    completed = true
  } else {
    completed = false
  }

  // Clean empty strings to null
  const contactId = data.contact_id === '' ? null : (data.contact_id ?? null)
  const opportunityId = data.opportunity_id === '' ? null : (data.opportunity_id ?? null)
  const description = data.description === '' ? null : (data.description ?? null)

  const { data: activity, error } = await supabase
    .from('crm_activities')
    .insert({
      company_id: data.company_id,
      contact_id: contactId,
      opportunity_id: opportunityId,
      type: data.type,
      subject: data.subject,
      description,
      activity_date: data.activity_date ?? new Date().toISOString(),
      completed,
      created_by: profile!.id,
    })
    .select('*, crm_companies(name)')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 })
  }

  return NextResponse.json({ activity }, { status: 201 })
}
