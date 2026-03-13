import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/getProfile'
import { fetchNavPages, fetchUserGroups, fetchRecentPages } from '@/lib/knowledge/queries'
import { buildNavTree, filterNavTree } from '@/lib/knowledge/nav-tree'
import { KnowledgeSidebar } from '@/components/knowledge/KnowledgeSidebar'
import { VisibilityBadge } from '@/components/knowledge/VisibilityBadge'
import type { Visibility } from '@/lib/supabase/database.types'

export default async function KnowledgePage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const [navPages, userGroups, recentPages] = await Promise.all([
    fetchNavPages(),
    fetchUserGroups(profile.id),
    fetchRecentPages(12),
  ])

  const tree = buildNavTree(navPages)
  const filteredTree = filterNavTree(tree, userGroups, true)

  return (
    <div className="flex min-h-[calc(100vh-3.5rem-4rem)]">
      <KnowledgeSidebar tree={filteredTree} currentPath="" />

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
          {recentPages.length === 0 ? (
            <p className="text-sm text-foreground-muted">No knowledge pages published yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentPages.map((page) => (
                <Link
                  key={page.id}
                  href={`/knowledge/${page.slug}`}
                  className="group rounded-xl border border-border bg-surface p-5 shadow-card transition-colors hover:border-accent"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-foreground group-hover:text-accent">
                      {page.title}
                    </h3>
                    <VisibilityBadge visibility={page.visibility as Visibility} />
                  </div>
                  <p className="text-xs text-foreground-muted">
                    Updated{' '}
                    {new Date(page.updated_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
