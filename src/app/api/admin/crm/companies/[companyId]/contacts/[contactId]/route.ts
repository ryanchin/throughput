import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { contactUpdateSchema } from '@/lib/crm/schemas'

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
 * If is_primary is true, unset any existing primary contact for this company,
 * excluding the contact being updated.
 */
async function unsetExistingPrimary(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  companyId: string,
  excludeContactId?: string
) {
  let query = supabase
    .from('crm_contacts')
    .update({ is_primary: false })
    .eq('company_id', companyId)
    .eq('is_primary', true)

  if (excludeContactId) {
    query = query.neq('id', excludeContactId)
  }

  await query
}

/**
 * PATCH /api/admin/crm/companies/[companyId]/contacts/[contactId]
 * Updates a contact. If setting is_primary to true, unsets the old primary first.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; contactId: string }> }
) {
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { companyId, contactId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = contactUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const cleaned = cleanEmptyStrings(parsed.data, ['email', 'phone', 'title', 'linkedin_url', 'notes'])

  // If promoting to primary, unset the existing primary first
  if (cleaned.is_primary) {
    await unsetExistingPrimary(supabase, companyId, contactId)
  }

  const { data: contact, error } = await supabase
    .from('crm_contacts')
    .update(cleaned)
    .eq('id', contactId)
    .eq('company_id', companyId)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 })
  }

  return NextResponse.json({ contact })
}

/**
 * DELETE /api/admin/crm/companies/[companyId]/contacts/[contactId]
 * Deletes a contact. Admin-only — sales role receives 403.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string; contactId: string }> }
) {
  const { error: authError, supabase, profile } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  if (profile!.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: only admins can delete contacts' },
      { status: 403 }
    )
  }

  const { companyId, contactId } = await params

  const { error } = await supabase
    .from('crm_contacts')
    .delete()
    .eq('id', contactId)
    .eq('company_id', companyId)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
