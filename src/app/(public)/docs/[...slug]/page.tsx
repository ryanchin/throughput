import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchPageBySlug } from '@/lib/knowledge/queries'
import LessonViewer from '@/components/editor/LessonViewer'
import type { JSONContent } from '@tiptap/react'

interface PageProps {
  params: Promise<{ slug: string[] }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const slugPath = slug.join('/')
  const page = await fetchPageBySlug(slugPath, 'docs')

  if (!page) {
    return { title: 'Not Found | AAVA Docs' }
  }

  return {
    title: `${page.title} | AAVA Docs`,
    description: `${page.title} — AAVA Product Studio documentation`,
  }
}

function formatSegment(segment: string): string {
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default async function DocPage({ params }: PageProps) {
  const { slug } = await params
  const slugPath = slug.join('/')
  const page = await fetchPageBySlug(slugPath, 'docs')

  if (!page) {
    notFound()
  }

  // Build breadcrumbs from slug segments
  const crumbs: { label: string; href: string }[] = [
    { label: 'Docs', href: '/docs' },
  ]
  for (let i = 0; i < slug.length - 1; i++) {
    const href = '/docs/' + slug.slice(0, i + 1).join('/')
    crumbs.push({ label: formatSegment(slug[i]), href })
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumbs */}
      {slug.length > 0 && (
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-foreground-muted" aria-label="Breadcrumbs">
          {crumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1.5">
              {i > 0 && (
                <svg className="h-3.5 w-3.5 text-foreground-subtle" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              )}
              <Link href={crumb.href} className="hover:text-foreground transition-colors">
                {crumb.label}
              </Link>
            </span>
          ))}
          <svg className="h-3.5 w-3.5 text-foreground-subtle" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-foreground">{page.title}</span>
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
  )
}
