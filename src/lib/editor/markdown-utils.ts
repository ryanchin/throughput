/**
 * Detect whether a string of plain text appears to be Markdown.
 * Used for auto-detecting markdown on paste.
 *
 * Heuristic: returns true if 2+ lines match markdown patterns,
 * or if the text starts with a markdown heading.
 */
export function looksLikeMarkdown(text: string): boolean {
  if (!text || text.trim().length === 0) return false

  const lines = text.split('\n')

  // If starts with heading, very likely markdown
  if (/^#{1,6}\s+/.test(lines[0].trim())) return true

  let markdownSignals = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Heading
    if (/^#{1,6}\s+/.test(trimmed)) markdownSignals++
    // Unordered list
    else if (/^[-*+]\s+/.test(trimmed)) markdownSignals++
    // Ordered list
    else if (/^\d+\.\s+/.test(trimmed)) markdownSignals++
    // Task list
    else if (/^[-*]\s+\[[ x]\]\s+/i.test(trimmed)) markdownSignals++
    // Blockquote
    else if (/^>\s+/.test(trimmed)) markdownSignals++
    // Code fence
    else if (/^```/.test(trimmed)) markdownSignals++
    // Horizontal rule
    else if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) markdownSignals++
    // Bold or italic
    else if (/\*{1,2}[^*]+\*{1,2}/.test(trimmed) || /__[^_]+__/.test(trimmed))
      markdownSignals++
    // Link
    else if (/\[.+\]\(.+\)/.test(trimmed)) markdownSignals++

    // If we found 2+ signals, it's markdown
    if (markdownSignals >= 2) return true
  }

  return markdownSignals >= 2
}
