import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'

const reorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      orderIndex: z.number().int().min(0),
      parentId: z.string().uuid().nullable(),
    })
  ).min(1, 'At least one item is required'),
})

/**
 * PATCH /api/admin/knowledge/reorder
 * Batch updates order_index and parent_id for multiple knowledge pages.
 * Used for drag-to-reorder and re-parenting in the admin CMS.
 * Admin only.
 */
export async function PATCH(request: NextRequest) {
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

  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { items } = parsed.data
  const serviceClient = createServiceClient()

  // Update each page's order_index and parent_id
  const errors: string[] = []
  for (const item of items) {
    const { error } = await serviceClient
      .from('docs_pages')
      .update({
        order_index: item.orderIndex,
        parent_id: item.parentId,
      })
      .eq('id', item.id)

    if (error) {
      errors.push(`Failed to update page ${item.id}: ${error.message}`)
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Some updates failed', details: errors }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
