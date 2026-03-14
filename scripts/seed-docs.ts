/**
 * Seed script for importing markdown docs from src/content/docs/ into the database.
 *
 * Reads all markdown files, parses frontmatter, converts content to Tiptap JSON,
 * preserves the tree structure (parent-child from folder hierarchy), and inserts
 * into docs_pages with type='docs', visibility='public', status='published'.
 *
 * Run with: npx tsx scripts/seed-docs.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { createClient } from '@supabase/supabase-js'

const CONTENT_DIR = path.join(process.cwd(), 'src/content/docs')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ---- Markdown to Tiptap JSON conversion ----

interface TiptapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  text?: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
}

function markdownToTiptap(markdown: string): TiptapNode {
  const lines = markdown.split('\n')
  const content: TiptapNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Skip empty lines
    if (line.trim() === '') {
      i++
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      content.push({
        type: 'heading',
        attrs: { level },
        content: parseInlineContent(headingMatch[2]),
      })
      i++
      continue
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      content.push({ type: 'horizontalRule' })
      i++
      continue
    }

    // Code blocks
    if (line.trim().startsWith('```')) {
      const langMatch = line.trim().match(/^```(\w*)/)
      const language = langMatch?.[1] || null
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      content.push({
        type: 'codeBlock',
        attrs: language ? { language } : {},
        content: [{ type: 'text', text: codeLines.join('\n') }],
      })
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2))
        i++
      }
      content.push({
        type: 'blockquote',
        content: [{
          type: 'paragraph',
          content: parseInlineContent(quoteLines.join(' ')),
        }],
      })
      continue
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: TiptapNode[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const itemText = lines[i].replace(/^\d+\.\s/, '')
        items.push({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: parseInlineContent(itemText),
          }],
        })
        i++
      }
      content.push({
        type: 'orderedList',
        content: items,
      })
      continue
    }

    // Unordered list (bullet)
    if (/^[-*]\s/.test(line)) {
      const items: TiptapNode[] = []
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        const itemText = lines[i].replace(/^[-*]\s/, '')
        items.push({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: parseInlineContent(itemText),
          }],
        })
        i++
      }
      content.push({
        type: 'bulletList',
        content: items,
      })
      continue
    }

    // Task list
    if (/^- \[[ x]\]\s/.test(line)) {
      const items: TiptapNode[] = []
      while (i < lines.length && /^- \[[ x]\]\s/.test(lines[i])) {
        const checked = lines[i].includes('[x]')
        const itemText = lines[i].replace(/^- \[[ x]\]\s/, '')
        items.push({
          type: 'taskItem',
          attrs: { checked },
          content: [{
            type: 'paragraph',
            content: parseInlineContent(itemText),
          }],
        })
        i++
      }
      content.push({
        type: 'taskList',
        content: items,
      })
      continue
    }

    // Default: paragraph — collect consecutive non-special lines
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^#{1,3}\s/) &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('> ') &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^[-*]\s/.test(lines[i]) &&
      !/^- \[[ x]\]\s/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i])
      i++
    }

    if (paraLines.length > 0) {
      content.push({
        type: 'paragraph',
        content: parseInlineContent(paraLines.join(' ')),
      })
    }
  }

  // If no content was parsed, add an empty paragraph
  if (content.length === 0) {
    content.push({ type: 'paragraph' })
  }

  return {
    type: 'doc',
    content,
  }
}

function parseInlineContent(text: string): TiptapNode[] {
  if (!text || text.trim() === '') {
    return [{ type: 'text', text: ' ' }]
  }

  const nodes: TiptapNode[] = []
  // Regex to find bold, italic, inline code, and links
  const inlineRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = inlineRegex.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index)
      if (beforeText) {
        nodes.push({ type: 'text', text: beforeText })
      }
    }

    if (match[2]) {
      // Bold: **text**
      nodes.push({
        type: 'text',
        text: match[2],
        marks: [{ type: 'bold' }],
      })
    } else if (match[3]) {
      // Italic: *text*
      nodes.push({
        type: 'text',
        text: match[3],
        marks: [{ type: 'italic' }],
      })
    } else if (match[4]) {
      // Inline code: `text`
      nodes.push({
        type: 'text',
        text: match[4],
        marks: [{ type: 'code' }],
      })
    } else if (match[5] && match[6]) {
      // Link: [text](url)
      nodes.push({
        type: 'text',
        text: match[5],
        marks: [{ type: 'link', attrs: { href: match[6], target: '_blank' } }],
      })
    }

    lastIndex = match.index + match[0].length
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex)
    if (remaining) {
      nodes.push({ type: 'text', text: remaining })
    }
  }

  // If nothing was parsed, return plain text
  if (nodes.length === 0) {
    return [{ type: 'text', text }]
  }

  return nodes
}

// ---- Tree structure and seeding ----

interface DocEntry {
  title: string
  slug: string
  content: TiptapNode | null
  orderIndex: number
  children: DocEntry[]
}

function getSectionMeta(dirPath: string): { title: string; position: number } | null {
  const sectionPath = path.join(dirPath, '_section.json')
  if (fs.existsSync(sectionPath)) {
    return JSON.parse(fs.readFileSync(sectionPath, 'utf-8'))
  }
  return null
}

function formatTitle(name: string): string {
  return name
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildDocTree(dirPath: string): DocEntry[] {
  if (!fs.existsSync(dirPath)) return []

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const items: DocEntry[] = []

  // Process directories
  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const childDir = path.join(dirPath, entry.name)
    const sectionMeta = getSectionMeta(childDir)
    const children = buildDocTree(childDir)

    let title = sectionMeta?.title || formatTitle(entry.name)
    const orderIndex = sectionMeta?.position ?? 999

    // Check for overview.md or index.md as the section's content
    let content: TiptapNode | null = null
    const overviewPath = path.join(childDir, 'overview.md')
    const indexPath = path.join(childDir, 'index.md')

    if (fs.existsSync(overviewPath)) {
      const raw = fs.readFileSync(overviewPath, 'utf-8')
      const { data, content: mdContent } = matter(raw)
      if (data.title && !sectionMeta?.title) title = data.title
      content = markdownToTiptap(mdContent)
    } else if (fs.existsSync(indexPath)) {
      const raw = fs.readFileSync(indexPath, 'utf-8')
      const { data, content: mdContent } = matter(raw)
      if (data.title && !sectionMeta?.title) title = data.title
      content = markdownToTiptap(mdContent)
    }

    // Filter out overview/index from children
    const filteredChildren = children.filter(
      (c) => c.slug !== 'overview' && c.slug !== 'index'
    )

    // Clean title
    title = title
      .replace(/\s*--\s*Overview$/i, '')
      .replace(/\s+Overview$/i, '')
      .trim()

    items.push({
      title,
      slug: entry.name,
      content,
      orderIndex,
      children: filteredChildren,
    })
  }

  // Process files
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    if (entry.name === 'intro.md') continue // handled separately
    const baseName = entry.name.replace(/\.md$/, '')
    if (baseName === 'overview' || baseName === 'index') continue

    const filePath = path.join(dirPath, entry.name)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const { data, content: mdContent } = matter(raw)

    items.push({
      title: data.title || formatTitle(baseName),
      slug: baseName,
      content: markdownToTiptap(mdContent),
      orderIndex: data.sidebar_position ?? 999,
      children: [],
    })
  }

  // Sort by order index, then alphabetically
  items.sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
    return a.title.localeCompare(b.title)
  })

  return items
}

async function insertEntries(entries: DocEntry[], parentId: string | null): Promise<number> {
  let count = 0

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]

    const { data: page, error } = await supabase
      .from('docs_pages')
      .insert({
        title: entry.title,
        slug: entry.slug,
        content: entry.content,
        parent_id: parentId,
        order_index: i,
        status: 'published',
        visibility: 'public',
        type: 'docs',
      })
      .select('id')
      .single()

    if (error) {
      console.error(`Failed to insert "${entry.title}":`, error.message)
      continue
    }

    count++
    console.log(`  ${'  '.repeat(parentId ? 1 : 0)}+ ${entry.title} (${entry.slug})`)

    if (entry.children.length > 0 && page) {
      count += await insertEntries(entry.children, page.id)
    }
  }

  return count
}

async function main() {
  console.log('Seeding docs pages from src/content/docs/...\n')

  // Check if docs pages already exist
  const { count } = await supabase
    .from('docs_pages')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'docs')

  if (count && count > 0) {
    console.log(`Found ${count} existing docs pages. Deleting them first...\n`)
    const { error: deleteError } = await supabase
      .from('docs_pages')
      .delete()
      .eq('type', 'docs')

    if (deleteError) {
      console.error('Failed to delete existing docs pages:', deleteError.message)
      process.exit(1)
    }
  }

  // Insert intro page first
  const introPath = path.join(CONTENT_DIR, 'intro.md')
  let introCount = 0
  if (fs.existsSync(introPath)) {
    const raw = fs.readFileSync(introPath, 'utf-8')
    const { data, content: mdContent } = matter(raw)
    const tiptapContent = markdownToTiptap(mdContent)

    const { error } = await supabase
      .from('docs_pages')
      .insert({
        title: data.title || 'Welcome to AAVA',
        slug: 'intro',
        content: tiptapContent,
        parent_id: null,
        order_index: 0,
        status: 'published',
        visibility: 'public',
        type: 'docs',
      })

    if (error) {
      console.error('Failed to insert intro page:', error.message)
    } else {
      console.log('  + Welcome to AAVA (intro)')
      introCount = 1
    }
  }

  // Build and insert the tree
  const tree = buildDocTree(CONTENT_DIR)
  const treeCount = await insertEntries(tree, null)

  console.log(`\nDone! Seeded ${introCount + treeCount} docs pages.`)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
