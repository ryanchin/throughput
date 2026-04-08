import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ roleId: string }>
}

const staffSchema = z.object({
  candidate_id: z.string().uuid(),
  start_date: z.string().optional(),
  bill_rate: z.number().min(0).optional(),
})

/**
 * POST /api/admin/crm/roles/[roleId]/staff
 * Staffs a role with a candidate. This:
 *   1. Promotes the candidate to a consultant (if not already promoted)
 *   2. Creates an assignment linking the consultant to the role's account/deal
 *   3. Sets the role status to 'Filled'
 *   4. Updates the candidate status to 'Hired'
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

  const parsed = staffSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  // Fetch role
  const { data: role, error: roleErr } = await supabase
    .from('crm_roles')
    .select('id, account_id, deal_id, function, status')
    .eq('id', roleId)
    .single()

  if (roleErr || !role) {
    return NextResponse.json({ error: 'Role not found' }, { status: 404 })
  }

  if (role.status === 'Filled' || role.status === 'Fulfilled') {
    return NextResponse.json({ error: 'Role is already filled' }, { status: 409 })
  }

  if (!role.account_id) {
    return NextResponse.json({ error: 'Role has no account assigned' }, { status: 400 })
  }

  const accountId = role.account_id

  // Fetch candidate
  const { data: candidate, error: candErr } = await supabase
    .from('crm_candidates')
    .select('*')
    .eq('id', parsed.data.candidate_id)
    .single()

  if (candErr || !candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  }

  const serviceSb = createServiceClient()

  // Step 1: Promote candidate to consultant if not already
  let consultantId = candidate.promoted_to_consultant_id

  if (!consultantId) {
    const email = candidate.email ?? `${candidate.first_name.toLowerCase()}.${candidate.last_name.toLowerCase()}@consultant.throughput.local`
    const fullName = `${candidate.first_name} ${candidate.last_name}`

    // Create auth user
    const { data: authData, error: authErr } = await serviceSb.auth.admin.createUser({
      email,
      password: 'change-me-on-first-login',
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (authErr) {
      return NextResponse.json({ error: `Failed to create user: ${authErr.message}` }, { status: 500 })
    }

    const userId = authData.user.id

    await serviceSb.from('profiles').update({
      full_name: fullName,
      user_role: 'consultant',
      role: 'employee',
    }).eq('id', userId)

    // Create consultant
    const { data: consultant, error: consultErr } = await serviceSb
      .from('crm_consultants')
      .insert({
        user_id: userId,
        function: candidate.function,
        seniority: candidate.seniority ?? null,
        skills: candidate.skills ?? [],
        status: 'Active - Placed',
        current_account_id: accountId,
        promoted_from_candidate_id: candidate.id,
      })
      .select('id')
      .single()

    if (consultErr || !consultant) {
      return NextResponse.json({ error: 'Failed to create consultant' }, { status: 500 })
    }

    consultantId = consultant.id

    // Set bidirectional FKs
    await serviceSb.from('crm_candidates').update({
      promoted_to_consultant_id: consultantId,
      status: 'Hired',
    }).eq('id', candidate.id)
  } else {
    // Already promoted, just update candidate status
    await serviceSb.from('crm_candidates').update({ status: 'Hired' }).eq('id', candidate.id)

    // Update consultant to Active - Placed
    await serviceSb.from('crm_consultants').update({
      status: 'Active - Placed',
      current_account_id: accountId,
    }).eq('id', consultantId)
  }

  // Step 2: Create assignment
  const startDate = parsed.data.start_date ?? new Date().toISOString().split('T')[0]
  const { data: assignment, error: assignErr } = await serviceSb
    .from('crm_assignments')
    .insert({
      consultant_id: consultantId,
      account_id: accountId,
      deal_id: role.deal_id ?? null,
      role_id: roleId,
      start_date: startDate,
      bill_rate: parsed.data.bill_rate ?? null,
      status: 'Active',
    })
    .select('id')
    .single()

  if (assignErr) {
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
  }

  // Step 3: Mark role as Filled
  await serviceSb.from('crm_roles').update({ status: 'Filled' }).eq('id', roleId)

  return NextResponse.json({
    staffed: {
      role_id: roleId,
      consultant_id: consultantId,
      assignment_id: assignment?.id,
      candidate_id: candidate.id,
    },
  }, { status: 201 })
}
