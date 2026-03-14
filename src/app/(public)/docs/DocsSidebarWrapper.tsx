'use client'

import { usePathname } from 'next/navigation'
import { DocsSidebarShadcn } from '@/components/docs/DocsSidebarShadcn'
import type { NavTreeNode } from '@/lib/knowledge/nav-tree'

interface DocsSidebarWrapperProps {
  tree: NavTreeNode[]
}

export function DocsSidebarWrapper({ tree }: DocsSidebarWrapperProps) {
  const pathname = usePathname()
  // Extract the slug from /docs/getting-started/what-is-aava -> getting-started/what-is-aava
  const currentSlug = pathname.replace(/^\/docs\/?/, '')

  return <DocsSidebarShadcn tree={tree} currentSlug={currentSlug} />
}
