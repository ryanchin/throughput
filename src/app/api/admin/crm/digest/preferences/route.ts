import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { z } from 'zod'

const preferencesUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  send_time: z.string().regex(/^\d{2}:00$/, 'Send time must be in HH:00 format').optional(),
  timezone: z.string().min(1).max(50).optional(),
})

/**
 * GET /api/admin/crm/digest/preferences
 * Returns the current user's digest preferences.
 * Creates a default row if none exists.
 *
 * Note: crm_digest_preferences is not in generated Supabase types yet,
 * so we cast to any for table access (same pattern as other CRM routes).
 */
export async function GET() {
  const { profile, error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Try to fetch existing preferences
  const { data: existing, error: fetchError } = await sb
    .from('crm_digest_preferences')
    .select('*')
    .eq('user_id', profile!.id)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json({ preferences: existing })
  }

  // Create default preferences
  const defaults = {
    user_id: profile!.id,
    enabled: true,
    send_time: '08:00',
    timezone: 'America/Los_Angeles',
  }

  const { data: created, error: createError } = await sb
    .from('crm_digest_preferences')
    .insert(defaults)
    .select()
    .single()

  if (createError) {
    // If insert fails due to race condition (row exists), fetch again
    const { data: retry } = await sb
      .from('crm_digest_preferences')
      .select('*')
      .eq('user_id', profile!.id)
      .single()

    if (retry) return NextResponse.json({ preferences: retry })
    return NextResponse.json({ error: 'Failed to create preferences' }, { status: 500 })
  }

  return NextResponse.json({ preferences: created })
}

/**
 * PATCH /api/admin/crm/digest/preferences
 * Updates the current user's digest preferences.
 */
export async function PATCH(request: NextRequest) {
  const { profile, error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = preferencesUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) update[key] = value
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Upsert: update if exists, insert if not
  const { data: prefs, error } = await sb
    .from('crm_digest_preferences')
    .upsert({
      user_id: profile!.id,
      ...update,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
  }

  return NextResponse.json({ preferences: prefs })
}
