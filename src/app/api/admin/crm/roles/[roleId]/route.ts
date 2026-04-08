import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { z } from 'zod'
import { ROLE_STATUSES, ROLE_FUNCTIONS, ROLE_STAGES } from '@/lib/crm/constants'

interface RouteParams {
  params: Promise<{ roleId: string }>
}

const roleUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  function: z.enum(ROLE_FUNCTIONS).optional().nullable(),
  priority: z.number().int().min(1).max(2).optional().nullable(),
  status: z.enum(ROLE_STATUSES).optional(),
  role_stage: z.enum(ROLE_STAGES).optional().nullable(),
  target_fill_date: z.string().optional().nullable(),
  description: z.string().max(10000).optional().nullable(),
  next_step: z.string().max(1000).optional().nullable(),
  next_step_due: z.string().optional().nullable(),
  blocker: z.string().max(1000).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
})

/**
 * GET /api/admin/crm/roles/[roleId]
 * Returns role detail with account, deal, and candidates being considered for this role.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { roleId } = await params
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { data: role, error } = await supabase
    .from('crm_roles')
    .select('*, crm_companies(id, name), crm_opportunities(id, title)')
    .eq('id', roleId)
    .single()

  if (error || !role) {
    return NextResponse.json({ error: 'Role not found' }, { status: 404 })
  }

  // Fetch candidates assigned to this role
  const { data: candidates } = await supabase
    .from('crm_candidates')
    .select('id, first_name, last_name, function, seniority, skills, status, source, date_added, promoted_to_consultant_id')
    .eq('target_role_id', roleId)
    .order('date_added', { ascending: false })

  // Fetch bench consultants matching this role's function (for matching suggestions)
  let matchingBench: unknown[] = []
  if (role.function) {
    const { data: bench } = await supabase
      .from('crm_consultants')
      .select('id, function, seniority, skills, profiles!inner(id, full_name)')
      .eq('status', 'Active - Bench')
      .eq('function', role.function as unknown as import('@/lib/supabase/database.types').ConsultantFunction)

    matchingBench = (bench ?? []).map((c) => {
      const { profiles, ...rest } = c as Record<string, unknown>
      return { ...rest, user: profiles }
    })
  }

  const { crm_companies, crm_opportunities, ...rest } = role as Record<string, unknown>
  return NextResponse.json({
    role: {
      ...rest,
      account: crm_companies ?? null,
      deal: crm_opportunities ?? null,
      candidates: candidates ?? [],
      matching_bench: matchingBench,
    },
  })
}

/**
 * PATCH /api/admin/crm/roles/[roleId]
 * Updates role fields. If status changes to 'Filled', records the staffing.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { roleId } = await params
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

  const parsed = roleUpdateSchema.safeParse(body)
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

  const { data: role, error } = await supabase
    .from('crm_roles')
    .update(update)
    .eq('id', roleId)
    .select('*, crm_companies(id, name), crm_opportunities(id, title)')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }

  const { crm_companies, crm_opportunities, ...rest } = role as Record<string, unknown>
  return NextResponse.json({
    role: { ...rest, account: crm_companies ?? null, deal: crm_opportunities ?? null },
  })
}
