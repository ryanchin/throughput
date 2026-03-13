'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { Markdown } from '@tiptap/markdown'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { JSONContent } from '@tiptap/react'

import { EmbedNode } from './extensions/EmbedNode'
import { VideoNode } from './extensions/VideoNode'
import { SlashMenu } from './SlashMenu'
import { BubbleToolbar } from './BubbleToolbar'
import { MarkdownImportModal } from './MarkdownImportModal'
import { EmbedInputPanel } from './EmbedInputPanel'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface BlockEditorProps {
  /** Initial Tiptap JSON content */
  initialContent?: JSONContent
  /** Called with Tiptap JSON when content auto-saves */
  onSave?: (content: JSONContent) => Promise<void>
  /** Whether the editor is editable (default: true) */
  editable?: boolean
  /** Placeholder text for empty editor */
  placeholder?: string
}

export default function BlockEditor({
  initialContent,
  onSave,
  editable = true,
  placeholder = 'Type / for commands...',
}: BlockEditorProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 })
  const [markdownModalOpen, setMarkdownModalOpen] = useState(false)
  const [embedPanelOpen, setEmbedPanelOpen] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Highlight.configure({ multicolor: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-accent underline' },
      }),
      Image.configure({ inline: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      Typography,
      TextStyle,
      Color,
      Markdown,
      EmbedNode,
      VideoNode,
    ],
    content: initialContent || '',
    editable,
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[200px] px-4 py-3',
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      // Check for slash command trigger
      const { from } = updatedEditor.state.selection
      const $from = updatedEditor.state.doc.resolve(from)
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)

      if (textBefore.endsWith('/') && (textBefore.length === 1 || textBefore.endsWith(' /'))) {
        // Get cursor position for slash menu placement
        const coords = updatedEditor.view.coordsAtPos(from)
        setSlashMenuPosition({ top: coords.bottom + 4, left: coords.left })
        setSlashMenuOpen(true)
      } else if (slashMenuOpen && !textBefore.includes('/')) {
        setSlashMenuOpen(false)
      }

      // Auto-save with debounce
      if (onSave && editable) {
        setSaveStatus('saving')
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(async () => {
          try {
            await onSave(updatedEditor.getJSON())
            setSaveStatus('saved')
            // Reset to idle after 2 seconds
            setTimeout(() => setSaveStatus('idle'), 2000)
          } catch {
            setSaveStatus('error')
          }
        }, 2000)
      }
    },
  })

  // Listen for embed input panel trigger from slash menu
  useEffect(() => {
    const handler = () => setEmbedPanelOpen(true)
    window.addEventListener('open-embed-input', handler)
    return () => window.removeEventListener('open-embed-input', handler)
  }, [])

  // Listen for video upload trigger from slash menu
  useEffect(() => {
    const handler = () => {
      if (editor) {
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'video',
            attrs: {
              videoId: '',
              title: '',
              duration: 0,
              status: 'uploading',
              uploadProgress: 0,
            },
          })
          .run()
      }
    }
    window.addEventListener('open-video-upload', handler)
    return () => window.removeEventListener('open-video-upload', handler)
  }, [editor])

  // Cleanup save timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const handleSlashMenuClose = useCallback(() => {
    setSlashMenuOpen(false)
  }, [])

  if (!editor) return null

  return (
    <div className="relative rounded-xl border border-border bg-surface" data-testid="block-editor">
      {/* Toolbar */}
      {editable && (
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMarkdownModalOpen(true)}
              className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground-muted transition-colors hover:bg-raised hover:text-foreground"
              title="Import Markdown"
            >
              Paste Markdown
            </button>
          </div>

          {/* Save status */}
          {onSave && (
            <div className="flex items-center gap-1.5 text-xs" data-testid="save-status">
              {saveStatus === 'saving' && <span className="text-warning">Saving...</span>}
              {saveStatus === 'saved' && <span className="text-success">Saved</span>}
              {saveStatus === 'error' && <span className="text-destructive">Error saving</span>}
            </div>
          )}
        </div>
      )}

      {/* Bubble toolbar for text selection */}
      {editable && <BubbleToolbar editor={editor} />}

      {/* Editor content */}
      <EditorContent editor={editor} />

      {/* Embed input panel */}
      {embedPanelOpen && (
        <div className="px-4">
          <EmbedInputPanel
            editor={editor}
            isOpen={embedPanelOpen}
            onClose={() => setEmbedPanelOpen(false)}
          />
        </div>
      )}

      {/* Slash command menu */}
      {slashMenuOpen && (
        <div style={{ position: 'fixed', top: slashMenuPosition.top, left: slashMenuPosition.left }}>
          <SlashMenu editor={editor} isOpen={slashMenuOpen} onClose={handleSlashMenuClose} />
        </div>
      )}

      {/* Markdown import modal */}
      <MarkdownImportModal
        editor={editor}
        isOpen={markdownModalOpen}
        onClose={() => setMarkdownModalOpen(false)}
      />
    </div>
  )
}
