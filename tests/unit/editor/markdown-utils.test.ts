import { describe, it, expect } from 'vitest'
import { looksLikeMarkdown } from '@/lib/editor/markdown-utils'

describe('looksLikeMarkdown', () => {
  it('returns true for text starting with a heading', () => {
    expect(looksLikeMarkdown('# Hello World')).toBe(true)
    expect(looksLikeMarkdown('## Section Title')).toBe(true)
    expect(looksLikeMarkdown('### Subsection')).toBe(true)
  })

  it('returns true for text with multiple markdown patterns', () => {
    const md = `# Title

Some paragraph text.

- Item one
- Item two
- Item three`
    expect(looksLikeMarkdown(md)).toBe(true)
  })

  it('returns true for text with ordered lists and bold', () => {
    const md = `1. First item
2. Second item with **bold**
3. Third item`
    expect(looksLikeMarkdown(md)).toBe(true)
  })

  it('returns true for text with code fences', () => {
    const md = '```javascript\nconsole.log("hello")\n```'
    expect(looksLikeMarkdown(md)).toBe(true)
  })

  it('returns true for blockquotes and links', () => {
    const md = `> This is a quote

See [this link](https://example.com) for more.`
    expect(looksLikeMarkdown(md)).toBe(true)
  })

  it('returns true for task lists', () => {
    const md = `- [ ] Todo item
- [x] Done item`
    expect(looksLikeMarkdown(md)).toBe(true)
  })

  it('returns true for horizontal rules', () => {
    const md = `Some text\n\n---\n\nMore text with **bold**`
    expect(looksLikeMarkdown(md)).toBe(true)
  })

  it('returns false for plain text without markdown', () => {
    expect(looksLikeMarkdown('Hello, this is just a regular sentence.')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(looksLikeMarkdown('')).toBe(false)
  })

  it('returns false for whitespace-only string', () => {
    expect(looksLikeMarkdown('   \n  \n   ')).toBe(false)
  })

  it('returns false for single line without heading', () => {
    expect(looksLikeMarkdown('Just one line of text')).toBe(false)
  })

  it('does not false-positive on # in middle of text', () => {
    expect(looksLikeMarkdown('Issue #42 is important')).toBe(false)
  })
})
