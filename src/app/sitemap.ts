import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/server'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aava.ai'

/** Static public pages */
const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: `${BASE_URL}/`, changeFrequency: 'weekly', priority: 1.0 },
  { url: `${BASE_URL}/login`, changeFrequency: 'yearly', priority: 0.2 },
  { url: `${BASE_URL}/certifications`, changeFrequency: 'weekly', priority: 0.9 },
  { url: `${BASE_URL}/certifications/signup`, changeFrequency: 'yearly', priority: 0.5 },
  { url: `${BASE_URL}/docs`, changeFrequency: 'weekly', priority: 0.8 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [...STATIC_PAGES]
  const supabase = createServiceClient()

  // Dynamic: published docs pages
  try {
    const { data: docsPages } = await supabase
      .from('docs_pages')
      .select('slug, parent_id, updated_at')
      .eq('type', 'docs')
      .eq('status', 'published')

    if (docsPages) {
      // Build full slug paths (parent/child) from flat rows
      const pageMap = new Map(docsPages.map(p => [p.slug, p]))

      // We need full paths — fetch parent slugs too
      const { data: allDocsPages } = await supabase
        .from('docs_pages')
        .select('id, slug, parent_id, updated_at')
        .eq('type', 'docs')
        .eq('status', 'published')

      if (allDocsPages) {
        const idMap = new Map(allDocsPages.map(p => [p.id, p]))

        for (const page of allDocsPages) {
          // Build full path by walking up parent chain
          const slugParts: string[] = [page.slug]
          let current = page
          while (current.parent_id) {
            const parent = idMap.get(current.parent_id)
            if (!parent) break
            slugParts.unshift(parent.slug)
            current = parent
          }

          const fullPath = slugParts.join('/')
          // Skip the intro page (it's the /docs landing)
          if (fullPath === 'intro') continue

          entries.push({
            url: `${BASE_URL}/docs/${fullPath}`,
            lastModified: page.updated_at,
            changeFrequency: 'monthly',
            priority: page.parent_id ? 0.6 : 0.7,
          })
        }
      }
    }
  } catch {
    // Skip if DB unreachable
  }

  // Dynamic: published certification tracks
  try {
    const { data: tracks } = await supabase
      .from('certification_tracks')
      .select('slug, created_at')
      .eq('status', 'published')

    if (tracks) {
      for (const track of tracks) {
        entries.push({
          url: `${BASE_URL}/certifications/${track.slug}`,
          lastModified: track.created_at,
          changeFrequency: 'monthly',
          priority: 0.8,
        })
      }
    }
  } catch {
    // Skip if DB unreachable
  }

  // Dynamic: issued certificates (public verification pages)
  try {
    const { data: certs } = await supabase
      .from('certificates')
      .select('verification_hash, issued_at')
      .eq('revoked', false)
      .order('issued_at', { ascending: false })
      .limit(1000)

    if (certs) {
      for (const cert of certs) {
        entries.push({
          url: `${BASE_URL}/certifications/certificate/${cert.verification_hash}`,
          lastModified: cert.issued_at,
          changeFrequency: 'yearly',
          priority: 0.4,
        })
      }
    }
  } catch {
    // Skip if DB unreachable
  }

  return entries
}
