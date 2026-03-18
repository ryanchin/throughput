import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/server'
import LessonViewer from '@/components/editor/LessonViewer'
import type { JSONContent } from '@tiptap/react'

export const metadata: Metadata = {
  title: 'Documentation | Product Studio',
  description: 'Product Studio documentation — the AI-powered operating system for enterprise product teams. Goals, research, ideation, feasibility, roadmapping, PRDs, and more.',
}

async function getIntroPage() {
  const serviceClient = createServiceClient()

  // Try to find a page with slug 'intro' first
  const { data: introPage } = await serviceClient
    .from('docs_pages')
    .select('id, title, slug, content, updated_at')
    .eq('type', 'docs')
    .eq('status', 'published')
    .eq('slug', 'intro')
    .single()

  if (introPage) return introPage

  // Fallback: get the first top-level page by order_index
  const { data: firstPage } = await serviceClient
    .from('docs_pages')
    .select('id, title, slug, content, updated_at')
    .eq('type', 'docs')
    .eq('status', 'published')
    .is('parent_id', null)
    .order('order_index', { ascending: true })
    .limit(1)
    .single()

  return firstPage ?? null
}

export default async function DocsHomePage() {
  const page = await getIntroPage()

  if (!page || !page.content) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="bg-gradient-brand bg-clip-text text-4xl font-bold text-transparent">
          Product Studio Documentation
        </h1>
        <p className="mt-4 text-foreground-muted">
          Documentation is being prepared. Check back soon.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <LessonViewer content={page.content as JSONContent} />
    </div>
  )
}
