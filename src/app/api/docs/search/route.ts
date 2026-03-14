import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/docs/search?q=<query>
 * Public (no auth required) search endpoint that searches only published docs pages.
 * Returns matching pages by title using case-insensitive pattern matching.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')
  if (!q || q.trim().length < 2) {
    return NextResponse.json({ results: [] })
  }

  const supabase = createServiceClient()

  // Search docs pages by title (ilike for simplicity)
  const { data } = await supabase
    .from('docs_pages')
    .select('id, title, slug, parent_id')
    .eq('status', 'published')
    .eq('type', 'docs')
    .ilike('title', `%${q.trim()}%`)
    .limit(20)

  const results = (data ?? []).map((page) => ({
    id: page.id as string,
    title: page.title as string,
    url: `/docs/${page.slug as string}`,
    type: 'docs' as const,
  }))

  return NextResponse.json({ results })
}
