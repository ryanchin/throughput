'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MATERIAL_TYPES, MATERIAL_TYPE_LABELS, type MaterialType } from '@/lib/sales/validation'

interface MaterialFiltersProps {
  categories: { id: string; name: string; slug: string }[]
}

export function MaterialFilters({ categories }: MaterialFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [searchValue, setSearchValue] = useState(searchParams.get('q') ?? '')

  const currentType = searchParams.get('type') ?? ''
  const currentCategory = searchParams.get('category') ?? ''

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      // Always ensure we're on the materials tab
      params.set('tab', 'materials')
      startTransition(() => {
        router.replace(`/sales?${params.toString()}`)
      })
    },
    [router, searchParams, startTransition]
  )

  const handleSearch = useCallback(
    (value: string) => {
      setSearchValue(value)
      // Debounce search
      const timeout = setTimeout(() => updateParam('q', value), 300)
      return () => clearTimeout(timeout)
    },
    [updateParam]
  )

  const handleClearAll = useCallback(() => {
    const params = new URLSearchParams()
    params.set('tab', 'materials')
    setSearchValue('')
    startTransition(() => {
      router.replace(`/sales?${params.toString()}`)
    })
  }, [router, startTransition])

  const hasFilters = currentType || currentCategory || searchParams.get('q')

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3" data-testid="material-filters">
      {/* Search */}
      <div className="relative w-full sm:w-64">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
        <input
          type="text"
          placeholder="Search materials..."
          value={searchValue}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full bg-background border border-border text-foreground text-sm rounded-lg pl-9 pr-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
          data-testid="materials-search"
        />
      </div>

      {/* Type filter */}
      <select
        value={currentType}
        onChange={(e) => updateParam('type', e.target.value)}
        className="bg-background border border-border text-foreground text-sm rounded-lg px-3 py-2 focus:border-accent outline-none"
        data-testid="type-filter"
      >
        <option value="">All Types</option>
        {MATERIAL_TYPES.map((type) => (
          <option key={type} value={type}>
            {MATERIAL_TYPE_LABELS[type as MaterialType]}
          </option>
        ))}
      </select>

      {/* Category filter */}
      {categories.length > 0 && (
        <select
          value={currentCategory}
          onChange={(e) => updateParam('category', e.target.value)}
          className="bg-background border border-border text-foreground text-sm rounded-lg px-3 py-2 focus:border-accent outline-none"
          data-testid="category-filter"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.name}>
              {cat.name}
            </option>
          ))}
        </select>
      )}

      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={handleClearAll}
          className="text-xs text-foreground-muted hover:text-accent transition-colors"
          data-testid="clear-filters"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
