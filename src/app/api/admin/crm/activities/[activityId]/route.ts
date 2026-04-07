import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { activityTaskUpdateSchema } from '@/lib/crm/schemas'

interface RouteParams {
  params: Promise<{ activityId: string }>
}

/**
 * PATCH /api/admin/crm/activities/[activityId]
 * Updates only the completed field of an activity (task completion toggle).
 * Does not allow updating any other fields.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { activityId } = await params
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

  const parsed = activityTaskUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { completed } = parsed.data

  const { data: activity, error } = await supabase
    .from('crm_activities')
    .update({ completed })
    .eq('id', activityId)
    .select('*, crm_companies(name)')
    .single()

  if (error || !activity) {
    return NextResponse.json({ error: 'Activity not found or update failed' }, { status: 404 })
  }

  return NextResponse.json({ activity })
}
