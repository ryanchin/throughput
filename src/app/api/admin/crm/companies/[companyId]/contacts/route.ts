import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { contactCreateSchema } from '@/lib/crm/schemas'

/**
 * Converts empty strings to null for optional fields before DB insert.
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
 * If is_primary is true, unset any existing primary contact for this company.
 * Uses the supabase client to update crm_contacts where company_id matches
 * and is_primary is currently true.
 */
async function unsetExistingPrimary(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  companyId: string
) {
  await supabase
    .from('crm_contacts')
    .update({ is_primary: false })
    .eq('company_id', companyId)
    .eq('is_primary', true)
}

/**
 * GET /api/admin/crm/companies/[companyId]/contacts
 * Lists contacts for a company, ordered by is_primary desc then name asc.
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

  // Verify company exists
  const { data: company, error: companyError } = await supabase
    .from('crm_companies')
    .select('id')
    .eq('id', companyId)
    .single()

  if (companyError || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const { data: contacts, error } = await supabase
    .from('crm_contacts')
    .select('*')
    .eq('company_id', companyId)
    .order('is_primary', { ascending: false })
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 })
  }

  return NextResponse.json({ contacts })
}

/**
 * POST /api/admin/crm/companies/[companyId]/contacts
 * Creates a contact for this company.
 * If is_primary is true and a primary already exists, unsets the old primary first.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { companyId } = await params

  // Verify company exists
  const { data: company, error: companyError } = await supabase
    .from('crm_companies')
    .select('id')
    .eq('id', companyId)
    .single()

  if (companyError || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = contactCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const cleaned = cleanEmptyStrings(parsed.data, ['email', 'phone', 'title', 'linkedin_url', 'notes'])

  // If setting as primary, unset the existing primary first
  if (cleaned.is_primary) {
    await unsetExistingPrimary(supabase, companyId)
  }

  const { data: contact, error } = await supabase
    .from('crm_contacts')
    .insert({
      ...cleaned,
      company_id: companyId,
    })
    .select()
    .single()

  if (error) {
    // Handle unique constraint violation on primary index (race condition fallback)
    if (error.code === '23505' && cleaned.is_primary) {
      await unsetExistingPrimary(supabase, companyId)

      const { data: retryContact, error: retryError } = await supabase
        .from('crm_contacts')
        .insert({
          ...cleaned,
          company_id: companyId,
        })
        .select()
        .single()

      if (retryError) {
        return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
      }

      return NextResponse.json({ contact: retryContact }, { status: 201 })
    }

    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
  }

  return NextResponse.json({ contact }, { status: 201 })
}
