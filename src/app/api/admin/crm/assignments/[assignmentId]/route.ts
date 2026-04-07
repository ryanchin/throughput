import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { assignmentUpdateSchema } from '@/lib/crm/schemas'

interface RouteParams {
  params: Promise<{ assignmentId: string }>
}

/**
 * GET /api/admin/crm/assignments/[assignmentId]
 * Returns a single assignment with consultant and account info.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { assignmentId } = await params
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { data: assignment, error } = await supabase
    .from('crm_assignments')
    .select('*, crm_consultants!inner(id, profiles!inner(id, full_name)), crm_companies!inner(id, name), crm_opportunities(id, title)')
    .eq('id', assignmentId)
    .single()

  if (error || !assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
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
  })
}

/**
 * PATCH /api/admin/crm/assignments/[assignmentId]
 * Updates assignment fields.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { assignmentId } = await params
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

  const parsed = assignmentUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) update[key] = value
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: assignment, error } = await supabase
    .from('crm_assignments')
    .update(update)
    .eq('id', assignmentId)
    .select('*, crm_consultants!inner(id, profiles!inner(id, full_name)), crm_companies!inner(id, name), crm_opportunities(id, title)')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 })
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
  })
}
