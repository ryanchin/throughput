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
import Typography from '@tiptap/extension-typography'
import type { JSONContent } from '@tiptap/react'

import { EmbedNode } from './extensions/EmbedNode'

interface LessonViewerProps {
  content: JSONContent
}

export default function LessonViewer({ content }: LessonViewerProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Highlight,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-accent underline',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Image,
      Table,
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem,
      Typography,
      EmbedNode,
    ],
    content,
    editable: false,
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none px-4 py-6',
      },
    },
  })

  if (!editor) return null

  return (
    <div className="rounded-xl border border-border bg-surface" data-testid="lesson-viewer">
      <EditorContent editor={editor} />
    </div>
  )
}
