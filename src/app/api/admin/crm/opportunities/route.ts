import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { opportunityCreateSchema } from '@/lib/crm/schemas'
import { STAGE_PROBABILITIES } from '@/lib/crm/constants'
import type { Stage } from '@/lib/crm/constants'

/**
 * GET /api/admin/crm/opportunities
 * Lists opportunities with optional filters for stage and company_id.
 * Includes the related company name via join.
 */
export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { searchParams } = request.nextUrl
  const stage = searchParams.get('stage')
  const companyId = searchParams.get('company_id')

  let query = supabase
    .from('crm_opportunities')
    .select('*, crm_companies(id, name)')
    .order('updated_at', { ascending: false })

  if (stage) {
    query = query.eq('stage', stage)
  }

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const { data: opportunities, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 })
  }

  // Reshape crm_companies join to the expected `company` key
  const shaped = (opportunities ?? []).map((opp) => {
    const { crm_companies, ...rest } = opp as Record<string, unknown>
    return { ...rest, company: crm_companies ?? null }
  })

  return NextResponse.json({ opportunities: shaped })
}

/**
 * POST /api/admin/crm/opportunities
 * Creates a new opportunity. Auto-sets probability from stage if not provided.
 * Cleans empty strings (contact_id, expected_close_date) to null.
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

  const parsed = opportunityCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const data = parsed.data

  // Auto-set probability from stage if not explicitly provided
  const probability = data.probability ?? STAGE_PROBABILITIES[data.stage as Stage]

  // Clean empty strings to null
  const contactId = data.contact_id === '' ? null : (data.contact_id ?? null)
  const expectedCloseDate = data.expected_close_date === '' ? null : (data.expected_close_date ?? null)
  const closeReason = data.close_reason === '' ? null : (data.close_reason ?? null)
  const notes = data.notes === '' ? null : (data.notes ?? null)

  const { data: opportunity, error } = await supabase
    .from('crm_opportunities')
    .insert({
      company_id: data.company_id,
      contact_id: contactId,
      title: data.title,
      value: data.value ?? null,
      stage: data.stage,
      probability,
      expected_close_date: expectedCloseDate,
      close_reason: closeReason,
      notes,
      created_by: profile!.id,
    })
    .select('*, crm_companies(id, name)')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create opportunity' }, { status: 500 })
  }

  const { crm_companies, ...rest } = opportunity as Record<string, unknown>
  return NextResponse.json({ opportunity: { ...rest, company: crm_companies ?? null } }, { status: 201 })
}
