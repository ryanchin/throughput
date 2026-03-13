import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth/getProfile'
import { fetchNavPages, fetchUserGroups } from '@/lib/knowledge/queries'
import { buildNavTree, filterNavTree } from '@/lib/knowledge/nav-tree'

/**
 * GET /api/knowledge/nav
 * Returns the filtered knowledge navigation tree for the current user.
 * Authenticated users only (employee, sales, admin).
 */
export async function GET() {
  const profile = await getProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const navPages = await fetchNavPages()
  const tree = buildNavTree(navPages)
  const userGroups = await fetchUserGroups(profile.id)
  const filteredTree = filterNavTree(tree, userGroups, true)

  return NextResponse.json({ tree: filteredTree })
}
