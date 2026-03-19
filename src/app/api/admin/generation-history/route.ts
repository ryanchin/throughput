import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'

/**
 * GET /api/admin/generation-history
 * Returns recent AI generation logs. Admin only.
 */
export async function GET() {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { data: logs, error } = await supabase
    .from('generation_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch generation history' }, { status: 500 })
  }

  return NextResponse.json({ logs: logs ?? [] })
}
