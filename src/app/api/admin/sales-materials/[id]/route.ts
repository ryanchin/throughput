import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { updateMaterialSchema } from '@/lib/sales/validation'

/**
 * GET /api/admin/sales-materials/[id]
 * Returns a single material for editing (any status). Admin only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { id } = await params

  const { data: material, error } = await supabase
    .from('sales_materials')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !material) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Generate signed URL if file exists
  let downloadUrl: string | null = null
  if (material.file_path) {
    const { data: signedUrl } = await supabase.storage
      .from('sales-materials')
      .createSignedUrl(material.file_path, 3600)
    downloadUrl = signedUrl?.signedUrl ?? null
  }

  return NextResponse.json({ material: { ...material, download_url: downloadUrl } })
}

/**
 * PATCH /api/admin/sales-materials/[id]
 * Partial update of a material. Admin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = updateMaterialSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  // If slug is being changed, check uniqueness
  if (parsed.data.slug) {
    const { data: existing } = await supabase
      .from('sales_materials')
      .select('id')
      .eq('slug', parsed.data.slug)
      .neq('id', id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'A material with this slug already exists' }, { status: 409 })
    }
  }

  // Build update object from only the fields that were provided
  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) {
      updateData[key] = value ?? null
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: material, error } = await supabase
    .from('sales_materials')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error || !material) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ material })
}

/**
 * DELETE /api/admin/sales-materials/[id]
 * Soft-delete: sets status to 'archived'. Admin only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { id } = await params

  const { error } = await supabase
    .from('sales_materials')
    .update({ status: 'archived' })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to archive material' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
