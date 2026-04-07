import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { createServiceClient } from '@/lib/supabase/server'
import { consultantCreateSchema, consultantSearchSchema } from '@/lib/crm/schemas'

/**
 * GET /api/admin/crm/consultants
 * Lists consultants with optional filters (status, function, account_id, search).
 * Joins profiles for name and crm_companies for account name.
 */
export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = consultantSearchSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { status, function: fn, account_id, search, limit, offset } = parsed.data

  let query = supabase
    .from('crm_consultants')
    .select('*, profiles!inner(id, full_name, email), crm_companies(id, name)', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (fn) query = query.eq('function', fn)
  if (account_id) query = query.eq('current_account_id', account_id)
  if (search) query = query.ilike('profiles.full_name', `%${search}%`)

  const { data: consultants, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch consultants' }, { status: 500 })
  }

  // For bench consultants, compute days_on_bench from their latest completed assignment
  const benchIds = (consultants ?? [])
    .filter((c) => c.status === 'Active - Bench')
    .map((c) => c.id)

  let benchDaysMap: Record<string, number> = {}
  if (benchIds.length > 0) {
    const { data: lastAssignments } = await supabase
      .from('crm_assignments')
      .select('consultant_id, actual_end_date')
      .in('consultant_id', benchIds)
      .eq('status', 'Completed')
      .order('actual_end_date', { ascending: false })

    const seen = new Set<string>()
    const today = new Date()
    for (const row of lastAssignments ?? []) {
      if (seen.has(row.consultant_id)) continue
      seen.add(row.consultant_id)
      if (row.actual_end_date) {
        const endDate = new Date(row.actual_end_date)
        benchDaysMap[row.consultant_id] = Math.floor((today.getTime() - endDate.getTime()) / 86400000)
      }
    }
  }

  const shaped = (consultants ?? []).map((c) => {
    const { profiles, crm_companies, ...rest } = c as Record<string, unknown>
    return {
      ...rest,
      user: profiles,
      account: crm_companies ?? null,
      days_on_bench: benchDaysMap[rest.id as string] ?? null,
    }
  })

  return NextResponse.json({ consultants: shaped, total: count })
}

/**
 * POST /api/admin/crm/consultants
 * Creates a new consultant. Also creates a User (auth + profile) with user_role='consultant'.
 * Uses service role client for auth.admin.createUser.
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = consultantCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const data = parsed.data
  const email = data.email ?? `${data.first_name.toLowerCase()}.${data.last_name.toLowerCase()}@consultant.throughput.local`
  const fullName = `${data.first_name} ${data.last_name}`

  // Use service role to create auth user + bypass RLS for insert
  const serviceSb = createServiceClient()

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

  // Update profile with user_role and full_name
  await serviceSb.from('profiles').update({
    full_name: fullName,
    user_role: 'consultant',
    role: 'employee',
  }).eq('id', userId)

  // Create consultant record
  const { data: consultant, error: consultErr } = await serviceSb
    .from('crm_consultants')
    .insert({
      user_id: userId,
      function: data.function,
      seniority: data.seniority ?? null,
      skills: data.skills,
      status: data.status,
      current_account_id: data.current_account_id ?? null,
      start_date: data.start_date ?? null,
      expected_end_date: data.expected_end_date ?? null,
      bill_rate: data.bill_rate ?? null,
      cost_rate: data.cost_rate ?? null,
      hire_date: data.hire_date ?? null,
      location: data.location ?? null,
      notes: data.notes ?? null,
    })
    .select('*, profiles!inner(id, full_name, email), crm_companies(id, name)')
    .single()

  if (consultErr) {
    return NextResponse.json({ error: 'Failed to create consultant' }, { status: 500 })
  }

  const { profiles, crm_companies, ...rest } = consultant as Record<string, unknown>
  return NextResponse.json({
    consultant: { ...rest, user: profiles, account: crm_companies ?? null },
  }, { status: 201 })
}
