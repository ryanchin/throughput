'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { JSONContent } from '@tiptap/react'
import type { ContentStatus } from '@/lib/supabase/database.types'

const BlockEditor = dynamic(() => import('@/components/editor/BlockEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface">
      <div className="size-6 animate-spin rounded-full border-2 border-foreground-muted border-t-transparent" />
    </div>
  ),
})

interface PageData {
  id: string
  title: string
  slug: string
  parent_id: string | null
  order_index: number
  status: ContentStatus
  content: JSONContent | null
  meta_title: string | null
  meta_description: string | null
  updated_at: string
}

interface ParentOption {
  id: string
  title: string
  depth: number
}

export default function AdminDocsEditorPage() {
  const { pageId } = useParams<{ pageId: string }>()
  const router = useRouter()

  const [page, setPage] = useState<PageData | null>(null)
  const [allPages, setAllPages] = useState<ParentOption[]>([])
  const [loading, setLoading] = useState(true)

  // Form fields
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [status, setStatus] = useState<ContentStatus>('draft')
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [metaSaving, setMetaSaving] = useState(false)
  const [metaSaved, setMetaSaved] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)

  const metaSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch page and all pages for parent selector
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/docs-pages')
        if (!res.ok) return

        const data = await res.json()
        const pages = data.pages ?? []

        const current = pages.find((p: PageData) => p.id === pageId)
        if (!current) {
          // Try fetching the individual page (it might have content not in the list response)
          const pageRes = await fetch(`/api/admin/docs-pages/${pageId}`)
          if (!pageRes.ok) {
            router.push('/admin/docs')
            return
          }
          const pageData = await pageRes.json()
          if (!pageData.page) {
            router.push('/admin/docs')
            return
          }
          setPage(pageData.page)
          setTitle(pageData.page.title)
          setSlug(pageData.page.slug)
          setParentId(pageData.page.parent_id)
          setStatus(pageData.page.status)
          setMetaTitle(pageData.page.meta_title ?? '')
          setMetaDescription(pageData.page.meta_description ?? '')
        } else {
          // The list response doesn't include content, so fetch the full page
          const pageRes = await fetch(`/api/admin/docs-pages/${pageId}`)
          if (pageRes.ok) {
            const pageData = await pageRes.json()
            setPage(pageData.page)
            setTitle(pageData.page.title)
            setSlug(pageData.page.slug)
            setParentId(pageData.page.parent_id)
            setStatus(pageData.page.status)
          } else {
            setPage(current)
            setTitle(current.title)
            setSlug(current.slug)
            setParentId(current.parent_id)
            setStatus(current.status)
            setMetaTitle(current.meta_title ?? '')
            setMetaDescription(current.meta_description ?? '')
          }
        }

        // Build parent options (exclude self and descendants)
        const excluded = new Set<string>()
        excluded.add(pageId)
        const childQueue = [pageId]
        while (childQueue.length > 0) {
          const parentCheck = childQueue.shift()!
          for (const p of pages) {
            if (p.parent_id === parentCheck && !excluded.has(p.id)) {
              excluded.add(p.id)
              childQueue.push(p.id)
            }
          }
        }

        // Flatten with depth
        const childMap = new Map<string | null, typeof pages>()
        for (const p of pages) {
          const key = p.parent_id ?? null
          if (!childMap.has(key)) childMap.set(key, [])
          childMap.get(key)!.push(p)
        }

        const flat: ParentOption[] = []
        function walk(pid: string | null, depth: number) {
          const children = childMap.get(pid) ?? []
          children.sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index)
          for (const c of children) {
            if (!excluded.has(c.id)) {
              flat.push({ id: c.id, title: c.title, depth })
              walk(c.id, depth + 1)
            }
          }
        }
        walk(null, 0)
        setAllPages(flat)
      } catch {
        // Handle fetch error
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [pageId, router])

  // Save metadata
  const handleMetaSave = useCallback(async () => {
    setMetaSaving(true)
    setMetaSaved(false)

    try {
      const res = await fetch(`/api/admin/docs-pages/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug,
          parentId,
          status,
          metaTitle: metaTitle || null,
          metaDescription: metaDescription || null,
        }),
      })

      if (res.ok) {
        setMetaSaved(true)
        if (metaSavedTimer.current) clearTimeout(metaSavedTimer.current)
        metaSavedTimer.current = setTimeout(() => setMetaSaved(false), 2000)
      }
    } catch {
      // Handle save error
    } finally {
      setMetaSaving(false)
    }
  }, [pageId, title, slug, parentId, status, metaTitle, metaDescription])

  // Auto-save content via BlockEditor's onSave
  const handleContentSave = useCallback(
    async (content: JSONContent) => {
      await fetch(`/api/admin/docs-pages/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
    },
    [pageId]
  )

  // Generate SEO metadata with AI
  const handleGenerateSeo = useCallback(async () => {
    setAiGenerating(true)
    try {
      const res = await fetch(`/api/admin/docs-pages/${pageId}/generate-seo`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        if (data.metaTitle) setMetaTitle(data.metaTitle)
        if (data.metaDescription) setMetaDescription(data.metaDescription)
      }
    } catch {
      // Handle generation error
    } finally {
      setAiGenerating(false)
    }
  }, [pageId])

  // Cleanup
  useEffect(() => {
    return () => {
      if (metaSavedTimer.current) clearTimeout(metaSavedTimer.current)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-foreground-muted border-t-transparent" />
      </div>
    )
  }

  if (!page) {
    return (
      <div className="py-20 text-center">
        <p className="text-foreground-muted">Page not found.</p>
        <Link href="/admin/docs" className="mt-2 text-accent hover:underline">
          Back to Docs
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/docs"
            className="text-foreground-muted transition-colors hover:text-foreground"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Edit Documentation Page</h1>
        </div>
        <div className="flex items-center gap-3">
          {metaSaved && <span className="text-sm text-success">Saved</span>}
          <button
            onClick={handleMetaSave}
            disabled={metaSaving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {metaSaving ? 'Saving...' : 'Save Metadata'}
          </button>
        </div>
      </div>

      {/* Metadata form */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-2">
        {/* Title */}
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Slug */}
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
            {allPages.map((p) => (
              <option key={p.id} value={p.id}>
                {'  '.repeat(p.depth)}{p.title}
              </option>
            ))}
          </select>
        </div>

        {/* Status toggle */}
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Status</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStatus(status === 'draft' ? 'published' : 'draft')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                status === 'published' ? 'bg-success' : 'bg-muted'
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow transition-transform ${
                  status === 'published' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-sm text-foreground-muted">
              {status === 'published' ? (
                <span className="text-success">Published</span>
              ) : (
                <span className="text-warning">Draft</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* SEO Metadata */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">SEO Metadata</h2>
          <button
            type="button"
            onClick={handleGenerateSeo}
            disabled={aiGenerating}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:border-accent/30 hover:text-accent transition-colors disabled:opacity-50"
          >
            {aiGenerating ? (
              <>
                <span className="size-3.5 animate-spin rounded-full border-2 border-foreground-muted border-t-transparent" />
                Generating...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v3m0 12v3M3 12h3m12 0h3m-3.5-6.5L16 7m-8 10-2.5 2.5M19.5 19.5 17 17M7 7 4.5 4.5" />
                </svg>
                Generate with AI
              </>
            )}
          </button>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Meta Title
            <span className="ml-1 text-xs text-foreground-muted">({metaTitle.length}/70)</span>
          </label>
          <input
            type="text"
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value.slice(0, 70))}
            placeholder="Page title for search engines"
            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Meta Description
            <span className="ml-1 text-xs text-foreground-muted">({metaDescription.length}/160)</span>
          </label>
          <textarea
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value.slice(0, 160))}
            rows={2}
            placeholder="Brief description for search engine results"
            className="w-full resize-none rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {!metaTitle && !metaDescription && (
          <p className="text-xs text-foreground-muted">
            No SEO metadata set. Click &ldquo;Generate with AI&rdquo; to create it from the page content, or enter it manually.
          </p>
        )}
      </div>

      {/* Content editor */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Content</h2>
        <BlockEditor
          initialContent={page.content as JSONContent | undefined}
          onSave={handleContentSave}
          placeholder="Start writing your documentation page..."
        />
      </div>
    </div>
  )
}
