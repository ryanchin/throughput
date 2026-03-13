'use client'

import dynamic from 'next/dynamic'
import { KnowledgeSidebar } from '@/components/knowledge/KnowledgeSidebar'
import type { NavTreeNode } from '@/lib/knowledge/nav-tree'
import type { JSONContent } from '@tiptap/react'

const LessonViewer = dynamic(() => import('@/components/editor/LessonViewer'), { ssr: false })

/**
 * Test page for knowledge page view E2E tests.
 * Renders a single knowledge page with sidebar, breadcrumbs, and content viewer.
 * Bypasses auth and DB calls.
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
    ],
  },
]

const mockContent: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'How to use Throughput' }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Throughput is your central hub for training, knowledge, and certifications. This guide walks you through the key areas of the platform.',
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Getting Started' }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'After logging in, you will see the main navigation with links to Training, Knowledge, and Certifications. Start by exploring the courses available to you.',
        },
      ],
    },
  ],
}

const mockBreadcrumbs = [
  { title: 'Getting Started', path: 'getting-started' },
  { title: 'How to use Throughput', path: 'getting-started/how-to-use-throughput' },
]

const currentPath = 'getting-started/how-to-use-throughput'

export default function TestKnowledgePageView() {
  return (
    <div className="flex min-h-screen bg-background">
      <KnowledgeSidebar tree={mockNavTree} currentPath={currentPath} />

      <div className="flex-1 px-8 py-8">
        {/* Breadcrumbs */}
        <nav className="mb-4 flex items-center gap-1.5 text-sm" aria-label="Breadcrumb" data-testid="breadcrumbs">
          <a
            href="/knowledge"
            className="text-foreground-muted transition-colors hover:text-foreground"
          >
            Knowledge
          </a>
          {mockBreadcrumbs.map((crumb, index) => {
            const isLast = index === mockBreadcrumbs.length - 1
            return (
              <span key={crumb.path} className="flex items-center gap-1.5">
                <svg
                  className="size-3 text-foreground-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
                {isLast ? (
                  <span className="text-foreground" data-testid="breadcrumb-current">{crumb.title}</span>
                ) : (
                  <a
                    href={`/knowledge/${crumb.path}`}
                    className="text-foreground-muted transition-colors hover:text-foreground"
                  >
                    {crumb.title}
                  </a>
                )}
              </span>
            )
          })}
        </nav>

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">
            How to use Throughput
          </h1>
          <p className="mt-2 text-sm text-foreground-muted">
            Last updated March 12, 2026
          </p>
        </div>

        {/* Page content */}
        <LessonViewer content={mockContent} />
      </div>
    </div>
  )
}
