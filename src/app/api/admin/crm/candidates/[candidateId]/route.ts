import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { candidateUpdateSchema } from '@/lib/crm/schemas'

interface RouteParams {
  params: Promise<{ candidateId: string }>
}

/**
 * GET /api/admin/crm/candidates/[candidateId]
 * Returns a single candidate with target account and role info.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { candidateId } = await params
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { data: candidate, error } = await supabase
    .from('crm_candidates')
    .select('*, crm_companies(id, name), crm_roles(id, name)')
    .eq('id', candidateId)
    .single()

  if (error || !candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  }

  const { crm_companies, crm_roles, ...rest } = candidate as Record<string, unknown>
  return NextResponse.json({
    candidate: {
      ...rest,
      target_account: crm_companies ?? null,
      target_role: crm_roles ?? null,
    },
  })
}

/**
 * PATCH /api/admin/crm/candidates/[candidateId]
 * Updates candidate fields.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { candidateId } = await params
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

  const parsed = candidateUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) update[key] = value === '' ? null : value
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: candidate, error } = await supabase
    .from('crm_candidates')
    .update(update)
    .eq('id', candidateId)
    .select('*, crm_companies(id, name), crm_roles(id, name)')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update candidate' }, { status: 500 })
  }

  const { crm_companies, crm_roles, ...rest } = candidate as Record<string, unknown>
  return NextResponse.json({
    candidate: { ...rest, target_account: crm_companies ?? null, target_role: crm_roles ?? null },
  })
}
