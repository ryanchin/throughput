import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/certifications
 * Lists published certification tracks. Public access.
 * Belt-and-suspenders: filters status='published' in query AND RLS.
 */
export async function GET() {
  const supabase = await createClient()

  // No auth required — certifications are public
  const { data: tracks, error } = await supabase
    .from('certification_tracks')
    .select('id, title, slug, tier, domain, description, passing_score, exam_duration_minutes, status')
    .eq('status', 'published')
    .order('tier', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch certification tracks' }, { status: 500 })
  }

  return NextResponse.json({ tracks })
}
