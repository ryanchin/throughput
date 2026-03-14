import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAllPagesAdmin } from '@/lib/knowledge/queries'
import type { Json, ContentStatus } from '@/lib/supabase/database.types'

const createPageSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'Slug is required'),
  parentId: z.string().uuid().nullable().optional(),
  content: z.record(z.string(), z.unknown()).optional().default({
    type: 'doc',
    content: [{ type: 'paragraph' }],
  }),
  status: z.enum(['draft', 'published']).default('draft'),
})

/**
 * POST /api/admin/docs-pages
 * Creates a new documentation page (docs_page with type='docs').
 * Admin only. Visibility is always 'public' for docs pages.
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createPageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { title, slug, parentId, content, status } = parsed.data
  const serviceClient = createServiceClient()

  // Auto-calculate order_index: max sibling order_index + 1
  const parentFilter = parentId ?? null

  let siblingQuery = serviceClient
    .from('docs_pages')
    .select('order_index')
    .eq('type', 'docs')

  if (parentFilter) {
    siblingQuery = siblingQuery.eq('parent_id', parentFilter)
  } else {
    siblingQuery = siblingQuery.is('parent_id', null)
  }

  const { data: siblingRows } = await siblingQuery
    .order('order_index', { ascending: false })
    .limit(1)

  const nextOrderIndex = siblingRows && siblingRows.length > 0
    ? siblingRows[0].order_index + 1
    : 0

  const { data: page, error: insertError } = await serviceClient
    .from('docs_pages')
    .insert({
      title,
      slug,
      parent_id: parentFilter,
      visibility: 'public',
      content: content as unknown as Json,
      status: status as ContentStatus,
      order_index: nextOrderIndex,
      type: 'docs' as const,
    })
    .select()
    .single()

  if (insertError || !page) {
    return NextResponse.json(
      { error: insertError?.message ?? 'Failed to create page' },
      { status: 500 }
    )
  }

  return NextResponse.json({ page }, { status: 201 })
}

/**
 * GET /api/admin/docs-pages
 * Returns all docs pages (type='docs', all statuses) for admin management.
 * Admin only.
 */
export async function GET() {
  const { error: authError } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { data: pages, error } = await fetchAllPagesAdmin('docs')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ pages })
}
