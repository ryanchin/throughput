'use client'

import { KnowledgeSidebar } from '@/components/knowledge/KnowledgeSidebar'
import { VisibilityBadge } from '@/components/knowledge/VisibilityBadge'
import type { NavTreeNode } from '@/lib/knowledge/nav-tree'
import type { Visibility } from '@/lib/supabase/database.types'

/**
 * Test page for knowledge browse E2E tests.
 * Renders the knowledge home experience with mock data, bypassing auth and DB calls.
 */

const mockNavTree: NavTreeNode[] = [
  {
    id: 'sec-1',
    title: 'Getting Started',
    slug: 'getting-started',
    visibility: 'public',
    fullPath: 'getting-started',
    children: [
      {
        id: 'page-1',
        title: 'How to use Throughput',
        slug: 'how-to-use-throughput',
        visibility: 'public',
        fullPath: 'getting-started/how-to-use-throughput',
        children: [],
      },
      {
        id: 'page-2',
        title: 'Your Learning Path',
        slug: 'your-learning-path',
        visibility: 'internal',
        fullPath: 'getting-started/your-learning-path',
        children: [],
      },
    ],
  },
  {
    id: 'sec-2',
    title: 'AAVA Methodology',
    slug: 'aava-methodology',
    visibility: 'internal',
    fullPath: 'aava-methodology',
    children: [
      {
        id: 'page-3',
        title: 'Goals & OKRs',
        slug: 'goals-okrs',
        visibility: 'internal',
        fullPath: 'aava-methodology/goals-okrs',
        children: [],
      },
      {
        id: 'page-4',
        title: 'Sprint Planning',
        slug: 'sprint-planning',
        visibility: 'internal',
        fullPath: 'aava-methodology/sprint-planning',
        children: [],
      },
    ],
  },
  {
    id: 'sec-3',
    title: 'Sales Resources',
    slug: 'sales-resources',
    visibility: 'group:sales',
    fullPath: 'sales-resources',
    children: [
      {
        id: 'page-5',
        title: 'Pitch Deck Guide',
        slug: 'pitch-deck-guide',
        visibility: 'group:sales',
        fullPath: 'sales-resources/pitch-deck-guide',
        children: [],
      },
    ],
  },
]

interface MockPage {
  id: string
  title: string
  slug: string
  visibility: Visibility
  updated_at: string
}

const mockRecentPages: MockPage[] = [
  {
    id: 'page-1',
    title: 'How to use Throughput',
    slug: 'getting-started/how-to-use-throughput',
    visibility: 'public',
    updated_at: '2026-03-12T10:00:00Z',
  },
  {
    id: 'page-3',
    title: 'Goals & OKRs',
    slug: 'aava-methodology/goals-okrs',
    visibility: 'internal',
    updated_at: '2026-03-11T14:30:00Z',
  },
  {
    id: 'page-4',
    title: 'Sprint Planning',
    slug: 'aava-methodology/sprint-planning',
    visibility: 'internal',
    updated_at: '2026-03-10T09:00:00Z',
  },
  {
    id: 'page-5',
    title: 'Pitch Deck Guide',
    slug: 'sales-resources/pitch-deck-guide',
    visibility: 'group:sales',
    updated_at: '2026-03-09T16:00:00Z',
  },
  {
    id: 'page-2',
    title: 'Your Learning Path',
    slug: 'getting-started/your-learning-path',
    visibility: 'internal',
    updated_at: '2026-03-08T11:00:00Z',
  },
]

export default function TestKnowledgePage() {
  return (
    <div className="flex min-h-screen bg-background">
      <KnowledgeSidebar tree={mockNavTree} currentPath="" />

      <div className="flex-1 px-8 py-8">
        {/* Hero */}
        <div className="mb-8">
          <h1 className="bg-gradient-brand bg-clip-text text-3xl font-bold text-transparent">
            Knowledge Base
          </h1>
          <p className="mt-2 text-foreground-muted">
            Browse guides, references, and how-tos to help you work effectively.
          </p>
        </div>

        {/* Recently Updated */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Recently Updated</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mockRecentPages.map((page) => (
              <a
                key={page.id}
                href={`/knowledge/${page.slug}`}
                className="group rounded-xl border border-border bg-surface p-5 shadow-card transition-colors hover:border-accent"
                data-testid="knowledge-page-card"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-foreground group-hover:text-accent">
                    {page.title}
                  </h3>
                  <VisibilityBadge visibility={page.visibility} />
                </div>
                <p className="text-xs text-foreground-muted">
                  Updated{' '}
                  {new Date(page.updated_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
