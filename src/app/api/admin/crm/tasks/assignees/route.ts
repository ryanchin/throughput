import { NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/admin/crm/tasks/assignees
 * Returns profiles with CRM access (admin or sales role), ordered by full_name.
 */
export async function GET() {
  const { error: authError } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const serviceClient = createServiceClient()
  const { data: users, error } = await serviceClient
    .from('profiles')
    .select('id, full_name')
    .in('role', ['admin', 'sales'])
    .order('full_name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  return NextResponse.json({ users: users ?? [] })
}
