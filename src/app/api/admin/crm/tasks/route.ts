import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { taskCreateSchema, taskSearchSchema } from '@/lib/crm/schemas'
import { createServiceClient } from '@/lib/supabase/server'

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
 * GET /api/admin/crm/tasks
 * Lists tasks (crm_activities where type='task') with tab filtering,
 * assignee enrichment, and overdue computation.
 */
export async function GET(request: NextRequest) {
  const { error: authError, supabase, profile } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const url = new URL(request.url)
  const params = Object.fromEntries(url.searchParams.entries())

  const parsed = taskSearchSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { tab, status, priority, company_id, limit, offset } = parsed.data
  const todayStr = new Date().toISOString().split('T')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  let query = sb
    .from('crm_activities')
    .select('*, crm_companies(id, name), crm_opportunities(id, title)', { count: 'exact' })
    .eq('type', 'task')

  // Tab filtering
  if (tab === 'my') {
    // Get activity IDs where user is an action owner
    const { data: ownerRows } = await sb
      .from('crm_action_owners')
      .select('activity_id')
      .eq('user_id', profile!.id)

    const ownerActivityIds = (ownerRows ?? []).map((r: { activity_id: string }) => r.activity_id)

    if (ownerActivityIds.length > 0) {
      query = query.or(`id.in.(${ownerActivityIds.join(',')}),created_by.eq.${profile!.id}`)
    } else {
      query = query.eq('created_by', profile!.id)
    }
  } else if (tab === 'overdue') {
    query = query
      .not('due_date', 'is', null)
      .lt('due_date', todayStr)
      .neq('status', 'Completed')
  }
  // tab === 'all' — no extra filter

  // Optional filters
  if (status) {
    query = query.eq('status', status)
  }
  if (priority) {
    query = query.eq('priority', priority)
  }
  if (company_id) {
    query = query.eq('company_id', company_id)
  }

  // Ordering: due_date ascending (nulls last), then created_at desc
  query = query
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data: tasks, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }

  // Fetch assignees for the task IDs in this page
  const taskIds = (tasks ?? []).map((t: { id: string }) => t.id)
  const assigneeMap: Record<string, { user_id: string; full_name: string }[]> = {}

  if (taskIds.length > 0) {
    // crm_action_owners is not in generated Supabase types — use service client with any cast
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceClient = createServiceClient() as any
    const { data: ownerRows } = await serviceClient
      .from('crm_action_owners')
      .select('activity_id, user_id')
      .in('activity_id', taskIds)

    if (ownerRows && ownerRows.length > 0) {
      const userIds = [...new Set(ownerRows.map((r: { user_id: string }) => r.user_id))]
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)

      const profileMap: Record<string, string> = {}
      for (const p of profiles ?? []) {
        profileMap[(p as { id: string }).id] = (p as { full_name: string | null }).full_name ?? ''
      }

      for (const row of ownerRows) {
        const r = row as { activity_id: string; user_id: string }
        if (!assigneeMap[r.activity_id]) {
          assigneeMap[r.activity_id] = []
        }
        assigneeMap[r.activity_id].push({
          user_id: r.user_id,
          full_name: profileMap[r.user_id] ?? '',
        })
      }
    }
  }

  // Shape response
  const shapedTasks = (tasks ?? []).map((task: Record<string, unknown>) => {
    const { crm_companies, crm_opportunities, ...rest } = task

    // Compute days overdue
    let days_overdue: number | null = null
    const dueDate = rest.due_date as string | null
    if (dueDate && rest.status !== 'Completed') {
      const dueDateObj = new Date(dueDate)
      const today = new Date(todayStr)
      const diffMs = today.getTime() - dueDateObj.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays > 0) {
        days_overdue = diffDays
      }
    }

    return {
      ...rest,
      company: crm_companies ?? null,
      opportunity: crm_opportunities ?? null,
      assignees: assigneeMap[rest.id as string] ?? [],
      days_overdue,
    }
  })

  return NextResponse.json({ tasks: shapedTasks, total: count })
}

/**
 * POST /api/admin/crm/tasks
 * Creates a new task (crm_activities with type='task').
 * Optionally assigns users via crm_action_owners.
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

  const parsed = taskCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { assignee_ids, ...taskData } = parsed.data
  const cleaned = cleanEmptyStrings(taskData, [
    'company_id',
    'contact_id',
    'opportunity_id',
    'description',
    'due_date',
  ])

  // crm_activities has new columns (priority, status, due_date, etc.) not in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: task, error } = await (supabase as any)
    .from('crm_activities')
    .insert({
      ...cleaned,
      type: 'task',
      completed: cleaned.status === 'Completed',
      created_by: profile!.id,
      activity_date: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }

  // Assign owners via crm_action_owners (not in generated types)
  if (assignee_ids.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceClient = createServiceClient() as any
    const ownerRows = assignee_ids.map((user_id) => ({
      activity_id: task.id,
      user_id,
      assigned_at: new Date().toISOString(),
    }))
    await serviceClient.from('crm_action_owners').insert(ownerRows)
  }

  return NextResponse.json({ task }, { status: 201 })
}
