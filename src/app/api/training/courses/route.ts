import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/training/courses
 * Lists published training courses for authenticated users.
 * Belt-and-suspenders: filters status='published' in query AND RLS.
 */
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || !['employee', 'sales', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Belt-and-suspenders: explicit status filter + RLS
  let query = supabase
    .from('courses')
    .select('id, title, slug, description, zone, status, cover_image_url, learning_objectives, passing_score, created_at')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  // Non-admin users only see their zone
  if (profile.role === 'employee') {
    query = query.eq('zone', 'training')
  }

  const { data: courses, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 })
  }

  return NextResponse.json({ courses })
}
