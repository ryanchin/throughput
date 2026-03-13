import { describe, it, expect } from 'vitest'
import {
  buildNavTree,
  filterNavTree,
  canAccessVisibility,
  findNodeByPath,
  buildBreadcrumbs,
  type NavPage,
  type NavTreeNode,
} from '@/lib/knowledge/nav-tree'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePage(overrides: Partial<NavPage> & Pick<NavPage, 'id' | 'title' | 'slug'>): NavPage {
  return {
    parentId: null,
    orderIndex: 0,
    visibility: 'public',
    depth: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildNavTree
// ---------------------------------------------------------------------------

describe('buildNavTree', () => {
  it('builds flat rows into nested tree (1 root with 2 children)', () => {
    const rows: NavPage[] = [
      makePage({ id: 'r1', title: 'Root', slug: 'root', depth: 0 }),
      makePage({ id: 'c1', title: 'Child 1', slug: 'child-1', parentId: 'r1', depth: 1 }),
      makePage({ id: 'c2', title: 'Child 2', slug: 'child-2', parentId: 'r1', depth: 1 }),
    ]

    const tree = buildNavTree(rows)

    expect(tree).toHaveLength(1)
    expect(tree[0].title).toBe('Root')
    expect(tree[0].children).toHaveLength(2)
    expect(tree[0].children[0].title).toBe('Child 1')
    expect(tree[0].children[1].title).toBe('Child 2')
  })

  it('handles deeply nested (3 levels)', () => {
    const rows: NavPage[] = [
      makePage({ id: 'r1', title: 'Level 0', slug: 'level-0', depth: 0 }),
      makePage({ id: 'c1', title: 'Level 1', slug: 'level-1', parentId: 'r1', depth: 1 }),
      makePage({ id: 'g1', title: 'Level 2', slug: 'level-2', parentId: 'c1', depth: 2 }),
    ]

    const tree = buildNavTree(rows)

    expect(tree).toHaveLength(1)
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].children).toHaveLength(1)
    expect(tree[0].children[0].children[0].title).toBe('Level 2')
  })

  it('returns empty array for empty input', () => {
    expect(buildNavTree([])).toEqual([])
  })

  it('constructs fullPath correctly (parent/child)', () => {
    const rows: NavPage[] = [
      makePage({ id: 'r1', title: 'Getting Started', slug: 'getting-started', depth: 0 }),
      makePage({
        id: 'c1',
        title: 'Overview',
        slug: 'overview',
        parentId: 'r1',
        depth: 1,
      }),
    ]

    const tree = buildNavTree(rows)

    expect(tree[0].fullPath).toBe('getting-started')
    expect(tree[0].children[0].fullPath).toBe('getting-started/overview')
  })

  it('constructs fullPath correctly for 3 levels deep', () => {
    const rows: NavPage[] = [
      makePage({ id: 'r1', title: 'A', slug: 'a', depth: 0 }),
      makePage({ id: 'c1', title: 'B', slug: 'b', parentId: 'r1', depth: 1 }),
      makePage({ id: 'g1', title: 'C', slug: 'c', parentId: 'c1', depth: 2 }),
    ]

    const tree = buildNavTree(rows)

    expect(tree[0].children[0].children[0].fullPath).toBe('a/b/c')
  })

  it('handles orphaned children (parent not in rows) — they become roots', () => {
    const rows: NavPage[] = [
      makePage({ id: 'c1', title: 'Orphan', slug: 'orphan', parentId: 'missing-parent', depth: 1 }),
      makePage({ id: 'r1', title: 'Real Root', slug: 'real-root', depth: 0 }),
    ]

    const tree = buildNavTree(rows)

    // Both should be roots since the parent of 'Orphan' doesn't exist
    expect(tree).toHaveLength(2)
    const titles = tree.map(n => n.title)
    expect(titles).toContain('Orphan')
    expect(titles).toContain('Real Root')
  })

  it('preserves ordering from input rows', () => {
    const rows: NavPage[] = [
      makePage({ id: 'r1', title: 'Root', slug: 'root', depth: 0 }),
      makePage({ id: 'c1', title: 'First', slug: 'first', parentId: 'r1', orderIndex: 0, depth: 1 }),
      makePage({ id: 'c2', title: 'Second', slug: 'second', parentId: 'r1', orderIndex: 1, depth: 1 }),
      makePage({ id: 'c3', title: 'Third', slug: 'third', parentId: 'r1', orderIndex: 2, depth: 1 }),
    ]

    const tree = buildNavTree(rows)

    expect(tree[0].children.map(c => c.title)).toEqual(['First', 'Second', 'Third'])
  })
})

