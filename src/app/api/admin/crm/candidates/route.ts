import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { candidateCreateSchema, candidateSearchSchema } from '@/lib/crm/schemas'

/**
 * GET /api/admin/crm/candidates
 * Lists candidates with optional filters (status, function, search).
 * Includes target account name via join.
 */
export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = candidateSearchSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { status, function: fn, search, limit, offset } = parsed.data

  let query = supabase
    .from('crm_candidates')
    .select('*, crm_companies(id, name), crm_roles(id, name)', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (fn) query = query.eq('function', fn)
  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
  }

  const { data: candidates, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 })
  }

  const today = new Date()
  const shaped = (candidates ?? []).map((c) => {
    const { crm_companies, crm_roles, ...rest } = c as Record<string, unknown>
    const dateAdded = rest.date_added as string
    const daysInPipeline = dateAdded
      ? Math.floor((today.getTime() - new Date(dateAdded).getTime()) / 86400000)
      : null
    return {
      ...rest,
      target_account: crm_companies ?? null,
      target_role: crm_roles ?? null,
      days_in_pipeline: daysInPipeline,
    }
  })

  return NextResponse.json({ candidates: shaped, total: count })
}

/**
 * POST /api/admin/crm/candidates
 * Creates a new candidate.
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

  const parsed = candidateCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const data = parsed.data

  const { data: candidate, error } = await supabase
    .from('crm_candidates')
    .insert({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email || null,
      phone: data.phone || null,
      function: data.function,
      seniority: data.seniority ?? null,
      skills: data.skills,
      status: data.status,
      source: data.source ?? null,
      target_role_id: data.target_role_id ?? null,
      target_account_id: data.target_account_id ?? null,
      resume_url: data.resume_url || null,
      interview_notes: data.interview_notes ?? null,
      date_added: data.date_added ?? new Date().toISOString().split('T')[0],
      notes: data.notes ?? null,
    })
    .select('*, crm_companies(id, name), crm_roles(id, name)')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create candidate' }, { status: 500 })
  }

  const { crm_companies, crm_roles, ...rest } = candidate as Record<string, unknown>
  return NextResponse.json({
    candidate: { ...rest, target_account: crm_companies ?? null, target_role: crm_roles ?? null },
  }, { status: 201 })
}
