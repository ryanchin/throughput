'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Editor } from '@tiptap/react'

interface SlashMenuItem {
  title: string
  description: string
  icon: string
  command: (editor: Editor) => void
}

const SLASH_ITEMS: SlashMenuItem[] = [
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: 'H1',
    command: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: 'Paragraph',
    description: 'Plain text block',
    icon: 'P',
    command: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    title: 'Bullet List',
    description: 'Unordered list',
    icon: '\u2022',
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: 'Numbered List',
    description: 'Ordered list',
    icon: '1.',
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: 'Task List',
    description: 'Checklist with toggles',
    icon: '\u2611',
    command: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    title: 'Code Block',
    description: 'Code snippet',
    icon: '</>',
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: 'Blockquote',
    description: 'Quote block',
    icon: '\u201C',
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: 'Divider',
    description: 'Horizontal rule',
    icon: '\u2014',
    command: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    title: 'Image',
    description: 'Add image by URL',
    icon: 'IMG',
    command: (editor) => {
      const url = window.prompt('Image URL:')
      if (url) editor.chain().focus().setImage({ src: url }).run()
    },
  },
  {
    title: 'Table',
    description: 'Insert table',
    icon: 'TBL',
    command: (editor) =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: 'Video',
    description: 'Upload or embed a video',
    icon: '\uD83C\uDFAC',
    command: () => {
      const event = new CustomEvent('open-video-upload')
      window.dispatchEvent(event)
    },
  },
  {
    title: 'Embed',
    description: 'YouTube, Vimeo, Loom, Figma...',
    icon: 'EMB',
    command: () => {
      // This triggers a special state - the BlockEditor handles the embed input UI
      const event = new CustomEvent('open-embed-input')
      window.dispatchEvent(event)
    },
  },
]

interface SlashMenuProps {
  editor: Editor
  isOpen: boolean
  onClose: () => void
}

export function SlashMenu({ editor, isOpen, onClose }: SlashMenuProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const filteredItems = SLASH_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase())
  )

  const executeCommand = useCallback(
    (item: SlashMenuItem) => {
      // Delete the slash and query text first
      const { from } = editor.state.selection
      const textBefore = editor.state.doc.textBetween(
        Math.max(0, from - query.length - 1),
        from,
        ''
      )
      const slashPos = textBefore.lastIndexOf('/')
      if (slashPos >= 0) {
        const deleteFrom = from - query.length - 1
        editor
          .chain()
          .focus()
          .deleteRange({ from: Math.max(0, deleteFrom), to: from })
          .run()
      }

      item.command(editor)
      onClose()
      setQuery('')
      setSelectedIndex(0)
    },
    [editor, query, onClose]
  )

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setSelectedIndex(0)
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredItems[selectedIndex]) {
          executeCommand(filteredItems[selectedIndex])
        }
      } else if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Backspace') {
        if (query.length === 0) {
          onClose()
        } else {
          setQuery((prev) => prev.slice(0, -1))
        }
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        setQuery((prev) => prev + e.key)
        setSelectedIndex(0)
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, query, selectedIndex, filteredItems, executeCommand, onClose])

  // Reset selection when filtered items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  if (!isOpen || filteredItems.length === 0) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-72 overflow-hidden rounded-xl border border-border bg-raised shadow-lg"
      data-testid="slash-menu"
    >
      <div className="max-h-80 overflow-y-auto p-1">
        {filteredItems.map((item, index) => (
          <button
            key={item.title}
            onClick={() => executeCommand(item)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
              index === selectedIndex
                ? 'bg-accent-muted text-foreground'
                : 'text-foreground-muted hover:bg-[var(--background-muted)] hover:text-foreground'
            }`}
            data-testid={`slash-item-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-xs font-medium">
              {item.icon}
            </span>
            <div>
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-foreground-subtle">{item.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
