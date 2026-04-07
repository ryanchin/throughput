import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { consultantUpdateSchema } from '@/lib/crm/schemas'

interface RouteParams {
  params: Promise<{ consultantId: string }>
}

/**
 * GET /api/admin/crm/consultants/[consultantId]
 * Returns consultant detail with user info, current assignment, and full assignment history.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { consultantId } = await params
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { data: consultant, error } = await supabase
    .from('crm_consultants')
    .select('*, profiles!inner(id, full_name, email), crm_companies(id, name)')
    .eq('id', consultantId)
    .single()

  if (error || !consultant) {
    return NextResponse.json({ error: 'Consultant not found' }, { status: 404 })
  }

  // Fetch assignment history
  const { data: assignments } = await supabase
    .from('crm_assignments')
    .select('*, crm_companies(id, name), crm_opportunities(id, title)')
    .eq('consultant_id', consultantId)
    .order('start_date', { ascending: false })

  const shapedAssignments = (assignments ?? []).map((a) => {
    const { crm_companies, crm_opportunities, ...rest } = a as Record<string, unknown>
    return { ...rest, account: crm_companies, deal: crm_opportunities }
  }) as (Record<string, unknown> & { status: string; account: unknown; deal: unknown })[]

  const currentAssignment = shapedAssignments.find((a) => a.status === 'Active') ?? null

  const { profiles, crm_companies, ...rest } = consultant as Record<string, unknown>
  return NextResponse.json({
    consultant: {
      ...rest,
      user: profiles,
      account: crm_companies ?? null,
      current_assignment: currentAssignment,
      assignments: shapedAssignments,
    },
  })
}

/**
 * PATCH /api/admin/crm/consultants/[consultantId]
 * Updates consultant fields.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { consultantId } = await params
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

  const parsed = consultantUpdateSchema.safeParse(body)
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

  const { data: consultant, error } = await supabase
    .from('crm_consultants')
    .update(update)
    .eq('id', consultantId)
    .select('*, profiles!inner(id, full_name, email), crm_companies(id, name)')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Consultant not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update consultant' }, { status: 500 })
  }

  const { profiles, crm_companies, ...rest } = consultant as Record<string, unknown>
  return NextResponse.json({
    consultant: { ...rest, user: profiles, account: crm_companies ?? null },
  })
}
