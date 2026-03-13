import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'

const updatePageSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  parentId: z.string().uuid().nullable().optional(),
  visibility: z.union([
    z.literal('public'),
    z.literal('internal'),
    z.string().regex(/^group:.+$/, 'Group visibility must be in format "group:<name>"'),
  ]).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['draft', 'published']).optional(),
  orderIndex: z.number().int().min(0).optional(),
})

/**
 * PATCH /api/admin/knowledge/[pageId]
 * Updates a knowledge page by ID. All fields are optional.
 * Admin only. Uses service client to bypass RLS.
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

  const { title, slug, parentId, visibility, content, status, orderIndex } = parsed.data

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {}
  if (title !== undefined) updates.title = title
  if (slug !== undefined) updates.slug = slug
  if (parentId !== undefined) updates.parent_id = parentId
  if (visibility !== undefined) updates.visibility = visibility
  if (content !== undefined) updates.content = content
  if (status !== undefined) updates.status = status
  if (orderIndex !== undefined) updates.order_index = orderIndex

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  const { data: page, error: updateError } = await serviceClient
    .from('docs_pages')
    .update(updates)
    .eq('id', pageId)
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
 * DELETE /api/admin/knowledge/[pageId]
 * Deletes a knowledge page by ID.
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

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
