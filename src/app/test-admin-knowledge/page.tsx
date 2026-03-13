'use client'

import { useState } from 'react'
import { VisibilityBadge } from '@/components/knowledge/VisibilityBadge'
import type { Visibility, ContentStatus } from '@/lib/supabase/database.types'

/**
 * Test page for admin knowledge CMS E2E tests.
 * Renders the admin knowledge page list with mock data, bypassing auth and DB calls.
 */

interface MockAdminPage {
  id: string
  title: string
  slug: string
  parent_id: string | null
  order_index: number
  status: ContentStatus
  visibility: Visibility
  updated_at: string
  depth: number
}

const mockPages: MockAdminPage[] = [
  {
    id: 'sec-1',
    title: 'Getting Started',
    slug: 'getting-started',
    parent_id: null,
    order_index: 0,
    status: 'published',
    visibility: 'public',
    updated_at: '2026-03-12T10:00:00Z',
    depth: 0,
  },
  {
    id: 'page-1',
    title: 'How to use Throughput',
    slug: 'how-to-use-throughput',
    parent_id: 'sec-1',
    order_index: 0,
    status: 'published',
    visibility: 'public',
    updated_at: '2026-03-12T10:00:00Z',
    depth: 1,
  },
  {
    id: 'page-2',
    title: 'Your Learning Path',
    slug: 'your-learning-path',
    parent_id: 'sec-1',
    order_index: 1,
    status: 'draft',
    visibility: 'internal',
    updated_at: '2026-03-10T14:00:00Z',
    depth: 1,
  },
  {
    id: 'sec-2',
    title: 'AAVA Methodology',
    slug: 'aava-methodology',
    parent_id: null,
    order_index: 1,
    status: 'published',
    visibility: 'internal',
    updated_at: '2026-03-11T09:00:00Z',
    depth: 0,
  },
  {
    id: 'page-3',
    title: 'Goals & OKRs',
    slug: 'goals-okrs',
    parent_id: 'sec-2',
    order_index: 0,
    status: 'published',
    visibility: 'internal',
    updated_at: '2026-03-11T09:00:00Z',
    depth: 1,
  },
  {
    id: 'sec-3',
    title: 'Sales Resources',
    slug: 'sales-resources',
    parent_id: null,
    order_index: 2,
    status: 'draft',
    visibility: 'group:sales',
    updated_at: '2026-03-09T16:00:00Z',
    depth: 0,
  },
  {
    id: 'page-4',
    title: 'Pitch Deck Guide',
    slug: 'pitch-deck-guide',
    parent_id: 'sec-3',
    order_index: 0,
    status: 'draft',
    visibility: 'group:sales',
    updated_at: '2026-03-09T16:00:00Z',
    depth: 1,
  },
]

export default function TestAdminKnowledgePage() {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Knowledge Pages</h1>
          <button
            data-testid="new-page-button"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-accent-hover"
          >
            New Page
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-foreground-muted">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Visibility</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockPages.map((page) => (
                <tr
                  key={page.id}
                  className="border-b border-border-subtle last:border-0"
                  data-testid="knowledge-page-row"
                >
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center gap-2"
                      style={{ paddingLeft: `${page.depth * 20}px` }}
                    >
                      <svg
                        className="size-4 shrink-0 cursor-grab text-foreground-muted"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                        />
                      </svg>
                      <span className="font-medium text-foreground">{page.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <VisibilityBadge visibility={page.visibility} />
                  </td>
                  <td className="px-4 py-3">
                    {page.status === 'draft' ? (
                      <span
                        className="rounded-full bg-warning-muted px-2 py-0.5 text-xs font-medium text-warning"
                        data-testid="status-badge-draft"
                      >
                        DRAFT
                      </span>
                    ) : (
                      <span
                        className="rounded-full bg-success-muted px-2 py-0.5 text-xs font-medium text-success"
                        data-testid="status-badge-published"
                      >
                        PUBLISHED
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {new Date(page.updated_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/admin/knowledge/${page.id}`}
                        className="rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-raised"
                        data-testid="edit-button"
                      >
                        Edit
                      </a>
                      {deleteConfirm === page.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="rounded-md bg-destructive px-3 py-1 text-xs font-medium text-white"
                            data-testid="confirm-delete-button"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground-muted"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(page.id)}
                          className="rounded-md border border-border px-3 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive-muted"
                          data-testid="delete-button"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
