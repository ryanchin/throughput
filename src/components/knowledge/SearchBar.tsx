'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface SearchResult {
  id: string
  title: string
  type: 'knowledge' | 'course' | 'lesson' | 'certification'
  url: string
}

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
        setIsOpen(true)
      }
    } catch {
      // Silently fail on search errors
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setQuery(value)

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => search(value), 300)
    },
    [search]
  )

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on Escape
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setQuery('')
    }
  }, [])

  const handleResultClick = useCallback(
    (url: string) => {
      setIsOpen(false)
      setQuery('')
      router.push(url)
    },
    [router]
  )

  const typeBadgeStyles: Record<string, string> = {
    knowledge: 'bg-accent-muted text-accent',
    course: 'bg-success-muted text-success',
    lesson: 'bg-warning-muted text-warning',
    certification: 'bg-secondary-muted text-secondary',
  }

  return (
    <div ref={containerRef} className="relative" data-testid="search-bar">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground-muted"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true)
          }}
          placeholder="Search..."
          className="w-48 rounded-lg border border-border bg-raised py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent lg:w-64"
        />
        {isLoading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <div className="size-3.5 animate-spin rounded-full border-2 border-foreground-muted border-t-transparent" />
          </div>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-border bg-raised shadow-lg">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-foreground-muted">
              No results found
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((result) => (
                <li key={`${result.type}-${result.id}`}>
                  <button
                    onClick={() => handleResultClick(result.url)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted"
                  >
                    <span className="flex-1 truncate text-sm font-medium text-foreground">
                      {result.title}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        typeBadgeStyles[result.type] ?? 'bg-muted text-foreground-muted'
                      }`}
                    >
                      {result.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
