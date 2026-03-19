import type { JSONContent } from '@tiptap/react'

export interface ContentPage {
  /** Page title extracted from the ## heading. Null for the first page if content starts without a heading. */
  title: string | null
  /** Tiptap JSON content for this page (a doc node with a subset of the original content). */
  content: JSONContent
}

/**
 * Split Tiptap JSON content into pages at `## heading` (level 2) boundaries.
 *
 * Each page contains all content from one ## heading to the next.
 * Content before the first ## heading becomes the first page (with title = null).
 * If there are no ## headings, returns a single page with all content.
 *
 * @param content - The full Tiptap JSON content of a lesson
 * @returns Array of pages, each with a title and content fragment
 */
export function splitContentIntoPages(content: JSONContent | null | undefined): ContentPage[] {
  if (!content?.content || content.content.length === 0) {
    return [{ title: null, content: { type: 'doc', content: [] } }]
  }

  const pages: ContentPage[] = []
  let currentNodes: JSONContent[] = []
  let currentTitle: string | null = null

  for (const node of content.content) {
    if (isLevel2Heading(node)) {
      // Flush the current page if it has content
      if (currentNodes.length > 0) {
        pages.push({
          title: currentTitle,
          content: { type: 'doc', content: currentNodes },
        })
      }

      // Start a new page with this heading's text as title
      currentTitle = extractHeadingText(node)
      currentNodes = [node]
    } else {
      currentNodes.push(node)
    }
  }

  // Flush the last page
  if (currentNodes.length > 0) {
    pages.push({
      title: currentTitle,
      content: { type: 'doc', content: currentNodes },
    })
  }

  // If no pages were created (shouldn't happen but safety), return full content as one page
  if (pages.length === 0) {
    return [{ title: null, content }]
  }

  return pages
}

/**
 * Extract page titles from content without creating full page objects.
 * Used by the sidebar to show page-level TOC without rendering content.
 */
export function extractPageTitles(content: JSONContent | null | undefined): string[] {
  if (!content?.content) return []

  const titles: string[] = []
  let hasPreHeadingContent = false
  let foundFirstHeading = false

  for (const node of content.content) {
    if (isLevel2Heading(node)) {
      if (!foundFirstHeading && hasPreHeadingContent) {
        titles.push('Introduction')
      }
      foundFirstHeading = true
      titles.push(extractHeadingText(node) || 'Untitled Section')
    } else if (!foundFirstHeading) {
      hasPreHeadingContent = true
    }
  }

  // If no headings found, return empty (single page — no TOC needed)
  if (!foundFirstHeading) return []

  // If there was pre-heading content but we already added "Introduction", we're done
  // If the first node IS a heading, titles already captured it
  return titles
}

/** Check if a Tiptap node is a level 2 heading. */
function isLevel2Heading(node: JSONContent): boolean {
  return node.type === 'heading' && node.attrs?.level === 2
}

/** Extract plain text from a heading node's content. */
function extractHeadingText(node: JSONContent): string {
  if (!node.content) return ''
  return node.content
    .filter((child) => child.type === 'text')
    .map((child) => child.text ?? '')
    .join('')
}
