import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { z } from 'zod'
import { ROLE_FUNCTIONS, ROLE_STATUSES } from '@/lib/crm/constants'

const roleCreateSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(255),
  account_id: z.string().uuid().optional().nullable(),
  deal_id: z.string().uuid().optional().nullable(),
  function: z.enum(ROLE_FUNCTIONS).optional().nullable(),
  status: z.enum(ROLE_STATUSES).default('Open'),
  target_fill_date: z.string().optional().nullable(),
  description: z.string().max(10000).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
})

const bulkRoleCreateSchema = z.object({
  roles: z.array(roleCreateSchema).min(1).max(20),
})

/**
 * GET /api/admin/crm/roles
 * Lists roles with optional filters.
 */
export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')
  const accountId = searchParams.get('account_id')

  let query = supabase
    .from('crm_roles')
    .select('*, crm_companies(id, name), crm_opportunities(id, title)', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (accountId) query = query.eq('account_id', accountId)

  const { data: roles, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 })
  }

  const shaped = (roles ?? []).map((r) => {
    const { crm_companies, crm_opportunities, ...rest } = r as Record<string, unknown>
    return { ...rest, account: crm_companies ?? null, deal: crm_opportunities ?? null }
  })

  return NextResponse.json({ roles: shaped, total: count })
}

/**
 * POST /api/admin/crm/roles
 * Creates one or more roles. Accepts { roles: [...] } for bulk creation
 * (e.g., when a deal closes won and needs multiple roles opened).
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

  const parsed = bulkRoleCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const rows = parsed.data.roles.map((role) => ({
    name: role.name,
    account_id: role.account_id ?? null,
    deal_id: role.deal_id ?? null,
    function: role.function ?? null,
    status: role.status,
    target_fill_date: role.target_fill_date ?? null,
    description: role.description ?? null,
    notes: role.notes ?? null,
    created_by: profile!.id,
  }))

  const { data: roles, error } = await supabase
    .from('crm_roles')
    .insert(rows)
    .select('*, crm_companies(id, name), crm_opportunities(id, title)')

  if (error) {
    return NextResponse.json({ error: 'Failed to create roles' }, { status: 500 })
  }

  const shaped = (roles ?? []).map((r) => {
    const { crm_companies, crm_opportunities, ...rest } = r as Record<string, unknown>
    return { ...rest, account: crm_companies ?? null, deal: crm_opportunities ?? null }
  })

  return NextResponse.json({ roles: shaped }, { status: 201 })
}
