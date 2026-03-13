import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/getProfile'
import { fetchNavPages, fetchUserGroups, fetchPageBySlug } from '@/lib/knowledge/queries'
import { buildNavTree, filterNavTree, buildBreadcrumbs, canAccessVisibility } from '@/lib/knowledge/nav-tree'
import { KnowledgeSidebar } from '@/components/knowledge/KnowledgeSidebar'
import LessonViewer from '@/components/editor/LessonViewer'
import type { Visibility } from '@/lib/supabase/database.types'
import type { JSONContent } from '@tiptap/react'

interface KnowledgeSlugPageProps {
  params: Promise<{ slug: string[] }>
}

export default async function KnowledgeSlugPage({ params }: KnowledgeSlugPageProps) {
  const { slug } = await params
  const slugPath = slug.join('/')

  const profile = await getProfile()
  if (!profile) redirect('/login')

  const [page, navPages, userGroups] = await Promise.all([
    fetchPageBySlug(slugPath),
    fetchNavPages(),
    fetchUserGroups(profile.id),
  ])

  if (!page) notFound()

  // Check visibility access
  const visibility = page.visibility as Visibility
  if (!canAccessVisibility(visibility, userGroups, true)) {
    notFound()
  }

  const tree = buildNavTree(navPages)
  const filteredTree = filterNavTree(tree, userGroups, true)
  const breadcrumbs = buildBreadcrumbs(filteredTree, slugPath)

  return (
    <div className="flex min-h-[calc(100vh-3.5rem-4rem)]">
      <KnowledgeSidebar tree={filteredTree} currentPath={slugPath} />

      <div className="flex-1 px-8 py-8">
        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <nav className="mb-4 flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
            <Link
              href="/knowledge"
              className="text-foreground-muted transition-colors hover:text-foreground"
            >
              Knowledge
            </Link>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1
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
                    <span className="text-foreground">{crumb.title}</span>
                  ) : (
                    <Link
                      href={`/knowledge/${crumb.path}`}
                      className="text-foreground-muted transition-colors hover:text-foreground"
                    >
                      {crumb.title}
                    </Link>
                  )}
                </span>
              )
            })}
          </nav>
        )}

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">{page.title}</h1>
          <p className="mt-2 text-sm text-foreground-muted">
            Last updated{' '}
            {new Date(page.updated_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Page content */}
        {page.content ? (
          <LessonViewer content={page.content as JSONContent} />
        ) : (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="text-foreground-muted">This page has no content yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
