import { createClient } from '@/lib/supabase/server'

export interface SearchResult {
  id: string
  title: string
  excerpt: string
  type: 'knowledge' | 'course' | 'lesson' | 'certification'
  url: string
}

/**
 * Full-text search across knowledge pages, courses, lessons, and certification tracks.
 * Uses Postgres tsvector search. Results are access-filtered by RLS.
 */
export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return []

  const supabase = await createClient()
  const tsQuery = query.trim().split(/\s+/).join(' & ')
  const results: SearchResult[] = []

  // Search knowledge pages (RLS handles visibility filtering)
  const { data: knowledgePages } = await supabase
    .from('docs_pages')
    .select('id, title, slug, parent_id')
    .eq('status', 'published')
    .textSearch('search_vector', tsQuery)
    .limit(10)

  if (knowledgePages) {
    for (const page of knowledgePages) {
      results.push({
        id: page.id,
        title: page.title,
        excerpt: '',
        type: 'knowledge',
        url: `/knowledge/${page.slug}`,
      })
    }
  }

  // Search courses
  const { data: courses } = await supabase
    .from('courses')
    .select('id, title, slug, description')
    .eq('status', 'published')
    .ilike('title', `%${query}%`)
    .limit(10)

  if (courses) {
    for (const course of courses) {
      results.push({
        id: course.id,
        title: course.title,
        excerpt: course.description?.slice(0, 120) ?? '',
        type: 'course',
        url: `/training/${course.slug}`,
      })
    }
  }

  // Search lessons
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, title, slug, course_id')
    .eq('status', 'published')
    .ilike('title', `%${query}%`)
    .limit(10)

  if (lessons) {
    for (const lesson of lessons) {
      results.push({
        id: lesson.id,
        title: lesson.title,
        excerpt: '',
        type: 'lesson',
        url: `/training/lesson/${lesson.slug}`,
      })
    }
  }

  // Search certification tracks
  const { data: certTracks } = await supabase
    .from('certification_tracks')
    .select('id, title, slug, description')
    .eq('status', 'published')
    .ilike('title', `%${query}%`)
    .limit(10)

  if (certTracks) {
    for (const track of certTracks) {
      results.push({
        id: track.id,
        title: track.title,
        excerpt: track.description?.slice(0, 120) ?? '',
        type: 'certification',
        url: `/certifications/${track.slug}`,
      })
    }
  }

  return results
}
