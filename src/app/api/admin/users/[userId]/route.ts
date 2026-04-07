import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const updateUserSchema = z.object({
  full_name: z.string().min(1, 'Full name cannot be empty').optional(),
  email: z.string().email('Invalid email address').optional(),
  role: z.enum(['admin', 'sales', 'employee']).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
})

/**
 * PATCH /api/admin/users/[userId]
 *
 * Update a user's profile. If email changes, also updates auth.users.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
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

  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { full_name, email, role } = parsed.data
  const serviceClient = createServiceClient()

  // Check user exists
  const { data: existing, error: fetchError } = await serviceClient
    .from('profiles')
    .select('id, email')
    .eq('id', userId)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // If email is changing, update auth.users
  if (email && email !== existing.email) {
    const { error: authUpdateError } = await serviceClient.auth.admin.updateUserById(userId, {
      email,
    })
    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message }, { status: 422 })
    }
  }

  // Update profile
  const updatePayload: Record<string, string> = {}
  if (full_name !== undefined) updatePayload.full_name = full_name
  if (email !== undefined) updatePayload.email = email
  if (role !== undefined) updatePayload.role = role

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId)
    .select('id, email, full_name, role, created_at, updated_at')
    .single()

  if (profileError) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  return NextResponse.json({ user: profile })
}

/**
 * DELETE /api/admin/users/[userId]
 *
 * Delete a user from auth.users (profile cascades or is handled manually).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const { error: authError, profile: adminProfile } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // Prevent self-deletion
  if (adminProfile?.id === userId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Check user exists
  const { data: existing } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Delete from auth.users — profile should cascade-delete via FK
  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId)
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // Also delete profile explicitly in case cascade is not set up
  await serviceClient.from('profiles').delete().eq('id', userId)

  return NextResponse.json({ success: true })
}
