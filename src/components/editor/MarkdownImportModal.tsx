'use client'

import { useState } from 'react'
import type { Editor } from '@tiptap/react'

interface MarkdownImportModalProps {
  editor: Editor
  isOpen: boolean
  onClose: () => void
}

export function MarkdownImportModal({ editor, isOpen, onClose }: MarkdownImportModalProps) {
  const [markdown, setMarkdown] = useState('')

  if (!isOpen) return null

  const hasContent = !editor.isEmpty

  function handleImport() {
    if (!markdown.trim()) return

    if (hasContent) {
      const confirmed = window.confirm('This will replace all existing content. Continue?')
      if (!confirmed) return
    }

    // Use the markdown extension to set content
    editor.commands.setContent(markdown)
    setMarkdown('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-raised p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">Import Markdown</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Paste your Markdown content below. It will be converted to rich editor blocks.
        </p>

        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          placeholder="# Paste your markdown here..."
          className="mt-4 h-64 w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-sm text-foreground placeholder:text-foreground-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          data-testid="markdown-import-textarea"
          autoFocus
        />

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-foreground-subtle">
            {hasContent && 'Warning: existing content will be replaced.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setMarkdown('')
                onClose()
              }}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-raised"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!markdown.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background shadow-accent-glow transition-colors hover:bg-accent-hover disabled:opacity-50"
              data-testid="markdown-import-button"
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
