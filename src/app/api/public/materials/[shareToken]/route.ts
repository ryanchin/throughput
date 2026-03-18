import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/public/materials/[shareToken]
 * Public share endpoint. No authentication required.
 * Returns material content for a valid, published, shareable material.
 * Uses service client because anon users cannot query the table directly
 * (the triple filter prevents unintended access).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const { shareToken } = await params

  if (!shareToken || shareToken.length < 8) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const serviceClient = createServiceClient()

  const { data: material, error } = await serviceClient
    .from('sales_materials')
    .select('id, title, slug, description, material_type, category, content, file_name, file_mime_type, file_size_bytes, file_path, updated_at')
    .eq('share_token', shareToken)
    .eq('shareable', true)
    .eq('status', 'published')
    .single()

  if (error || !material) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let downloadUrl: string | null = null
  if (material.file_path) {
    const { data: signedUrl } = await serviceClient.storage
      .from('sales-materials')
      .createSignedUrl(material.file_path, 3600)
    downloadUrl = signedUrl?.signedUrl ?? null
  }

  // Don't expose file_path to public consumers
  const { file_path: _, ...publicMaterial } = material

  return NextResponse.json({
    material: { ...publicMaterial, download_url: downloadUrl },
  })
}
