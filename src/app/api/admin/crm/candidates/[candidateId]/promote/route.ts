import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { createServiceClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ candidateId: string }>
}

/**
 * POST /api/admin/crm/candidates/[candidateId]/promote
 * Promotes a Hired candidate to a consultant:
 *   1. Validates candidate status is 'Hired'
 *   2. Creates auth user + profile with user_role='consultant'
 *   3. Creates consultant record (copies function, seniority, skills)
 *   4. Sets bidirectional promotion FKs
 *   5. Returns the new consultant
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { candidateId } = await params
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // Fetch candidate
  const { data: candidate, error: fetchErr } = await supabase
    .from('crm_candidates')
    .select('*')
    .eq('id', candidateId)
    .single()

  if (fetchErr || !candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  }

  if (candidate.status !== 'Hired') {
    return NextResponse.json(
      { error: `Cannot promote: candidate status is '${candidate.status}', must be 'Hired'` },
      { status: 400 }
    )
  }

  if (candidate.promoted_to_consultant_id) {
    return NextResponse.json(
      { error: 'Candidate has already been promoted' },
      { status: 409 }
    )
  }

  // Use service role for auth.admin.createUser + cross-table writes
  const serviceSb = createServiceClient()

  const email = candidate.email ?? `${candidate.first_name.toLowerCase()}.${candidate.last_name.toLowerCase()}@consultant.throughput.local`
  const fullName = `${candidate.first_name} ${candidate.last_name}`

  // Step 2: Create auth user
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

  // Update profile
  await serviceSb.from('profiles').update({
    full_name: fullName,
    user_role: 'consultant',
    role: 'employee',
  }).eq('id', userId)

  // Step 3: Create consultant record
  const { data: consultant, error: consultErr } = await serviceSb
    .from('crm_consultants')
    .insert({
      user_id: userId,
      function: candidate.function,
      seniority: candidate.seniority ?? null,
      skills: candidate.skills ?? [],
      status: 'Active - Bench',
      current_account_id: candidate.target_account_id ?? null,
      promoted_from_candidate_id: candidateId,
    })
    .select('*, profiles!inner(id, full_name, email), crm_companies(id, name)')
    .single()

  if (consultErr) {
    return NextResponse.json({ error: 'Failed to create consultant record' }, { status: 500 })
  }

  // Step 4: Set bidirectional FK on candidate
  await serviceSb
    .from('crm_candidates')
    .update({ promoted_to_consultant_id: consultant.id })
    .eq('id', candidateId)

  const { profiles, crm_companies, ...rest } = consultant as Record<string, unknown>
  return NextResponse.json({
    consultant: { ...rest, user: profiles, account: crm_companies ?? null },
  }, { status: 201 })
}
