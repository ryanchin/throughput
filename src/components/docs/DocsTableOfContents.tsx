'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Heading {
  id: string
  text: string
  level: number
}

interface DocsTableOfContentsProps {
  headings: Heading[]
}

/**
 * Find a heading element in the DOM by its text content.
 * More reliable than getElementById since Tiptap adds IDs asynchronously.
 */
function findHeadingByText(text: string): HTMLElement | null {
  const headings = document.querySelectorAll<HTMLElement>(
    '[data-testid="lesson-viewer"] h1, [data-testid="lesson-viewer"] h2, [data-testid="lesson-viewer"] h3'
  )
  for (const el of headings) {
    if (el.textContent?.trim() === text) return el
  }
  return null
}

export function DocsTableOfContents({ headings }: DocsTableOfContentsProps) {
  const [activeIndex, setActiveIndex] = useState(-1)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const headingEls = useRef<Map<HTMLElement, number>>(new Map())

  const setupObserver = useCallback(() => {
    observerRef.current?.disconnect()
    headingEls.current.clear()

    // Find all heading elements in the rendered content
    const elements: HTMLElement[] = []
    for (let i = 0; i < headings.length; i++) {
      const el = findHeadingByText(headings[i].text)
      if (el) {
        elements.push(el)
        headingEls.current.set(el, i)
      }
    }

    if (elements.length === 0) return false

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = headingEls.current.get(entry.target as HTMLElement)
            if (idx !== undefined) setActiveIndex(idx)
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )

    for (const el of elements) {
      observerRef.current.observe(el)
    }
    return true
  }, [headings])

  useEffect(() => {
    // Retry setup until Tiptap has rendered the headings
    let attempts = 0
    const maxAttempts = 20
    const interval = setInterval(() => {
      attempts++
      if (setupObserver() || attempts >= maxAttempts) {
        clearInterval(interval)
      }
    }, 200)

    return () => {
      clearInterval(interval)
      observerRef.current?.disconnect()
    }
  }, [setupObserver])

  const handleClick = (e: React.MouseEvent, heading: Heading) => {
    e.preventDefault()
    const el = findHeadingByText(heading.text)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  if (headings.length === 0) return null

  return (
    <aside className="hidden w-56 shrink-0 xl:block">
      <div className="sticky top-24">
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          On this page
        </p>
        <nav className="mt-3 space-y-1">
          {headings.map((heading, i) => (
            <a
              key={`${heading.id}-${i}`}
              href={`#${heading.id}`}
              onClick={(e) => handleClick(e, heading)}
              className={`block text-sm transition-colors ${
                heading.level === 3 ? 'pl-3' : ''
              } ${
                activeIndex === i
                  ? 'font-medium text-accent'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              {heading.text}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  )
}
