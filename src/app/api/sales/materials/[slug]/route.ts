import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/sales/materials/[slug]
 * Returns a single published material with full content and a signed download URL.
 * Accessible by sales + admin roles only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['sales', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await params

  // Belt-and-suspenders: explicit status filter + RLS
  const { data: material, error } = await supabase
    .from('sales_materials')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (error || !material) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let downloadUrl: string | null = null
  if (material.file_path) {
    const { data: signedUrl } = await supabase.storage
      .from('sales-materials')
      .createSignedUrl(material.file_path, 3600)
    downloadUrl = signedUrl?.signedUrl ?? null
  }

  return NextResponse.json({ material: { ...material, download_url: downloadUrl } })
}
