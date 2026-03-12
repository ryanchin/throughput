import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'

/**
 * GET /api/admin/courses/check-slug?slug=xxx&excludeId=yyy
 * Checks whether a course slug is available.
 * Optional excludeId param excludes a specific course (for edit mode).
 * Returns { available: boolean }.
 */
export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')
  const excludeId = searchParams.get('excludeId')

  if (!slug) {
    return NextResponse.json({ error: 'slug query parameter is required' }, { status: 400 })
  }

  let query = supabase
    .from('courses')
    .select('id')
    .eq('slug', slug)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to check slug' }, { status: 500 })
  }

  return NextResponse.json({ available: data === null })
}
