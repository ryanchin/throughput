'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ContentStatus } from '@/lib/supabase/database.types'

interface AdminPage {
  id: string
  title: string
  slug: string
  parent_id: string | null
  order_index: number
  status: ContentStatus
  visibility: string
  updated_at: string
}

interface FlatPage extends AdminPage {
  depth: number
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function flattenWithDepth(pages: AdminPage[]): FlatPage[] {
  const childrenMap = new Map<string | null, AdminPage[]>()
  for (const page of pages) {
    const key = page.parent_id ?? null
    if (!childrenMap.has(key)) childrenMap.set(key, [])
    childrenMap.get(key)!.push(page)
  }

  const result: FlatPage[] = []

  function walk(parentId: string | null, depth: number) {
    const children = childrenMap.get(parentId) ?? []
    children.sort((a, b) => a.order_index - b.order_index)
    for (const child of children) {
      result.push({ ...child, depth })
      walk(child.id, depth + 1)
    }
  }

  walk(null, 0)
  return result
}

export default function AdminDocsPage() {
  const router = useRouter()
  const [pages, setPages] = useState<AdminPage[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const fetchPages = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/docs-pages')
      if (res.ok) {
        const data = await res.json()
        setPages(data.pages ?? [])
      }
    } catch {
      // Silently handle fetch error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPages()
  }, [fetchPages])

  const handleDelete = useCallback(
    async (pageId: string) => {
      try {
        const res = await fetch(`/api/admin/docs-pages/${pageId}`, { method: 'DELETE' })
        if (res.ok) {
          setPages((prev) => prev.filter((p) => p.id !== pageId))
        }
      } catch {
        // Silently handle delete error
      }
      setDeleteConfirm(null)
    },
    []
  )

  const handleToggleStatus = useCallback(
    async (pageId: string, currentStatus: ContentStatus) => {
      const newStatus = currentStatus === 'draft' ? 'published' : 'draft'
      try {
        const res = await fetch(`/api/admin/docs-pages/${pageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
        if (res.ok) {
          setPages((prev) =>
            prev.map((p) => (p.id === pageId ? { ...p, status: newStatus } : p))
          )
        }
      } catch {
        // Silently handle status toggle error
      }
    },
    []
  )

  const flatPages = flattenWithDepth(pages)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-foreground-muted border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Documentation Pages</h1>
        <button
          onClick={() => setShowNewModal(true)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-accent-hover"
        >
          New Page
        </button>
      </div>

      {flatPages.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <p className="text-foreground-muted">No documentation pages yet. Create your first one.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-foreground-muted">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {flatPages.map((page) => (
                <tr key={page.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center gap-2"
                      style={{ paddingLeft: `${page.depth * 20}px` }}
                    >
                      {/* Drag handle placeholder */}
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
                  <td className="px-4 py-3 text-foreground-muted">
                    {page.slug}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleStatus(page.id, page.status)}
                      className="inline-flex items-center gap-1.5"
                      title={`Click to ${page.status === 'draft' ? 'publish' : 'unpublish'}`}
                    >
                      {page.status === 'draft' ? (
                        <span className="rounded-full bg-warning-muted px-2 py-0.5 text-xs font-medium text-warning">
                          DRAFT
                        </span>
                      ) : (
                        <span className="rounded-full bg-success-muted px-2 py-0.5 text-xs font-medium text-success">
                          PUBLISHED
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {new Date(page.updated_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/docs/${page.id}`}
                        className="rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-raised"
                      >
                        Edit
                      </Link>
                      {deleteConfirm === page.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(page.id)}
                            className="rounded-md bg-destructive px-3 py-1 text-xs font-medium text-white"
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
      )}

      {/* New Page Modal */}
      {showNewModal && (
        <NewPageModal
          pages={pages}
          onClose={() => setShowNewModal(false)}
          onCreated={(newPage) => {
            setPages((prev) => [...prev, newPage])
            setShowNewModal(false)
            router.push(`/admin/docs/${newPage.id}`)
          }}
        />
      )}
    </div>
  )
}

function NewPageModal({
  pages,
  onClose,
  onCreated,
}: {
  pages: AdminPage[]
  onClose: () => void
  onCreated: (page: AdminPage) => void
}) {
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [parentId, setParentId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setTitle(val)
      if (!slugManual) setSlug(slugify(val))
    },
    [slugManual]
  )

  const handleSlugChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugManual(true)
    setSlug(slugify(e.target.value))
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!title.trim() || !slug.trim()) {
        setError('Title and slug are required')
        return
      }

      setSaving(true)
      setError('')

      try {
        const res = await fetch('/api/admin/docs-pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            slug: slug.trim(),
            parentId: parentId || null,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          onCreated(data.page)
        } else {
          const data = await res.json()
          setError(data.error || 'Failed to create page')
        }
      } catch {
        setError('Network error')
      } finally {
        setSaving(false)
      }
    },
    [title, slug, parentId, onCreated]
  )

  // Build flat parent options
  const parentOptions = flattenWithDepth(pages)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">New Documentation Page</h2>
          <button
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Title</label>
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="Page title"
              autoFocus
            />
          </div>

          {/* Slug */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={handleSlugChange}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="page-slug"
            />
          </div>

          {/* Parent */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Parent Page</label>
            <select
              value={parentId ?? ''}
              onChange={(e) => setParentId(e.target.value || null)}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">None (top-level)</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {'  '.repeat(p.depth)}{p.title}
                </option>
              ))}
            </select>
          </div>

          {/* Note: No visibility control — docs pages are always public */}
          <p className="text-xs text-foreground-muted">
            Documentation pages are always publicly visible.
          </p>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-raised"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Page'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
