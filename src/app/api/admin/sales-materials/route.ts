import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createMaterialSchema } from '@/lib/sales/validation'
import { generateShareToken } from '@/lib/sales/share-token'

/**
 * GET /api/admin/sales-materials
 * Lists ALL materials (draft, published, archived) for admin users.
 */
export async function GET() {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { data: materials, error } = await supabase
    .from('sales_materials')
    .select('id, title, slug, description, material_type, category, tags, file_name, file_mime_type, file_size_bytes, shareable, share_token, status, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch materials' }, { status: 500 })
  }

  return NextResponse.json({ materials: materials ?? [] })
}

/**
 * POST /api/admin/sales-materials
 * Creates a new material in draft status.
 * Generates a share token on creation.
 */
export async function POST(request: NextRequest) {
  const { error: authError, supabase, profile } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createMaterialSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { title, slug, description, material_type, category, tags, content, shareable, status } = parsed.data

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from('sales_materials')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'A material with this slug already exists' }, { status: 409 })
  }

  const shareToken = generateShareToken()

  const { data: material, error } = await supabase
    .from('sales_materials')
    .insert({
      title,
      slug,
      description: description ?? null,
      material_type,
      category: category ?? null,
      tags,
      content: content ?? null,
      shareable,
      share_token: shareToken,
      status,
      created_by: profile!.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create material' }, { status: 500 })
  }

  return NextResponse.json({ material }, { status: 201 })
}
