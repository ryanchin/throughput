import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/sales/materials/categories
 * Returns all material categories for filter dropdowns.
 * Accessible by sales + admin roles only.
 */
export async function GET() {
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

  const { data, error } = await supabase
    .from('sales_material_categories')
    .select('id, name, slug')
    .order('order_index', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }

  return NextResponse.json({ categories: data ?? [] })
}
