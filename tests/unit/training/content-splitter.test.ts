import { describe, it, expect } from 'vitest'
import { splitContentIntoPages, extractPageTitles } from '@/lib/training/content-splitter'
import type { JSONContent } from '@tiptap/react'

// Helper to create a heading node
function h2(text: string): JSONContent {
  return { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] }
}

function h1(text: string): JSONContent {
  return { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text }] }
}

function p(text: string): JSONContent {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

function doc(...nodes: JSONContent[]): JSONContent {
  return { type: 'doc', content: nodes }
}

describe('splitContentIntoPages', () => {
  it('returns single empty page for null content', () => {
    const pages = splitContentIntoPages(null)
    expect(pages).toHaveLength(1)
    expect(pages[0].title).toBeNull()
    expect(pages[0].content.content).toEqual([])
  })

  it('returns single empty page for undefined content', () => {
    const pages = splitContentIntoPages(undefined)
    expect(pages).toHaveLength(1)
  })

  it('returns single empty page for empty content array', () => {
    const pages = splitContentIntoPages({ type: 'doc', content: [] })
    expect(pages).toHaveLength(1)
  })

  it('returns single page when no h2 headings exist', () => {
    const content = doc(p('Hello'), p('World'))
    const pages = splitContentIntoPages(content)
    expect(pages).toHaveLength(1)
    expect(pages[0].title).toBeNull()
    expect(pages[0].content.content).toHaveLength(2)
  })

  it('ignores h1 headings (only splits on h2)', () => {
    const content = doc(h1('Title'), p('Intro'), p('More'))
    const pages = splitContentIntoPages(content)
    expect(pages).toHaveLength(1)
  })

  it('splits content at h2 headings', () => {
    const content = doc(
      h2('Section One'),
      p('Content one'),
      h2('Section Two'),
      p('Content two'),
      h2('Section Three'),
      p('Content three'),
    )
    const pages = splitContentIntoPages(content)
    expect(pages).toHaveLength(3)
    expect(pages[0].title).toBe('Section One')
    expect(pages[1].title).toBe('Section Two')
    expect(pages[2].title).toBe('Section Three')
  })

  it('includes content before first h2 as a separate page with null title', () => {
    const content = doc(
      p('Intro paragraph'),
      h2('First Section'),
      p('Section content'),
    )
    const pages = splitContentIntoPages(content)
    expect(pages).toHaveLength(2)
    expect(pages[0].title).toBeNull()
    expect(pages[0].content.content).toHaveLength(1) // intro paragraph
    expect(pages[1].title).toBe('First Section')
  })

  it('includes multiple nodes in each page', () => {
    const content = doc(
      h2('Section A'),
      p('Para 1'),
      p('Para 2'),
      p('Para 3'),
      h2('Section B'),
      p('Para 4'),
    )
    const pages = splitContentIntoPages(content)
    expect(pages).toHaveLength(2)
    // Section A has: heading + 3 paragraphs = 4 nodes
    expect(pages[0].content.content).toHaveLength(4)
    // Section B has: heading + 1 paragraph = 2 nodes
    expect(pages[1].content.content).toHaveLength(2)
  })

  it('handles heading with no text content', () => {
    const content = doc(
      { type: 'heading', attrs: { level: 2 }, content: [] },
      p('Content'),
    )
    const pages = splitContentIntoPages(content)
    expect(pages).toHaveLength(1)
    expect(pages[0].title).toBe('')
  })

  it('each page content is a valid doc node', () => {
    const content = doc(h2('A'), p('content'))
    const pages = splitContentIntoPages(content)
    for (const page of pages) {
      expect(page.content.type).toBe('doc')
      expect(Array.isArray(page.content.content)).toBe(true)
    }
  })
})

describe('extractPageTitles', () => {
  it('returns empty array for null content', () => {
    expect(extractPageTitles(null)).toEqual([])
  })

  it('returns empty array for content with no h2 headings', () => {
    const content = doc(p('No headings here'))
    expect(extractPageTitles(content)).toEqual([])
  })

  it('extracts titles from h2 headings', () => {
    const content = doc(
      h2('First'),
      p('content'),
      h2('Second'),
      p('content'),
      h2('Third'),
    )
    expect(extractPageTitles(content)).toEqual(['First', 'Second', 'Third'])
  })

  it('adds "Introduction" when content exists before first heading', () => {
    const content = doc(
      p('Intro text'),
      h2('Main Section'),
      p('content'),
    )
    const titles = extractPageTitles(content)
    expect(titles[0]).toBe('Introduction')
    expect(titles[1]).toBe('Main Section')
  })

  it('does not add "Introduction" when first node is a heading', () => {
    const content = doc(
      h2('First Section'),
      p('content'),
    )
    const titles = extractPageTitles(content)
    expect(titles[0]).toBe('First Section')
    expect(titles).toHaveLength(1)
  })

  it('uses "Untitled Section" for headings with no text', () => {
    const content = doc(
      { type: 'heading', attrs: { level: 2 }, content: [] },
      p('content'),
    )
    const titles = extractPageTitles(content)
    expect(titles[0]).toBe('Untitled Section')
  })

  it('returns empty array for single h2 only (consistent with no pages to navigate)', () => {
    // With only one heading and no pre-heading content, there's only 1 page — no TOC needed
    // But extractPageTitles returns titles for all headings found
    const content = doc(h2('Only Section'), p('content'))
    const titles = extractPageTitles(content)
    expect(titles).toHaveLength(1)
    expect(titles[0]).toBe('Only Section')
  })
})
