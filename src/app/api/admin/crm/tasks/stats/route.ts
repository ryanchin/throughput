import { NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/admin/crm/tasks/stats
 * Returns overdue_count, due_today_count, my_tasks_count for the current user.
 */
export async function GET() {
  const { error: authError, profile } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const userId = profile!.id
  const todayStr = new Date().toISOString().split('T')[0]

  // crm_action_owners not in generated types — use any cast
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceClient = createServiceClient() as any

  // Get all activity IDs where user is an action owner
  const { data: ownerRows } = await serviceClient
    .from('crm_action_owners')
    .select('activity_id')
    .eq('user_id', userId)

  const ownerActivityIds = (ownerRows ?? []).map((r: { activity_id: string }) => r.activity_id)

  // Get all non-completed tasks that are mine (owner or creator)
  let myTasksQuery = serviceClient
    .from('crm_activities')
    .select('id, due_date, status', { count: 'exact' })
    .eq('type', 'task')
    .neq('status', 'Completed')

  if (ownerActivityIds.length > 0) {
    myTasksQuery = myTasksQuery.or(`id.in.(${ownerActivityIds.join(',')}),created_by.eq.${userId}`)
  } else {
    myTasksQuery = myTasksQuery.eq('created_by', userId)
  }

  const { data: myTasks } = await myTasksQuery

  const tasks = (myTasks ?? []) as { id: string; due_date: string | null; status: string }[]

  let overdue_count = 0
  let due_today_count = 0

  for (const task of tasks) {
    if (!task.due_date) continue
    const dueDate = task.due_date.split('T')[0]
    if (dueDate < todayStr) {
      overdue_count++
    } else if (dueDate === todayStr) {
      due_today_count++
    }
  }

  return NextResponse.json({
    overdue_count,
    due_today_count,
    my_tasks_count: tasks.length,
  })
}
