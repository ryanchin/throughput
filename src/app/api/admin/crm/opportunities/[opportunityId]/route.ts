import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { opportunityUpdateSchema } from '@/lib/crm/schemas'
import { STAGE_PROBABILITIES } from '@/lib/crm/constants'
import type { Stage } from '@/lib/crm/constants'

interface RouteParams {
  params: Promise<{ opportunityId: string }>
}

/** Reshape Supabase's `crm_companies` join key to the expected `company` key */
function shapeOpportunity(opp: Record<string, unknown>) {
  const { crm_companies, ...rest } = opp
  return { ...rest, company: crm_companies ?? null }
}

/**
 * GET /api/admin/crm/opportunities/[opportunityId]
 * Fetches a single opportunity by ID with the related company name.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { opportunityId } = await params
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { data: opportunity, error } = await supabase
    .from('crm_opportunities')
    .select('*, crm_companies(id, name)')
    .eq('id', opportunityId)
    .single()

  if (error || !opportunity) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  return NextResponse.json({ opportunity: shapeOpportunity(opportunity as Record<string, unknown>) })
}

/**
 * PATCH /api/admin/crm/opportunities/[opportunityId]
 * Updates an opportunity. If stage changes and probability was not explicitly
 * provided, auto-sets probability from STAGE_PROBABILITIES.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { opportunityId } = await params
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

  const parsed = opportunityUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const data = parsed.data
  const rawBody = body as Record<string, unknown>

  // Fetch current opportunity to detect stage changes
  const { data: current, error: fetchError } = await supabase
    .from('crm_opportunities')
    .select('stage, probability')
    .eq('id', opportunityId)
    .single()

  if (fetchError || !current) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  // Build the update payload
  const update: Record<string, unknown> = {}

  if (data.title !== undefined) update.title = data.title
  if (data.value !== undefined) update.value = data.value
  if (data.notes !== undefined) update.notes = data.notes === '' ? null : data.notes
  if (data.close_reason !== undefined) update.close_reason = data.close_reason === '' ? null : data.close_reason
  if (data.contact_id !== undefined) update.contact_id = data.contact_id === '' ? null : data.contact_id
  if (data.expected_close_date !== undefined) update.expected_close_date = data.expected_close_date === '' ? null : data.expected_close_date

  // Handle stage + probability logic
  if (data.stage !== undefined) {
    update.stage = data.stage
    const stageChanged = data.stage !== current.stage

    if (stageChanged && !('probability' in rawBody)) {
      // Stage changed and probability was NOT explicitly provided — auto-set
      update.probability = STAGE_PROBABILITIES[data.stage as Stage]
    }
  }

  // If probability was explicitly provided, always use it
  if ('probability' in rawBody && data.probability !== undefined) {
    update.probability = data.probability
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: opportunity, error } = await supabase
    .from('crm_opportunities')
    .update(update)
    .eq('id', opportunityId)
    .select('*, crm_companies(id, name)')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update opportunity' }, { status: 500 })
  }

  return NextResponse.json({ opportunity: shapeOpportunity(opportunity as Record<string, unknown>) })
}

/**
 * DELETE /api/admin/crm/opportunities/[opportunityId]
 * Deletes an opportunity by ID.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { opportunityId } = await params
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { error } = await supabase
    .from('crm_opportunities')
    .delete()
    .eq('id', opportunityId)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete opportunity' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
