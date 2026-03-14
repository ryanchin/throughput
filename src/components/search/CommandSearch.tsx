'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileTextIcon,
  BookOpenIcon,
  GraduationCapIcon,
  AwardIcon,
  LoaderIcon,
} from 'lucide-react'
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'

interface SearchResult {
  id: string
  title: string
  url: string
  type: 'docs' | 'knowledge' | 'course' | 'lesson' | 'certification'
}

interface CommandSearchProps {
  scope: 'all' | 'docs'
  open: boolean
  onOpenChange: (open: boolean) => void
}

const typeConfig: Record<
  SearchResult['type'],
  { icon: typeof FileTextIcon; label: string; colorClass: string }
> = {
  docs: { icon: FileTextIcon, label: 'Docs', colorClass: 'text-accent' },
  knowledge: { icon: FileTextIcon, label: 'Knowledge', colorClass: 'text-accent' },
  course: { icon: BookOpenIcon, label: 'Courses', colorClass: 'text-[var(--success)]' },
  lesson: { icon: GraduationCapIcon, label: 'Lessons', colorClass: 'text-[var(--warning)]' },
  certification: { icon: AwardIcon, label: 'Certifications', colorClass: 'text-[var(--secondary)]' },
}

export function CommandSearch({ scope, open, onOpenChange }: CommandSearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchResults = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const endpoint =
          scope === 'docs'
            ? `/api/docs/search?q=${encodeURIComponent(q)}`
            : `/api/search?q=${encodeURIComponent(q)}`

        const res = await fetch(endpoint)
        if (res.ok) {
          const data = (await res.json()) as { results: SearchResult[] }
          setResults(data.results)
        } else {
          setResults([])
        }
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [scope]
  )

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      void fetchResults(query)
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, fetchResults])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setLoading(false)
    }
  }, [open])

  function handleSelect(url: string) {
    onOpenChange(false)
    router.push(url)
  }

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = []
    }
    acc[result.type].push(result)
    return acc
  }, {})

  const title = scope === 'docs' ? 'Search Docs' : 'Search'
  const description =
    scope === 'docs' ? 'Search documentation pages...' : 'Search courses, lessons, docs, and more...'

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder={scope === 'docs' ? 'Search docs...' : 'Type to search...'}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center py-6">
              <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
            </div>
          )}

          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}

          {!loading && query.trim().length < 2 && (
            <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
          )}

          {!loading &&
            Object.entries(grouped).map(([type, items]) => {
              const config = typeConfig[type as SearchResult['type']]
              if (!config) return null
              const Icon = config.icon

              return (
                <CommandGroup key={type} heading={config.label}>
                  {items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => handleSelect(item.url)}
                    >
                      <Icon className={`size-4 shrink-0 ${config.colorClass}`} />
                      <span className="truncate text-sm">{item.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
