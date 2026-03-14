import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildNavTree } from '@/lib/knowledge/nav-tree'
import type { NavPage } from '@/lib/knowledge/nav-tree'
import type { Visibility } from '@/lib/supabase/database.types'

/**
 * GET /api/docs/nav
 * Returns the docs navigation tree. Public endpoint — no auth required.
 * Only returns published docs pages (type='docs', visibility='public').
 */
export async function GET() {
  const serviceClient = createServiceClient()

  const { data, error } = await serviceClient
    .from('docs_pages')
    .select('id, title, slug, parent_id, order_index, visibility')
    .eq('status', 'published')
    .eq('type', 'docs')
    .order('order_index', { ascending: true })

  if (error || !data) {
    return NextResponse.json({ tree: [] })
  }

  // Build depth info using parent_id relationships
  const parentMap = new Map<string | null, typeof data>()
  for (const row of data) {
    const parent = row.parent_id ?? null
    if (!parentMap.has(parent)) parentMap.set(parent, [])
    parentMap.get(parent)!.push(row)
  }

  // BFS to assign depth
  const navPages: NavPage[] = []
  const queue: { parentId: string | null; depth: number }[] = [{ parentId: null, depth: 0 }]

  while (queue.length > 0) {
    const { parentId, depth } = queue.shift()!
    const children = parentMap.get(parentId) ?? []
    for (const child of children) {
      navPages.push({
        id: child.id,
        title: child.title,
        slug: child.slug,
        parentId: child.parent_id,
        orderIndex: child.order_index,
        visibility: child.visibility as Visibility,
        depth,
      })
      queue.push({ parentId: child.id, depth: depth + 1 })
    }
  }

  const tree = buildNavTree(navPages)

  return NextResponse.json({ tree }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
