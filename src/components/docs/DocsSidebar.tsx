'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { NavTreeNode } from '@/lib/knowledge/nav-tree'

interface DocsSidebarProps {
  tree: NavTreeNode[]
  currentSlug: string
}

export function DocsSidebar({ tree, currentSlug }: DocsSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-background shadow-accent-glow lg:hidden"
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          {mobileOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          )}
        </svg>
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-40 h-full w-72 shrink-0 overflow-y-auto border-r border-border bg-surface
          transition-transform duration-200
          lg:sticky lg:top-14 lg:z-0 lg:h-[calc(100vh-3.5rem)] lg:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="px-4 py-5">
          <Link href="/docs" className="text-xs font-semibold uppercase tracking-wider text-foreground-muted hover:text-foreground">
            Documentation
          </Link>
        </div>
        <nav className="space-y-0.5 px-2 pb-6" data-testid="docs-sidebar">
          {tree.map((node) => (
            <SidebarNode
              key={node.id}
              node={node}
              currentSlug={currentSlug}
              depth={0}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
        </nav>
      </aside>
    </>
  )
}

interface SidebarNodeProps {
  node: NavTreeNode
  currentSlug: string
  depth: number
  onNavigate: () => void
}

function SidebarNode({ node, currentSlug, depth, onNavigate }: SidebarNodeProps) {
  const isActive = currentSlug === node.fullPath
  const containsActive = currentSlug.startsWith(node.fullPath + '/')
  const hasChildren = node.children.length > 0

  const [expanded, setExpanded] = useState(isActive || containsActive)

  return (
    <div>
      <div
        className="flex items-center"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="mr-1 flex size-5 shrink-0 items-center justify-center rounded text-foreground-muted hover:text-foreground"
            aria-label={expanded ? 'Collapse section' : 'Expand section'}
          >
            <svg
              className={`size-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        ) : (
          <span className="mr-1 w-5 shrink-0" />
        )}

        <Link
          href={`/docs/${node.fullPath}`}
          onClick={onNavigate}
          className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
            isActive
              ? 'bg-raised text-accent'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          {node.title}
        </Link>
      </div>

      {hasChildren && expanded && (
        <div className="mt-0.5">
          {node.children.map((child) => (
            <SidebarNode
              key={child.id}
              node={child}
              currentSlug={currentSlug}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
