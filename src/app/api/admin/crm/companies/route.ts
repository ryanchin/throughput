import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { companyCreateSchema, companySearchSchema } from '@/lib/crm/schemas'

/**
 * Converts empty strings to null for optional fields before DB insert.
 * Supabase expects null for absent values, not empty strings.
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
 * GET /api/admin/crm/companies
 * Lists companies with optional search (ILIKE on name), status filter, and pagination.
 * Returns companies enriched with contact_count and opportunity_count.
 */
export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const url = new URL(request.url)
  const params = Object.fromEntries(url.searchParams.entries())

  const parsed = companySearchSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { search, status, limit, offset } = parsed.data

  let query = supabase
    .from('crm_companies')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data: companies, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })
  }

  // Fetch contact and opportunity counts per company
  const companyIds = companies.map((c) => c.id)

  const { data: contactRows } = companyIds.length > 0
    ? await supabase
        .from('crm_contacts')
        .select('company_id')
        .in('company_id', companyIds)
    : { data: [] }

  const { data: opportunityRows } = companyIds.length > 0
    ? await supabase
        .from('crm_opportunities')
        .select('company_id')
        .in('company_id', companyIds)
    : { data: [] }

  const contactCountMap: Record<string, number> = {}
  for (const row of contactRows ?? []) {
    contactCountMap[row.company_id] = (contactCountMap[row.company_id] ?? 0) + 1
  }

  const opportunityCountMap: Record<string, number> = {}
  for (const row of opportunityRows ?? []) {
    opportunityCountMap[row.company_id] = (opportunityCountMap[row.company_id] ?? 0) + 1
  }

  const enrichedCompanies = companies.map((company) => ({
    ...company,
    contact_count: contactCountMap[company.id] ?? 0,
    opportunity_count: opportunityCountMap[company.id] ?? 0,
  }))

  return NextResponse.json({ companies: enrichedCompanies, total: count })
}

/**
 * POST /api/admin/crm/companies
 * Creates a new company. Validates input with Zod.
 * Returns 409 if a company with the same name already exists.
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

  const parsed = companyCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const cleaned = cleanEmptyStrings(parsed.data, ['website', 'industry', 'notes'])

  const { data: company, error } = await supabase
    .from('crm_companies')
    .insert({
      ...cleaned,
      created_by: profile!.id,
    })
    .select()
    .single()

  if (error) {
    // Handle unique constraint violation on name
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A company with this name already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Failed to create company' }, { status: 500 })
  }

  return NextResponse.json({ company }, { status: 201 })
}
