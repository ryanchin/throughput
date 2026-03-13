import type { Visibility } from '@/lib/supabase/database.types'

export interface NavPage {
  id: string
  title: string
  slug: string
  parentId: string | null
  orderIndex: number
  visibility: Visibility
  depth: number
}

export interface NavTreeNode {
  id: string
  title: string
  slug: string
  visibility: Visibility
  fullPath: string
  children: NavTreeNode[]
}

/**
 * Builds a nested tree structure from flat nav rows (with parent_id/depth).
 * Rows must be sorted by depth ASC, order_index ASC.
 */
export function buildNavTree(rows: NavPage[]): NavTreeNode[] {
  const nodeMap = new Map<string, NavTreeNode>()
  const roots: NavTreeNode[] = []

  for (const row of rows) {
    const parentNode = row.parentId ? nodeMap.get(row.parentId) : null
    const parentPath = parentNode ? parentNode.fullPath : ''

    const node: NavTreeNode = {
      id: row.id,
      title: row.title,
      slug: row.slug,
      visibility: row.visibility,
      fullPath: parentPath ? `${parentPath}/${row.slug}` : row.slug,
      children: [],
    }

    nodeMap.set(row.id, node)

    if (row.parentId && parentNode) {
      parentNode.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

/**
 * Filters nav tree nodes based on user visibility access.
 */
export function filterNavTree(
  nodes: NavTreeNode[],
  userGroups: string[],
  isAuthenticated: boolean
): NavTreeNode[] {
  return nodes
    .filter(node => canAccessVisibility(node.visibility, userGroups, isAuthenticated))
    .map(node => ({
      ...node,
      children: filterNavTree(node.children, userGroups, isAuthenticated),
    }))
}

/**
 * Checks if a user can access content with the given visibility level.
 */
export function canAccessVisibility(
  visibility: Visibility,
  userGroups: string[],
  isAuthenticated: boolean
): boolean {
  if (visibility === 'public') return true
  if (visibility === 'internal') return isAuthenticated
  if (visibility.startsWith('group:')) {
    const groupName = visibility.slice(6)
    return isAuthenticated && userGroups.includes(groupName)
  }
  return false
}

/**
 * Finds a node in the tree by its full path (slug chain).
 */
export function findNodeByPath(nodes: NavTreeNode[], path: string): NavTreeNode | null {
  for (const node of nodes) {
    if (node.fullPath === path) return node
    const found = findNodeByPath(node.children, path)
    if (found) return found
  }
  return null
}

/**
 * Builds breadcrumb trail from root to the given path.
 */
export function buildBreadcrumbs(
  nodes: NavTreeNode[],
  path: string
): { title: string; path: string }[] {
  const result: { title: string; path: string }[] = []

  function search(tree: NavTreeNode[], target: string): boolean {
    for (const node of tree) {
      if (node.fullPath === target || target.startsWith(node.fullPath + '/')) {
        result.push({ title: node.title, path: node.fullPath })
        if (node.fullPath === target) return true
        if (search(node.children, target)) return true
        result.pop()
      }
    }
    return false
  }

  search(nodes, path)
  return result
}
