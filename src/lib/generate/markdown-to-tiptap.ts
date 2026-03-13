// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TiptapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  text?: string
}

export interface TiptapDoc {
  type: 'doc'
  content: TiptapNode[]
}

// ---------------------------------------------------------------------------
// Inline mark parsing
// ---------------------------------------------------------------------------

/**
 * Parses inline bold and italic marks within a text string and returns an
 * array of Tiptap text nodes with the appropriate marks applied.
 *
 * Supports `**bold**`, `*italic*`, `_italic_`, and combinations like
 * `***bold italic***`.
 */
function parseInlineMarks(text: string): TiptapNode[] {
  const nodes: TiptapNode[] = []

  // Regex matches bold+italic (***), bold (**), or italic (* or _)
  // Order matters: longest delimiters first
  const inlineRegex =
    /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_)/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = inlineRegex.exec(text)) !== null) {
    // Push plain text before this match
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    }

    const boldItalic = match[2] // ***text***
    const bold = match[3] // **text**
    const italic = match[4] ?? match[5] // *text* or _text_

    if (boldItalic) {
      nodes.push({
        type: 'text',
        text: boldItalic,
        marks: [{ type: 'bold' }, { type: 'italic' }],
      })
    } else if (bold) {
      nodes.push({
        type: 'text',
        text: bold,
        marks: [{ type: 'bold' }],
      })
    } else if (italic) {
      nodes.push({
        type: 'text',
        text: italic,
        marks: [{ type: 'italic' }],
      })
    }

    lastIndex = match.index + match[0].length
  }

  // Push remaining plain text
  if (lastIndex < text.length) {
    nodes.push({ type: 'text', text: text.slice(lastIndex) })
  }

  return nodes
}

/**
 * Wraps inline-parsed text nodes in a paragraph node.
 */
function textToParagraph(text: string): TiptapNode {
  const content = parseInlineMarks(text)
  return { type: 'paragraph', content }
}

// ---------------------------------------------------------------------------
// Line classification helpers
// ---------------------------------------------------------------------------

interface ClassifiedLine {
  kind:
    | 'heading'
    | 'bullet'
    | 'ordered'
    | 'code_fence'
    | 'blockquote'
    | 'hr'
    | 'paragraph'
    | 'empty'
  level?: number // heading level or ordered list number
  content?: string // text content after the marker
}

function classifyLine(line: string): ClassifiedLine {
  // Empty line
  if (line.trim() === '') {
    return { kind: 'empty' }
  }

  // Horizontal rule
  if (/^---+\s*$/.test(line.trim()) || /^\*\*\*+\s*$/.test(line.trim())) {
    return { kind: 'hr' }
  }

  // Heading (# through ###)
  const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
  if (headingMatch) {
    return {
      kind: 'heading',
      level: headingMatch[1].length,
      content: headingMatch[2].trim(),
    }
  }

  // Code fence
  if (line.trimStart().startsWith('```')) {
    return { kind: 'code_fence', content: line.trimStart().slice(3).trim() }
  }

  // Bullet list item
  const bulletMatch = line.match(/^[\s]*[-*]\s+(.+)$/)
  if (bulletMatch) {
    return { kind: 'bullet', content: bulletMatch[1] }
  }

  // Ordered list item
  const orderedMatch = line.match(/^[\s]*(\d+)\.\s+(.+)$/)
  if (orderedMatch) {
    return {
      kind: 'ordered',
      level: parseInt(orderedMatch[1], 10),
      content: orderedMatch[2],
    }
  }

  // Blockquote
  const quoteMatch = line.match(/^>\s?(.*)$/)
  if (quoteMatch) {
    return { kind: 'blockquote', content: quoteMatch[1] }
  }

  // Plain paragraph
  return { kind: 'paragraph', content: line }
}

// ---------------------------------------------------------------------------
// Main converter
// ---------------------------------------------------------------------------

/**
 * Converts a markdown string into a Tiptap-compatible JSON document.
 *
 * This is a simple line-by-line converter designed for LLM-generated content
 * outlines. It supports headings (h1-h3), bold, italic, bullet lists, ordered
 * lists, fenced code blocks, blockquotes, horizontal rules, and plain
 * paragraphs.
 *
 * Limitations (by design):
 * - No nested lists
 * - No tables or images
 * - No link parsing
 *
 * @param markdown - The raw markdown string to convert
 * @returns A {@link TiptapDoc} JSON object ready for storage
 */
export function markdownToTiptap(markdown: string): TiptapDoc {
  const lines = markdown.split('\n')
  const nodes: TiptapNode[] = []

  let i = 0

  while (i < lines.length) {
    const classified = classifyLine(lines[i])

    switch (classified.kind) {
      case 'empty': {
        // Skip empty lines — they are paragraph separators
        i++
        break
      }

      case 'hr': {
        nodes.push({ type: 'horizontalRule' })
        i++
        break
      }

      case 'heading': {
        const content = parseInlineMarks(classified.content ?? '')
        nodes.push({
          type: 'heading',
          attrs: { level: classified.level },
          content,
        })
        i++
        break
      }

      case 'code_fence': {
        // Collect lines until closing fence
        const codeLines: string[] = []
        i++ // skip opening fence
        while (i < lines.length) {
          if (lines[i].trimStart().startsWith('```')) {
            i++ // skip closing fence
            break
          }
          codeLines.push(lines[i])
          i++
        }
        const codeText = codeLines.join('\n')
        nodes.push({
          type: 'codeBlock',
          content: codeText.length > 0 ? [{ type: 'text', text: codeText }] : undefined,
        })
        break
      }

      case 'bullet': {
        // Collect consecutive bullet items
        const items: TiptapNode[] = []
        while (i < lines.length) {
          const cl = classifyLine(lines[i])
          if (cl.kind !== 'bullet') break
          items.push({
            type: 'listItem',
            content: [textToParagraph(cl.content ?? '')],
          })
          i++
        }
        nodes.push({ type: 'bulletList', content: items })
        break
      }

      case 'ordered': {
        // Collect consecutive ordered items
        const items: TiptapNode[] = []
        while (i < lines.length) {
          const cl = classifyLine(lines[i])
          if (cl.kind !== 'ordered') break
          items.push({
            type: 'listItem',
            content: [textToParagraph(cl.content ?? '')],
          })
          i++
        }
        nodes.push({ type: 'orderedList', content: items })
        break
      }

      case 'blockquote': {
        // Collect consecutive blockquote lines
        const quoteLines: string[] = []
        while (i < lines.length) {
          const cl = classifyLine(lines[i])
          if (cl.kind !== 'blockquote') break
          quoteLines.push(cl.content ?? '')
          i++
        }
        nodes.push({
          type: 'blockquote',
          content: [textToParagraph(quoteLines.join(' '))],
        })
        break
      }

      case 'paragraph': {
        // Collect consecutive paragraph lines (non-empty, non-special)
        const paraLines: string[] = []
        while (i < lines.length) {
          const cl = classifyLine(lines[i])
          if (cl.kind !== 'paragraph') break
          paraLines.push(cl.content ?? '')
          i++
        }
        nodes.push(textToParagraph(paraLines.join(' ')))
        break
      }

      default: {
        // Safety fallback — should not reach here
        i++
        break
      }
    }
  }

  // If no nodes were produced, return a doc with an empty paragraph
  if (nodes.length === 0) {
    nodes.push({ type: 'paragraph', content: [] })
  }

  return { type: 'doc', content: nodes }
}
