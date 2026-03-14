import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { buildNavTree } from '@/lib/knowledge/nav-tree'
import type { NavPage } from '@/lib/knowledge/nav-tree'
import type { Visibility } from '@/lib/supabase/database.types'
import { DocsSidebarWrapper } from './DocsSidebarWrapper'

async function getDocsNavTree() {
  const serviceClient = createServiceClient()

  const { data, error } = await serviceClient
    .from('docs_pages')
    .select('id, title, slug, parent_id, order_index, visibility')
    .eq('status', 'published')
    .eq('type', 'docs')
    .order('order_index', { ascending: true })

  if (error || !data || data.length === 0) {
    // Fallback: no DB docs pages found, return empty tree
    return []
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

  return buildNavTree(navPages)
}

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const tree = await getDocsNavTree()

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Docs top nav */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="bg-gradient-brand bg-clip-text text-lg font-bold text-transparent">
              AAVA
            </Link>
            <span className="rounded-md bg-accent-muted px-2 py-0.5 text-xs font-medium text-accent">
              Docs
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/certifications"
              className="text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
            >
              Get Certified
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      <div className="flex">
        <DocsSidebarWrapper tree={tree} />
        <main className="min-w-0 flex-1 px-6 py-8 lg:px-12">
          {children}
        </main>
      </div>
    </div>
  )
}
