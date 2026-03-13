import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'

const groupMembershipSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  groupName: z.string().min(1, 'Group name is required'),
})

/**
 * GET /api/admin/users/groups
 * Returns all distinct group names from the user_groups table.
 * Admin only.
 */
export async function GET() {
  const { error: authError } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const serviceClient = createServiceClient()

  const { data, error } = await serviceClient
    .from('user_groups')
    .select('group_name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Extract distinct group names
  const groups = [...new Set((data ?? []).map(row => row.group_name))]

  return NextResponse.json({ groups })
}

/**
 * POST /api/admin/users/groups
 * Adds a user to a group.
 * Admin only.
 */
export async function POST(request: NextRequest) {
  const { profile, error: authError } = await requireAdmin()
  if (authError || !profile) {
    return NextResponse.json(
      { error: authError?.message ?? 'Unauthorized' },
      { status: authError?.status ?? 401 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = groupMembershipSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { userId, groupName } = parsed.data
  const serviceClient = createServiceClient()

  const { error: insertError } = await serviceClient
    .from('user_groups')
    .insert({
      user_id: userId,
      group_name: groupName,
      added_by: profile.id,
    })

  if (insertError) {
    // Handle duplicate key (user already in group)
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'User is already in this group' }, { status: 409 })
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

/**
 * DELETE /api/admin/users/groups
 * Removes a user from a group.
 * Admin only.
 */
export async function DELETE(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = groupMembershipSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { userId, groupName } = parsed.data
  const serviceClient = createServiceClient()

  const { error: deleteError } = await serviceClient
    .from('user_groups')
    .delete()
    .eq('user_id', userId)
    .eq('group_name', groupName)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
