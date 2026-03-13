'use client'

import { useEffect } from 'react'
import { SearchBar } from '@/components/knowledge/SearchBar'

/**
 * Test page for SearchBar E2E tests.
 * Mocks the fetch API to return search results without hitting a real API.
 * Bypasses auth and DB calls.
 */

const mockSearchResults = [
  {
    id: 'page-1',
    title: 'How to use Throughput',
    type: 'knowledge' as const,
    url: '/knowledge/getting-started/how-to-use-throughput',
  },
  {
    id: 'course-1',
    title: 'AAVA Foundations Course',
    type: 'course' as const,
    url: '/training/aava-foundations',
  },
  {
    id: 'lesson-1',
    title: 'Goal Extraction Lesson',
    type: 'lesson' as const,
    url: '/training/aava-foundations/goal-extraction',
  },
  {
    id: 'cert-1',
    title: 'AAVA Practitioner Certification',
    type: 'certification' as const,
    url: '/certifications/aava-practitioner',
  },
]

function useMockFetch() {
  useEffect(() => {
    const originalFetch = window.fetch

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.startsWith('/api/search')) {
        const params = new URL(url, window.location.origin).searchParams
        const q = params.get('q')?.toLowerCase() ?? ''

        // Filter mock results by query
        const filtered = mockSearchResults.filter(
          (r) => r.title.toLowerCase().includes(q)
        )

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 100))

        return new Response(JSON.stringify({ results: filtered }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Pass through all other requests
      return originalFetch(input, init)
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])
}

export default function TestKnowledgeSearchPage() {
  useMockFetch()

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-3xl font-bold text-foreground">Search Test</h1>
        <p className="mb-4 text-sm text-foreground-muted">
          Type in the search bar below. Results are mocked client-side.
        </p>
        <div className="flex justify-end" data-testid="search-container">
          <SearchBar />
        </div>
      </div>
    </div>
  )
}
