'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import type { NavTreeNode } from '@/lib/knowledge/nav-tree'

interface KnowledgeSidebarProps {
  tree: NavTreeNode[]
  currentPath: string
}

export function KnowledgeSidebar({ tree, currentPath }: KnowledgeSidebarProps) {
  return (
    <nav className="w-64 shrink-0 border-r border-border bg-surface" data-testid="knowledge-sidebar">
      <div className="px-4 py-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          Knowledge Base
        </h2>
      </div>
      <div className="space-y-0.5 px-2 pb-6">
        {tree.map((node) => (
          <SidebarNode key={node.id} node={node} currentPath={currentPath} depth={0} />
        ))}
      </div>
    </nav>
  )
}

interface SidebarNodeProps {
  node: NavTreeNode
  currentPath: string
  depth: number
}

function SidebarNode({ node, currentPath, depth }: SidebarNodeProps) {
  const isActive = currentPath === node.fullPath
  const containsActive = currentPath.startsWith(node.fullPath + '/')
  const hasChildren = node.children.length > 0

  const [expanded, setExpanded] = useState(isActive || containsActive)

  const toggleExpand = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  return (
    <div>
      <div
        className="flex items-center"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {/* Chevron for sections with children */}
        {hasChildren ? (
          <button
            onClick={toggleExpand}
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
          href={`/knowledge/${node.fullPath}`}
          className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
            isActive
              ? 'bg-raised text-accent'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          {node.title}
        </Link>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="mt-0.5">
          {node.children.map((child) => (
            <SidebarNode
              key={child.id}
              node={child}
              currentPath={currentPath}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
