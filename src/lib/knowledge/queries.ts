import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Visibility } from '@/lib/supabase/database.types'
import type { NavPage } from './nav-tree'

/**
 * Fetches the full nav tree for the knowledge section.
 * Uses the authenticated client so RLS filters by visibility.
 */
export async function fetchNavPages(): Promise<NavPage[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('docs_pages')
    .select('id, title, slug, parent_id, order_index, visibility')
    .eq('status', 'published')
    .order('order_index', { ascending: true })

  if (error || !data) return []

  // Build depth info using parent_id relationships
  const parentMap = new Map<string | null, typeof data>()
  for (const row of data) {
    const parent = row.parent_id ?? null
    if (!parentMap.has(parent)) parentMap.set(parent, [])
    parentMap.get(parent)!.push(row)
  }

  // BFS to assign depth
  const result: NavPage[] = []
  const queue: { parentId: string | null; depth: number }[] = [{ parentId: null, depth: 0 }]

  while (queue.length > 0) {
    const { parentId, depth } = queue.shift()!
    const children = parentMap.get(parentId) ?? []
    for (const child of children) {
      result.push({
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

  return result
}

/**
 * Fetches a single knowledge page by slug path.
 * Returns null if not found or not accessible.
 */
export async function fetchPageBySlug(slugPath: string) {
  const supabase = await createClient()
  const slugParts = slugPath.split('/')
  const targetSlug = slugParts[slugParts.length - 1]

  const { data: pages, error } = await supabase
    .from('docs_pages')
    .select('id, title, slug, content, parent_id, visibility, updated_at, created_by')
    .eq('slug', targetSlug)
    .eq('status', 'published')

  if (error || !pages || pages.length === 0) return null

  // If multiple pages share the same slug, match by parent chain
  if (pages.length === 1) return pages[0]

  // For nested slugs, verify the parent chain matches
  for (const page of pages) {
    if (await verifySlugChain(supabase, page, slugParts)) {
      return page
    }
  }

  return pages[0]
}

async function verifySlugChain(
  supabase: Awaited<ReturnType<typeof createClient>>,
  page: { parent_id: string | null; slug: string },
  slugParts: string[]
): Promise<boolean> {
  if (slugParts.length === 1) return page.parent_id === null

  let currentParentId = page.parent_id
  for (let i = slugParts.length - 2; i >= 0; i--) {
    if (!currentParentId) return false
    const { data: parent } = await supabase
      .from('docs_pages')
      .select('id, slug, parent_id')
      .eq('id', currentParentId)
      .single()

    if (!parent || parent.slug !== slugParts[i]) return false
    currentParentId = parent.parent_id
  }
  return currentParentId === null
}

/**
 * Fetches user's group memberships.
 */
export async function fetchUserGroups(userId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_groups')
    .select('group_name')
    .eq('user_id', userId)

  return data?.map(g => g.group_name) ?? []
}

/**
 * Fetches all docs pages for admin (all statuses, all visibilities).
 */
export async function fetchAllPagesAdmin() {
  const serviceClient = createServiceClient()

  const { data, error } = await serviceClient
    .from('docs_pages')
    .select('id, title, slug, parent_id, order_index, status, visibility, updated_at')
    .order('order_index', { ascending: true })

  return { data: data ?? [], error }
}

/**
 * Fetches recently updated published knowledge pages.
 */
export async function fetchRecentPages(limit = 10) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('docs_pages')
    .select('id, title, slug, parent_id, visibility, updated_at')
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .limit(limit)

  return data ?? []
}
