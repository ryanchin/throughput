import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { assignmentCreateSchema, assignmentSearchSchema } from '@/lib/crm/schemas'

/**
 * GET /api/admin/crm/assignments
 * Lists assignments, filterable by consultant_id, account_id, status.
 * Includes consultant name and account name via joins.
 */
export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = assignmentSearchSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { consultant_id, account_id, status, limit, offset } = parsed.data

  let query = supabase
    .from('crm_assignments')
    .select('*, crm_consultants!inner(id, profiles!inner(id, full_name)), crm_companies!inner(id, name), crm_opportunities(id, title)', { count: 'exact' })
    .order('start_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (consultant_id) query = query.eq('consultant_id', consultant_id)
  if (account_id) query = query.eq('account_id', account_id)
  if (status) query = query.eq('status', status)

  const { data: assignments, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
  }

  const shaped = (assignments ?? []).map((a) => {
    const { crm_consultants, crm_companies, crm_opportunities, ...rest } = a as Record<string, unknown>
    const consultant = crm_consultants as { profiles: unknown; [key: string]: unknown }
    const { profiles, ...consultantRest } = consultant
    return {
      ...rest,
      consultant: { ...consultantRest, user: profiles },
      account: crm_companies,
      deal: crm_opportunities ?? null,
    }
  })

  return NextResponse.json({ assignments: shaped, total: count })
}

/**
 * POST /api/admin/crm/assignments
 * Creates a new assignment.
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

  const parsed = assignmentCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const data = parsed.data

  const { data: assignment, error } = await supabase
    .from('crm_assignments')
    .insert({
      consultant_id: data.consultant_id,
      account_id: data.account_id,
      deal_id: data.deal_id ?? null,
      role_id: data.role_id ?? null,
      start_date: data.start_date,
      expected_end_date: data.expected_end_date ?? null,
      actual_end_date: data.actual_end_date ?? null,
      bill_rate: data.bill_rate ?? null,
      status: data.status,
      end_reason: data.end_reason ?? null,
      notes: data.notes ?? null,
    })
    .select('*, crm_consultants!inner(id, profiles!inner(id, full_name)), crm_companies!inner(id, name), crm_opportunities(id, title)')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
  }

  const { crm_consultants, crm_companies, crm_opportunities, ...rest } = assignment as Record<string, unknown>
  const consultant = crm_consultants as { profiles: unknown; [key: string]: unknown }
  const { profiles, ...consultantRest } = consultant
  return NextResponse.json({
    assignment: {
      ...rest,
      consultant: { ...consultantRest, user: profiles },
      account: crm_companies,
      deal: crm_opportunities ?? null,
    },
  }, { status: 201 })
}
