import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth/getProfile'

/** Fields returned in material list responses (no content/file_path to keep payloads small). */
const LIST_FIELDS = 'id, title, slug, description, material_type, category, tags, file_name, file_mime_type, shareable, share_token, updated_at' as const

/** Fields returned in material detail responses. */
const DETAIL_FIELDS = '*, created_by' as const

export interface MaterialListItem {
  id: string
  title: string
  slug: string
  description: string | null
  material_type: string
  category: string | null
  tags: string[]
  file_name: string | null
  file_mime_type: string | null
  shareable: boolean
  share_token: string | null
  updated_at: string
}

export interface MaterialDetail {
  id: string
  title: string
  slug: string
  description: string | null
  material_type: string
  category: string | null
  tags: string[]
  content: unknown
  file_path: string | null
  file_name: string | null
  file_size_bytes: number | null
  file_mime_type: string | null
  shareable: boolean
  share_token: string | null
  status: string
  created_by: string | null
  created_at: string
  updated_at: string
  download_url?: string | null
}

/**
 * Fetch published materials for the sales zone.
 * Returns null if the user is not authenticated or lacks access.
 */
export async function getMaterialsList(filters?: {
  type?: string
  category?: string
  q?: string
}): Promise<MaterialListItem[] | null> {
  const profile = await getProfile()
  if (!profile || !['sales', 'admin'].includes(profile.role)) return null

  const supabase = await createClient()
  let query = supabase
    .from('sales_materials')
    .select(LIST_FIELDS)
    .eq('status', 'published')
    .order('updated_at', { ascending: false })

  if (filters?.type) query = query.eq('material_type', filters.type)
  if (filters?.category) query = query.eq('category', filters.category)
  if (filters?.q) query = query.textSearch('search_vector', filters.q, { type: 'plain' })

  const { data } = await query
  return data ?? []
}

/**
 * Fetch a single published material by slug, including a signed download URL if it has a file.
 * Returns null if not found, not published, or user lacks access.
 */
export async function getMaterialBySlug(slug: string): Promise<MaterialDetail | null> {
  const profile = await getProfile()
  if (!profile || !['sales', 'admin'].includes(profile.role)) return null

  const supabase = await createClient()
  const { data: material } = await supabase
    .from('sales_materials')
    .select(DETAIL_FIELDS)
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!material) return null

  let downloadUrl: string | null = null
  if (material.file_path) {
    const { data: signedUrl } = await supabase.storage
      .from('sales-materials')
      .createSignedUrl(material.file_path, 3600)
    downloadUrl = signedUrl?.signedUrl ?? null
  }

  return { ...material, download_url: downloadUrl }
}

/**
 * Fetch all distinct categories for filter dropdowns.
 * Returns null if user lacks access.
 */
export async function getMaterialCategories(): Promise<{ id: string; name: string; slug: string }[] | null> {
  const profile = await getProfile()
  if (!profile || !['sales', 'admin'].includes(profile.role)) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('sales_material_categories')
    .select('id, name, slug')
    .order('order_index', { ascending: true })

  return data ?? []
}
