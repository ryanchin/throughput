import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { taskUpdateSchema } from '@/lib/crm/schemas'
import { createServiceClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ taskId: string }>
}

/**
 * GET /api/admin/crm/tasks/[taskId]
 * Returns a single task with assignees, company, and opportunity.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { taskId } = await params
  const { error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { data: task, error } = await supabase
    .from('crm_activities')
    .select('*, crm_companies(id, name), crm_opportunities(id, title)')
    .eq('id', taskId)
    .eq('type', 'task')
    .single()

  if (error || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  // Fetch assignees — crm_action_owners not in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceClient = createServiceClient() as any
  const { data: ownerRows } = await serviceClient
    .from('crm_action_owners')
    .select('user_id')
    .eq('activity_id', taskId)

  let assignees: { user_id: string; full_name: string }[] = []
  if (ownerRows && ownerRows.length > 0) {
    const userIds = ownerRows.map((r: { user_id: string }) => r.user_id)
    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)

    assignees = (profiles ?? []).map((p: { id: string; full_name: string | null }) => ({
      user_id: p.id,
      full_name: p.full_name ?? '',
    }))
  }

  const { crm_companies, crm_opportunities, ...rest } = task as unknown as Record<string, unknown>

  return NextResponse.json({
    task: {
      ...rest,
      company: crm_companies ?? null,
      opportunity: crm_opportunities ?? null,
      assignees,
    },
  })
}

/**
 * PATCH /api/admin/crm/tasks/[taskId]
 * Updates a task. Handles status/completed sync and assignee replacement.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { taskId } = await params
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

  const parsed = taskUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { assignee_ids, ...updateData } = parsed.data

  // Build the update payload, cleaning empty strings to null
  const update: Record<string, unknown> = {}

  if (updateData.subject !== undefined) update.subject = updateData.subject
  if (updateData.description !== undefined) update.description = updateData.description === '' ? null : updateData.description
  if (updateData.due_date !== undefined) update.due_date = updateData.due_date === '' ? null : updateData.due_date
  if (updateData.priority !== undefined) update.priority = updateData.priority
  if (updateData.category !== undefined) update.category = updateData.category
  if (updateData.completed !== undefined) update.completed = updateData.completed

  // Handle status <-> completed sync
  if (updateData.status !== undefined) {
    update.status = updateData.status
    if (updateData.status === 'Completed') {
      update.completed = true
    } else if (updateData.completed === undefined) {
      update.completed = false
    }
  }

  if (updateData.completed !== undefined && updateData.status === undefined) {
    update.completed = updateData.completed
    if (updateData.completed) {
      update.status = 'Completed'
    }
  }

  if (Object.keys(update).length === 0 && assignee_ids === undefined) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  let task = null
  if (Object.keys(update).length > 0) {
    const { data, error } = await sb
      .from('crm_activities')
      .update(update)
      .eq('id', taskId)
      .eq('type', 'task')
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }
    task = data
  }

  // Handle assignee replacement — crm_action_owners not in generated types
  if (assignee_ids !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceClient = createServiceClient() as any
    // Delete existing owners
    await serviceClient
      .from('crm_action_owners')
      .delete()
      .eq('activity_id', taskId)

    // Insert new owners
    if (assignee_ids.length > 0) {
      const ownerRows = assignee_ids.map((user_id) => ({
        activity_id: taskId,
        user_id,
        assigned_at: new Date().toISOString(),
      }))
      await serviceClient.from('crm_action_owners').insert(ownerRows)
    }
  }

  // Re-fetch the task if we only updated assignees
  if (!task) {
    const { data, error } = await sb
      .from('crm_activities')
      .select()
      .eq('id', taskId)
      .eq('type', 'task')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    task = data
  }

  return NextResponse.json({ task })
}
