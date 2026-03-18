import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listMaterialsSchema } from '@/lib/sales/validation'

/**
 * GET /api/sales/materials
 * Lists published sales materials with optional filtering by type, category, and search.
 * Accessible by sales + admin roles only.
 */
export async function GET(request: NextRequest) {
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

  const parsed = listMaterialsSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const params = parsed.data

  // Belt-and-suspenders: explicit status filter + RLS
  let query = supabase
    .from('sales_materials')
    .select(
      'id, title, slug, description, material_type, category, tags, file_name, file_mime_type, shareable, share_token, updated_at',
      { count: 'exact' }
    )
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .range((params.page - 1) * params.limit, params.page * params.limit - 1)

  if (params.type) query = query.eq('material_type', params.type)
  if (params.category) query = query.eq('category', params.category)
  if (params.q) query = query.textSearch('search_vector', params.q, { type: 'plain' })

  const { data, count, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Failed to fetch materials' }, { status: 500 })
  }

  return NextResponse.json({
    materials: data ?? [],
    total: count ?? 0,
    page: params.page,
    limit: params.limit,
  })
}
