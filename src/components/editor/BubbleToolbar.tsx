'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Editor } from '@tiptap/react'

interface BubbleToolbarProps {
  editor: Editor
}

const ToolbarButton = ({
  onClick,
  isActive,
  children,
  title,
}: {
  onClick: () => void
  isActive: boolean
  children: React.ReactNode
  title: string
}) => (
  <button
    onClick={onClick}
    title={title}
    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
      isActive
        ? 'bg-accent text-background'
        : 'text-foreground-muted hover:bg-[var(--background-muted)] hover:text-foreground'
    }`}
  >
    {children}
  </button>
)

export function BubbleToolbar({ editor }: BubbleToolbarProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const updatePosition = useCallback(() => {
    const { from, to, empty } = editor.state.selection

    if (empty || from === to) {
      setIsVisible(false)
      return
    }

    // Get the coordinates of the selection
    const start = editor.view.coordsAtPos(from)
    const end = editor.view.coordsAtPos(to)

    // Position above the selection, centered
    const left = (start.left + end.left) / 2
    const top = start.top - 8

    setPosition({ top, left })
    setIsVisible(true)
  }, [editor])

  useEffect(() => {
    editor.on('selectionUpdate', updatePosition)
    editor.on('blur', () => setIsVisible(false))

    return () => {
      editor.off('selectionUpdate', updatePosition)
    }
  }, [editor, updatePosition])

  if (!isVisible) return null

  return (
    <div
      className="fixed z-50 flex items-center gap-0.5 rounded-lg border border-border bg-raised p-1 shadow-lg"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translate(-50%, -100%)',
      }}
      data-testid="bubble-toolbar"
    >
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold"
      >
        B
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic"
      >
        I
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline"
      >
        U
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        title="Code"
      >
        {'</>'}
      </ToolbarButton>
      <ToolbarButton
        onClick={() => {
          const url = window.prompt('URL:')
          if (url) editor.chain().focus().setLink({ href: url }).run()
          else editor.chain().focus().unsetLink().run()
        }}
        isActive={editor.isActive('link')}
        title="Link"
      >
        Link
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive('highlight')}
        title="Highlight"
      >
        HL
      </ToolbarButton>
    </div>
  )
}
