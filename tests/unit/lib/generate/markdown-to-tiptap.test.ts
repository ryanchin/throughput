import { describe, it, expect } from 'vitest'
import { markdownToTiptap } from '@/lib/generate/markdown-to-tiptap'

describe('markdownToTiptap', () => {
  it('converts headings with correct levels', () => {
    const doc = markdownToTiptap('# Heading 1\n## Heading 2\n### Heading 3')

    expect(doc.content).toHaveLength(3)
    expect(doc.content[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 1 },
    })
    expect(doc.content[0].content?.[0]?.text).toBe('Heading 1')

    expect(doc.content[1]).toMatchObject({
      type: 'heading',
      attrs: { level: 2 },
    })
    expect(doc.content[1].content?.[0]?.text).toBe('Heading 2')

    expect(doc.content[2]).toMatchObject({
      type: 'heading',
      attrs: { level: 3 },
    })
    expect(doc.content[2].content?.[0]?.text).toBe('Heading 3')
  })

  it('converts bold text to a text node with bold mark', () => {
    const doc = markdownToTiptap('**bold text**')

    expect(doc.content).toHaveLength(1)
    expect(doc.content[0].type).toBe('paragraph')
    const textNode = doc.content[0].content?.[0]
    expect(textNode?.text).toBe('bold text')
    expect(textNode?.marks).toEqual([{ type: 'bold' }])
  })

  it('converts italic text to a text node with italic mark', () => {
    const doc = markdownToTiptap('*italic text*')

    expect(doc.content).toHaveLength(1)
    const textNode = doc.content[0].content?.[0]
    expect(textNode?.text).toBe('italic text')
    expect(textNode?.marks).toEqual([{ type: 'italic' }])
  })

  it('handles mixed bold and italic in the same paragraph', () => {
    const doc = markdownToTiptap('**bold** and *italic*')

    expect(doc.content).toHaveLength(1)
    const nodes = doc.content[0].content ?? []

    expect(nodes).toHaveLength(3)
    expect(nodes[0]).toMatchObject({
      type: 'text',
      text: 'bold',
      marks: [{ type: 'bold' }],
    })
    expect(nodes[1]).toMatchObject({ type: 'text', text: ' and ' })
    expect(nodes[2]).toMatchObject({
      type: 'text',
      text: 'italic',
      marks: [{ type: 'italic' }],
    })
  })

  it('groups consecutive bullet items into a single bulletList', () => {
    const doc = markdownToTiptap('- Item one\n- Item two\n- Item three')

    expect(doc.content).toHaveLength(1)
    expect(doc.content[0].type).toBe('bulletList')
    expect(doc.content[0].content).toHaveLength(3)

    const items = doc.content[0].content ?? []
    expect(items[0].type).toBe('listItem')
    expect(items[0].content?.[0]?.content?.[0]?.text).toBe('Item one')
    expect(items[1].content?.[0]?.content?.[0]?.text).toBe('Item two')
    expect(items[2].content?.[0]?.content?.[0]?.text).toBe('Item three')
  })

  it('groups consecutive ordered items into a single orderedList', () => {
    const doc = markdownToTiptap('1. First\n2. Second\n3. Third')

    expect(doc.content).toHaveLength(1)
    expect(doc.content[0].type).toBe('orderedList')
    expect(doc.content[0].content).toHaveLength(3)

    const items = doc.content[0].content ?? []
    expect(items[0].type).toBe('listItem')
    expect(items[0].content?.[0]?.content?.[0]?.text).toBe('First')
  })

  it('converts fenced code blocks to codeBlock nodes', () => {
    const doc = markdownToTiptap('```\nconst x = 1;\nconsole.log(x);\n```')

    expect(doc.content).toHaveLength(1)
    expect(doc.content[0].type).toBe('codeBlock')
    expect(doc.content[0].content?.[0]?.text).toBe(
      'const x = 1;\nconsole.log(x);'
    )
  })

  it('converts blockquote lines to a blockquote node', () => {
    const doc = markdownToTiptap('> This is a quote')

    expect(doc.content).toHaveLength(1)
    expect(doc.content[0].type).toBe('blockquote')
    expect(doc.content[0].content?.[0]?.content?.[0]?.text).toBe(
      'This is a quote'
    )
  })

  it('converts horizontal rule (---) to a horizontalRule node', () => {
    const doc = markdownToTiptap('---')

    expect(doc.content).toHaveLength(1)
    expect(doc.content[0].type).toBe('horizontalRule')
  })

  it('converts plain text to a paragraph node', () => {
    const doc = markdownToTiptap('Just some regular text.')

    expect(doc.content).toHaveLength(1)
    expect(doc.content[0].type).toBe('paragraph')
    expect(doc.content[0].content?.[0]?.text).toBe(
      'Just some regular text.'
    )
  })

  it('returns a doc with an empty paragraph for empty input', () => {
    const doc = markdownToTiptap('')

    expect(doc.type).toBe('doc')
    expect(doc.content).toHaveLength(1)
    expect(doc.content[0].type).toBe('paragraph')
    expect(doc.content[0].content).toEqual([])
  })

  it('converts multiple sections into the correct node structure', () => {
    const md = [
      '# Introduction',
      '',
      'Welcome to the course.',
      '',
      '- Point A',
      '- Point B',
      '',
      '## Details',
      '',
      'More information here.',
    ].join('\n')

    const doc = markdownToTiptap(md)

    expect(doc.content[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 1 },
    })
    expect(doc.content[1].type).toBe('paragraph')
    expect(doc.content[2].type).toBe('bulletList')
    expect(doc.content[3]).toMatchObject({
      type: 'heading',
      attrs: { level: 2 },
    })
    expect(doc.content[4].type).toBe('paragraph')
    expect(doc.content).toHaveLength(5)
  })

  it('does not produce empty paragraph nodes from blank lines', () => {
    const md = '# Title\n\n\n\nSome text\n\n\n'
    const doc = markdownToTiptap(md)

    const emptyParagraphs = doc.content.filter(
      (node) =>
        node.type === 'paragraph' &&
        (!node.content || node.content.length === 0)
    )
    expect(emptyParagraphs).toHaveLength(0)
  })
})
