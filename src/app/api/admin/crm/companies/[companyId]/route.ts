import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { companyUpdateSchema } from '@/lib/crm/schemas'
import { OPEN_STAGES } from '@/lib/crm/constants'

/**
 * Converts empty strings to null for optional fields before DB update.
 */
function cleanEmptyStrings<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj }
  for (const field of fields) {
    if (result[field] === '') {
      result[field] = null as T[keyof T]
    }
  }
  return result
}

/**
 * GET /api/admin/crm/companies/[companyId]
 * Returns a single company with contact_count, opportunity_count, and total_pipeline_value.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { companyId } = await params

  const { data: company, error } = await supabase
    .from('crm_companies')
    .select('*')
    .eq('id', companyId)
    .single()

  if (error || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  // Fetch counts
  const [contactResult, opportunityResult, pipelineResult] = await Promise.all([
    supabase
      .from('crm_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId),
    supabase
      .from('crm_opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId),
    supabase
      .from('crm_opportunities')
      .select('value')
      .eq('company_id', companyId)
      .in('stage', OPEN_STAGES as unknown as string[]),
  ])

  const totalPipelineValue = (pipelineResult.data ?? []).reduce(
    (sum, row) => sum + (Number(row.value) || 0),
    0
  )

  return NextResponse.json({
    company: {
      ...company,
      contact_count: contactResult.count ?? 0,
      opportunity_count: opportunityResult.count ?? 0,
      total_pipeline_value: totalPipelineValue,
    },
  })
}

/**
 * PATCH /api/admin/crm/companies/[companyId]
 * Updates company fields. Validates input with Zod partial schema.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { companyId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = companyUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const cleaned = cleanEmptyStrings(parsed.data, ['website', 'industry', 'notes'])

  const { data: company, error } = await supabase
    .from('crm_companies')
    .update(cleaned)
    .eq('id', companyId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A company with this name already exists' },
        { status: 409 }
      )
    }
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update company' }, { status: 500 })
  }

  return NextResponse.json({ company })
}

/**
 * DELETE /api/admin/crm/companies/[companyId]
 * Deletes a company. Admin-only — sales role receives 403.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { error: authError, supabase, profile } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  if (profile!.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: only admins can delete companies' },
      { status: 403 }
    )
  }

  const { companyId } = await params

  const { error } = await supabase
    .from('crm_companies')
    .delete()
    .eq('id', companyId)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete company' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
