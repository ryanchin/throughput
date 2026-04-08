import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ roleId: string }>
}

const assignSchema = z.object({
  candidate_id: z.string().uuid(),
})

/**
 * POST /api/admin/crm/roles/[roleId]/assign
 * Assigns a candidate to this role by setting candidate.target_role_id.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

  const parsed = assignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  // Verify role exists
  const { data: role, error: roleErr } = await supabase
    .from('crm_roles')
    .select('id, account_id')
    .eq('id', roleId)
    .single()

  if (roleErr || !role) {
    return NextResponse.json({ error: 'Role not found' }, { status: 404 })
  }

  // Update candidate's target_role_id and target_account_id
  const { data: candidate, error: candErr } = await supabase
    .from('crm_candidates')
    .update({
      target_role_id: roleId,
      target_account_id: role.account_id,
    })
    .eq('id', parsed.data.candidate_id)
    .select('id, first_name, last_name, status')
    .single()

  if (candErr || !candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  }

  return NextResponse.json({ candidate })
}
