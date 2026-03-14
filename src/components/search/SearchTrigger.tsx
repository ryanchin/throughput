'use client'

import { useCallback, useEffect, useState } from 'react'
import { SearchIcon } from 'lucide-react'
import { CommandSearch } from '@/components/search/CommandSearch'
import {
  SidebarGroup,
  SidebarGroupContent,
} from '@/components/ui/sidebar'

interface SearchTriggerProps {
  scope: 'all' | 'docs'
  placeholder?: string
}

function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    // Check navigator.platform first, fall back to userAgentData
    const platform =
      typeof navigator !== 'undefined'
        ? navigator.platform ?? ''
        : ''
    setIsMac(platform.toLowerCase().includes('mac'))
  }, [])

  return isMac
}

export function SearchTrigger({ scope, placeholder = 'Search...' }: SearchTriggerProps) {
  const [open, setOpen] = useState(false)
  const isMac = useIsMac()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    },
    []
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <>
      <SidebarGroup className="py-0">
        <SidebarGroupContent className="relative">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/50 px-3 py-1.5 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <SearchIcon className="size-4 shrink-0" />
            <span className="flex-1 truncate text-left">{placeholder}</span>
            <kbd className="pointer-events-none hidden shrink-0 select-none rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 font-mono text-[10px] font-medium text-sidebar-foreground/50 sm:inline-flex">
              {isMac ? '\u2318K' : 'Ctrl K'}
            </kbd>
          </button>
        </SidebarGroupContent>
      </SidebarGroup>

      <CommandSearch scope={scope} open={open} onOpenChange={setOpen} />
    </>
  )
}