// ---------------------------------------------------------------------------
// canAccessVisibility
// ---------------------------------------------------------------------------

describe('canAccessVisibility', () => {
  it("'public' returns true always (not authenticated, no groups)", () => {
    expect(canAccessVisibility('public', [], false)).toBe(true)
  })

  it("'public' returns true when authenticated", () => {
    expect(canAccessVisibility('public', [], true)).toBe(true)
  })

  it("'internal' returns true when authenticated", () => {
    expect(canAccessVisibility('internal', [], true)).toBe(true)
  })

  it("'internal' returns false when not authenticated", () => {
    expect(canAccessVisibility('internal', [], false)).toBe(false)
  })

  it("'group:sales' returns true when user is in ['sales'] group and authenticated", () => {
    expect(canAccessVisibility('group:sales', ['sales'], true)).toBe(true)
  })

  it("'group:sales' returns false when user is in ['engineering'] group", () => {
    expect(canAccessVisibility('group:sales', ['engineering'], true)).toBe(false)
  })

  it("'group:sales' returns false when not authenticated even if in group", () => {
    expect(canAccessVisibility('group:sales', ['sales'], false)).toBe(false)
  })

  it('returns false for unknown visibility format', () => {
    // Cast to satisfy TS — tests runtime safety for unexpected values
    expect(canAccessVisibility('unknown' as never, [], true)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// filterNavTree
// ---------------------------------------------------------------------------

describe('filterNavTree', () => {
  // Helper to build a simple tree for filter tests
  function makeNode(overrides: Partial<NavTreeNode> & Pick<NavTreeNode, 'id' | 'title' | 'slug' | 'fullPath'>): NavTreeNode {
    return {
      visibility: 'public',
      children: [],
      ...overrides,
    }
  }

  it("returns all nodes for 'public' visibility when not authenticated", () => {
    const tree: NavTreeNode[] = [
      makeNode({ id: '1', title: 'Public Page', slug: 'public', fullPath: 'public', visibility: 'public' }),
      makeNode({ id: '2', title: 'Another Public', slug: 'another', fullPath: 'another', visibility: 'public' }),
    ]

    const filtered = filterNavTree(tree, [], false)

    expect(filtered).toHaveLength(2)
  })

  it("filters out 'internal' nodes when not authenticated", () => {
    const tree: NavTreeNode[] = [
      makeNode({ id: '1', title: 'Public', slug: 'public', fullPath: 'public', visibility: 'public' }),
      makeNode({ id: '2', title: 'Internal', slug: 'internal', fullPath: 'internal', visibility: 'internal' }),
    ]

    const filtered = filterNavTree(tree, [], false)

    expect(filtered).toHaveLength(1)
    expect(filtered[0].title).toBe('Public')
  })

  it("shows 'internal' nodes when authenticated", () => {
    const tree: NavTreeNode[] = [
      makeNode({ id: '1', title: 'Public', slug: 'public', fullPath: 'public', visibility: 'public' }),
      makeNode({ id: '2', title: 'Internal', slug: 'internal', fullPath: 'internal', visibility: 'internal' }),
    ]

    const filtered = filterNavTree(tree, [], true)

    expect(filtered).toHaveLength(2)
  })

  it("filters out group:sales when user is not in sales group", () => {
    const tree: NavTreeNode[] = [
      makeNode({ id: '1', title: 'Public', slug: 'public', fullPath: 'public', visibility: 'public' }),
      makeNode({ id: '2', title: 'Sales Only', slug: 'sales', fullPath: 'sales', visibility: 'group:sales' }),
    ]

    const filtered = filterNavTree(tree, ['engineering'], true)

    expect(filtered).toHaveLength(1)
    expect(filtered[0].title).toBe('Public')
  })

  it("shows group:sales when user IS in sales group", () => {
    const tree: NavTreeNode[] = [
      makeNode({ id: '1', title: 'Public', slug: 'public', fullPath: 'public', visibility: 'public' }),
      makeNode({ id: '2', title: 'Sales Only', slug: 'sales', fullPath: 'sales', visibility: 'group:sales' }),
    ]

    const filtered = filterNavTree(tree, ['sales'], true)

    expect(filtered).toHaveLength(2)
  })

  it('recursively filters children', () => {
    const tree: NavTreeNode[] = [
      makeNode({
        id: '1',
        title: 'Root',
        slug: 'root',
        fullPath: 'root',
        visibility: 'public',
        children: [
          makeNode({ id: '2', title: 'Public Child', slug: 'pub-child', fullPath: 'root/pub-child', visibility: 'public' }),
          makeNode({ id: '3', title: 'Internal Child', slug: 'int-child', fullPath: 'root/int-child', visibility: 'internal' }),
        ],
      }),
    ]

    const filtered = filterNavTree(tree, [], false)

    expect(filtered).toHaveLength(1)
    expect(filtered[0].children).toHaveLength(1)
    expect(filtered[0].children[0].title).toBe('Public Child')
  })

  it('removes parent and children if parent is inaccessible', () => {
    const tree: NavTreeNode[] = [
      makeNode({
        id: '1',
        title: 'Internal Root',
        slug: 'internal-root',
        fullPath: 'internal-root',
        visibility: 'internal',
        children: [
          makeNode({ id: '2', title: 'Public Child', slug: 'pub-child', fullPath: 'internal-root/pub-child', visibility: 'public' }),
        ],
      }),
    ]

    const filtered = filterNavTree(tree, [], false)

    // Parent is internal, not authenticated => entire subtree is gone
    expect(filtered).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// findNodeByPath
// ---------------------------------------------------------------------------

describe('findNodeByPath', () => {
  const tree: NavTreeNode[] = buildNavTree([
    makePage({ id: 'r1', title: 'Getting Started', slug: 'getting-started', depth: 0 }),
    makePage({ id: 'c1', title: 'Overview', slug: 'overview', parentId: 'r1', depth: 1 }),
    makePage({ id: 'r2', title: 'Templates', slug: 'templates', depth: 0 }),
  ])

  it('finds root node by path', () => {
    const node = findNodeByPath(tree, 'getting-started')

    expect(node).not.toBeNull()
    expect(node!.title).toBe('Getting Started')
  })

  it('finds nested node by full path', () => {
    const node = findNodeByPath(tree, 'getting-started/overview')

    expect(node).not.toBeNull()
    expect(node!.title).toBe('Overview')
  })

  it('returns null for non-existent path', () => {
    const node = findNodeByPath(tree, 'does-not-exist')

    expect(node).toBeNull()
  })

  it('returns null for partial path match', () => {
    const node = findNodeByPath(tree, 'getting')

    expect(node).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// buildBreadcrumbs
// ---------------------------------------------------------------------------

describe('buildBreadcrumbs', () => {
  const tree: NavTreeNode[] = buildNavTree([
    makePage({ id: 'r1', title: 'Getting Started', slug: 'getting-started', depth: 0 }),
    makePage({ id: 'c1', title: 'Overview', slug: 'overview', parentId: 'r1', depth: 1 }),
    makePage({ id: 'g1', title: 'Details', slug: 'details', parentId: 'c1', depth: 2 }),
    makePage({ id: 'r2', title: 'Templates', slug: 'templates', depth: 0 }),
  ])

  it('returns breadcrumbs for root page', () => {
    const crumbs = buildBreadcrumbs(tree, 'getting-started')

    expect(crumbs).toEqual([
      { title: 'Getting Started', path: 'getting-started' },
    ])
  })

  it('returns breadcrumbs for nested page (parent -> child)', () => {
    const crumbs = buildBreadcrumbs(tree, 'getting-started/overview')

    expect(crumbs).toEqual([
      { title: 'Getting Started', path: 'getting-started' },
      { title: 'Overview', path: 'getting-started/overview' },
    ])
  })

  it('returns breadcrumbs for deeply nested page (3 levels)', () => {
    const crumbs = buildBreadcrumbs(tree, 'getting-started/overview/details')

    expect(crumbs).toEqual([
      { title: 'Getting Started', path: 'getting-started' },
      { title: 'Overview', path: 'getting-started/overview' },
      { title: 'Details', path: 'getting-started/overview/details' },
    ])
  })

  it('returns empty array for non-existent path', () => {
    const crumbs = buildBreadcrumbs(tree, 'does-not-exist')

    expect(crumbs).toEqual([])
  })

  it('returns empty array for empty tree', () => {
    const crumbs = buildBreadcrumbs([], 'anything')

    expect(crumbs).toEqual([])
  })
})
