import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth/getProfile'
import { fetchNavPages, fetchPageBySlug, fetchUserGroups } from '@/lib/knowledge/queries'
import { buildNavTree, filterNavTree, canAccessVisibility, buildBreadcrumbs } from '@/lib/knowledge/nav-tree'
import type { Visibility } from '@/lib/supabase/database.types'

/**
 * GET /api/knowledge/[...slug]
 * Returns a single knowledge page by its slug path, along with
 * the filtered nav tree and breadcrumbs for sidebar context.
 * Authenticated users only. Returns 404 for inaccessible pages
 * to avoid revealing existence.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const profile = await getProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params
  const slugPath = slug.join('/')

  const page = await fetchPageBySlug(slugPath)
  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  }

  const userGroups = await fetchUserGroups(profile.id)

  // Check visibility — return 404 (not 403) to avoid revealing existence
  if (!canAccessVisibility(page.visibility as Visibility, userGroups, true)) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  }

  // Build filtered nav tree for sidebar context
  const navPages = await fetchNavPages()
  const tree = buildNavTree(navPages)
  const filteredTree = filterNavTree(tree, userGroups, true)
  const breadcrumbs = buildBreadcrumbs(filteredTree, slugPath)

  return NextResponse.json({ page, breadcrumbs, tree: filteredTree })
}
