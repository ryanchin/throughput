import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: mockFrom,
    })
  ),
}))

// Chain helper — returns a thenable object that simulates Supabase query builder
function createChain(data: unknown[] = []) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: undefined as unknown,
  }
  // Make the chain thenable so `await supabase.from(...)...` resolves
  chain.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data, error: null })
  return chain
}

import { globalSearch } from '@/lib/knowledge/search'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('globalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array for empty query', async () => {
    const results = await globalSearch('')

    expect(results).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns empty array for query shorter than 2 chars', async () => {
    const results = await globalSearch('a')

    expect(results).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns empty array for whitespace-only query', async () => {
    const results = await globalSearch('   ')

    expect(results).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns results from knowledge pages', async () => {
    const knowledgeData = [
      { id: 'k1', title: 'Getting Started', slug: 'getting-started', parent_id: null },
    ]

    mockFrom.mockImplementation((table: string) => {
      if (table === 'docs_pages') return createChain(knowledgeData)
      return createChain([])
    })

    const results = await globalSearch('getting started')

    expect(results).toContainEqual({
      id: 'k1',
      title: 'Getting Started',
      excerpt: '',
      type: 'knowledge',
      url: '/knowledge/getting-started',
    })
  })

  it('returns results from courses', async () => {
    const courseData = [
      { id: 'c1', title: 'Sprint Planning', slug: 'sprint-planning', description: 'Learn sprint planning basics' },
    ]

    mockFrom.mockImplementation((table: string) => {
      if (table === 'courses') return createChain(courseData)
      return createChain([])
    })

    const results = await globalSearch('sprint')

    expect(results).toContainEqual({
      id: 'c1',
      title: 'Sprint Planning',
      excerpt: 'Learn sprint planning basics',
      type: 'course',
      url: '/training/sprint-planning',
    })
  })

  it('returns results from lessons', async () => {
    const lessonData = [
      { id: 'l1', title: 'Lesson One', slug: 'lesson-one', course_id: 'c1' },
    ]

    mockFrom.mockImplementation((table: string) => {
      if (table === 'lessons') return createChain(lessonData)
      return createChain([])
    })

    const results = await globalSearch('lesson')

    expect(results).toContainEqual({
      id: 'l1',
      title: 'Lesson One',
      excerpt: '',
      type: 'lesson',
      url: '/training/lesson/lesson-one',
    })
  })

  it('returns results from certification tracks', async () => {
    const certData = [
      { id: 'ct1', title: 'AAVA Foundations', slug: 'foundations', description: 'Foundation certification track' },
    ]

    mockFrom.mockImplementation((table: string) => {
      if (table === 'certification_tracks') return createChain(certData)
      return createChain([])
    })

    const results = await globalSearch('foundations')

    expect(results).toContainEqual({
      id: 'ct1',
      title: 'AAVA Foundations',
      excerpt: 'Foundation certification track',
      type: 'certification',
      url: '/certifications/foundations',
    })
  })

  it('combines results from multiple content types', async () => {
    const knowledgeData = [
      { id: 'k1', title: 'OKR Guide', slug: 'okr-guide', parent_id: null },
    ]
    const courseData = [
      { id: 'c1', title: 'OKR Course', slug: 'okr-course', description: 'Deep dive into OKRs' },
    ]
    const lessonData = [
      { id: 'l1', title: 'OKR Basics', slug: 'okr-basics', course_id: 'c1' },
    ]
    const certData = [
      { id: 'ct1', title: 'OKR Certification', slug: 'okr-cert', description: 'Prove OKR mastery' },
    ]

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'docs_pages':
          return createChain(knowledgeData)
        case 'courses':
          return createChain(courseData)
        case 'lessons':
          return createChain(lessonData)
        case 'certification_tracks':
          return createChain(certData)
        default:
          return createChain([])
      }
    })

    const results = await globalSearch('OKR')

    expect(results).toHaveLength(4)

    const types = results.map(r => r.type)
    expect(types).toContain('knowledge')
    expect(types).toContain('course')
    expect(types).toContain('lesson')
    expect(types).toContain('certification')
  })

  it('uses textSearch for knowledge pages and ilike for others', async () => {
    const knowledgeChain = createChain([])
    const courseChain = createChain([])
    const lessonChain = createChain([])
    const certChain = createChain([])

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'docs_pages':
          return knowledgeChain
        case 'courses':
          return courseChain
        case 'lessons':
          return lessonChain
        case 'certification_tracks':
          return certChain
        default:
          return createChain([])
      }
    })

    await globalSearch('sprint planning')

    // Knowledge pages use textSearch with tsquery (words joined by &)
    expect(knowledgeChain.textSearch).toHaveBeenCalledWith('search_vector', 'sprint & planning')
    expect(knowledgeChain.ilike).not.toHaveBeenCalled()

    // Courses, lessons, cert tracks use ilike
    expect(courseChain.ilike).toHaveBeenCalledWith('title', '%sprint planning%')
    expect(lessonChain.ilike).toHaveBeenCalledWith('title', '%sprint planning%')
    expect(certChain.ilike).toHaveBeenCalledWith('title', '%sprint planning%')
  })

  it('truncates course description to 120 chars for excerpt', async () => {
    const longDescription = 'A'.repeat(200)
    const courseData = [
      { id: 'c1', title: 'Long Course', slug: 'long-course', description: longDescription },
    ]

    mockFrom.mockImplementation((table: string) => {
      if (table === 'courses') return createChain(courseData)
      return createChain([])
    })

    const results = await globalSearch('long')

    const courseResult = results.find(r => r.type === 'course')
    expect(courseResult).toBeDefined()
    expect(courseResult!.excerpt).toHaveLength(120)
  })

  it('handles null description gracefully', async () => {
    const courseData = [
      { id: 'c1', title: 'No Desc', slug: 'no-desc', description: null },
    ]

    mockFrom.mockImplementation((table: string) => {
      if (table === 'courses') return createChain(courseData)
      return createChain([])
    })

    const results = await globalSearch('no desc')

    const courseResult = results.find(r => r.type === 'course')
    expect(courseResult).toBeDefined()
    expect(courseResult!.excerpt).toBe('')
  })

  it('queries all four tables', async () => {
    mockFrom.mockImplementation(() => createChain([]))

    await globalSearch('test query')

    const calledTables = mockFrom.mock.calls.map((call: unknown[]) => call[0])
    expect(calledTables).toContain('docs_pages')
    expect(calledTables).toContain('courses')
    expect(calledTables).toContain('lessons')
    expect(calledTables).toContain('certification_tracks')
  })
})
