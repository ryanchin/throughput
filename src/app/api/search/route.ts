import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth/getProfile'
import { globalSearch } from '@/lib/knowledge/search'

/**
 * GET /api/search?q=<query>
 * Full-text search across knowledge pages, courses, lessons, and certifications.
 * Authenticated users only. Results are filtered by RLS based on user access.
 */
export async function GET(request: NextRequest) {
  const profile = await getProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get('q')
  if (!q || q.trim().length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
  }

  const results = await globalSearch(q)

  return NextResponse.json({ results })
}
