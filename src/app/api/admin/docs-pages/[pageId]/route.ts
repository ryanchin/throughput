import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'

const updatePageSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  parentId: z.string().uuid().nullable().optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['draft', 'published']).optional(),
  orderIndex: z.number().int().min(0).optional(),
})

/**
 * GET /api/admin/docs-pages/[pageId]
 * Fetches a single docs page by ID. Admin only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { error: authError } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { pageId } = await params
  const serviceClient = createServiceClient()

  const { data: page, error } = await serviceClient
    .from('docs_pages')
    .select('*')
    .eq('id', pageId)
    .eq('type', 'docs')
    .single()

  if (error || !page) {
    return NextResponse.json(
      { error: error?.message ?? 'Page not found' },
      { status: error?.code === 'PGRST116' ? 404 : 500 }
    )
  }

  return NextResponse.json({ page })
}

/**
 * PATCH /api/admin/docs-pages/[pageId]
 * Updates a docs page by ID. All fields are optional.
 * Admin only. Visibility is always forced to 'public' for docs pages.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { error: authError } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { pageId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = updatePageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { title, slug, parentId, content, status, orderIndex } = parsed.data

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {}
  if (title !== undefined) updates.title = title
  if (slug !== undefined) updates.slug = slug
  if (parentId !== undefined) updates.parent_id = parentId
  if (content !== undefined) updates.content = content
  if (status !== undefined) updates.status = status
  if (orderIndex !== undefined) updates.order_index = orderIndex
  // Docs pages are always public — never allow visibility override
  updates.visibility = 'public'

  if (Object.keys(updates).length <= 1) {
    // Only visibility is set (forced), no actual user updates
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  const { data: page, error: updateError } = await serviceClient
    .from('docs_pages')
    .update(updates)
    .eq('id', pageId)
    .eq('type', 'docs')
    .select()
    .single()

  if (updateError || !page) {
    return NextResponse.json(
      { error: updateError?.message ?? 'Page not found' },
      { status: updateError?.code === 'PGRST116' ? 404 : 500 }
    )
  }

  return NextResponse.json({ page })
}

/**
 * DELETE /api/admin/docs-pages/[pageId]
 * Deletes a docs page by ID.
 * Admin only. Uses service client to bypass RLS.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { error: authError } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { pageId } = await params
  const serviceClient = createServiceClient()

  const { error: deleteError } = await serviceClient
    .from('docs_pages')
    .delete()
    .eq('id', pageId)
    .eq('type', 'docs')

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
