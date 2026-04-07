'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Company } from '@/lib/crm/types'

interface CompanyComboboxProps {
  value: string // company ID
  onChange: (companyId: string) => void
  /** Placeholder text when nothing is selected */
  placeholder?: string
  /** Allow empty/none selection */
  allowNone?: boolean
  /** Label for the none option */
  noneLabel?: string
  /** Pre-loaded companies (optional — will fetch if not provided) */
  companies?: Pick<Company, 'id' | 'name'>[]
  disabled?: boolean
  'data-testid'?: string
}

export function CompanyCombobox({
  value,
  onChange,
  placeholder = 'Select company...',
  allowNone = false,
  noneLabel = 'None',
  companies: externalCompanies,
  disabled = false,
  ...props
}: CompanyComboboxProps) {
  const [companies, setCompanies] = useState<Pick<Company, 'id' | 'name'>[]>(
    externalCompanies ?? []
  )
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch companies if not externally provided
  useEffect(() => {
    if (externalCompanies) {
      setCompanies(externalCompanies)
      return
    }
    async function fetchCompanies() {
      try {
        const res = await fetch('/api/admin/crm/companies?limit=500')
        if (res.ok) {
          const data = await res.json()
          const list = (data.companies ?? data).map((c: Company) => ({
            id: c.id,
            name: c.name,
          }))
          setCompanies(list)
        }
      } catch {
        /* ignore */
      }
    }
    fetchCompanies()
  }, [externalCompanies])

  // Sort alphabetically
  const sorted = [...companies].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )

  // Filter by search text
  const filtered = search
    ? sorted.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : sorted

  // Get the display name for the current value
  const selectedCompany = companies.find((c) => c.id === value)
  const displayName = selectedCompany?.name ?? ''

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        // Reset search to show selected company name
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback(
    (companyId: string) => {
      onChange(companyId)
      setIsOpen(false)
      setSearch('')
    },
    [onChange]
  )

  async function handleCreateCompany() {
    const name = search.trim()
    if (!name) return

    setCreating(true)
    try {
      const res = await fetch('/api/admin/crm/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('Failed to create')
      const data = await res.json()
      const newCompany = data.company ?? data
      setCompanies((prev) => [...prev, { id: newCompany.id, name: newCompany.name }])
      handleSelect(newCompany.id)
    } catch {
      /* ignore — user can retry */
    } finally {
      setCreating(false)
    }
  }

  // Check if search text exactly matches an existing company
  const exactMatch = search
    ? companies.some((c) => c.name.toLowerCase() === search.toLowerCase())
    : true

  return (
    <div ref={wrapperRef} className="relative" data-testid={props['data-testid']}>
      <input
        ref={inputRef}
        type="text"
        value={isOpen ? search : displayName}
        onChange={(e) => {
          setSearch(e.target.value)
          if (!isOpen) setIsOpen(true)
        }}
        onFocus={() => {
          setIsOpen(true)
          setSearch('')
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-[var(--foreground-subtle)] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
        autoComplete="off"
      />

      {/* Clear button */}
      {value && !isOpen && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onChange('')
            setSearch('')
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-foreground-muted hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-border bg-raised shadow-lg">
          {allowNone && (
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                !value ? 'text-accent font-medium' : 'text-foreground-muted'
              }`}
            >
              {noneLabel}
            </button>
          )}

          {filtered.length === 0 && !search && (
            <div className="px-3 py-4 text-center text-sm text-foreground-muted">
              No companies found
            </div>
          )}

          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelect(c.id)}
              className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                c.id === value ? 'text-accent font-medium bg-accent-muted/30' : 'text-foreground'
              }`}
            >
              {c.name}
            </button>
          ))}

          {/* Create new company option */}
          {search && !exactMatch && (
            <button
              type="button"
              onClick={handleCreateCompany}
              disabled={creating}
              className="block w-full border-t border-border px-3 py-2 text-left text-sm text-accent hover:bg-muted transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : `+ Create "${search.trim()}"`}
            </button>
          )}

          {search && filtered.length === 0 && exactMatch && (
            <div className="px-3 py-4 text-center text-sm text-foreground-muted">
              No matches
            </div>
          )}
        </div>
      )}
    </div>
  )
}
