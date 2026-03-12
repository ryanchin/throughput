'use client'

import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { parseEmbed } from '@/lib/editor/embed-utils'

interface EmbedInputPanelProps {
  editor: Editor
  isOpen: boolean
  onClose: () => void
}

export function EmbedInputPanel({ editor, isOpen, onClose }: EmbedInputPanelProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  function handleEmbed() {
    setError(null)
    const embedInfo = parseEmbed(input)

    if (!embedInfo) {
      setError('Could not parse URL or embed code. Try a YouTube, Vimeo, Loom, or Figma URL.')
      return
    }

    editor
      .chain()
      .focus()
      .insertContent({
        type: 'embed',
        attrs: {
          src: embedInfo.src,
          title: embedInfo.title,
          height:
            embedInfo.embedType === 'youtube' ||
            embedInfo.embedType === 'vimeo' ||
            embedInfo.embedType === 'loom'
              ? 315
              : 400,
          embedType: embedInfo.embedType,
        },
      })
      .run()

    setInput('')
    setError(null)
    onClose()
  }

  return (
    <div className="my-2 rounded-xl border border-border bg-raised p-4" data-testid="embed-input-panel">
      <p className="mb-2 text-sm font-medium text-foreground">Embed content</p>
      <p className="mb-3 text-xs text-foreground-muted">
        Paste a URL (YouTube, Vimeo, Loom, Figma, Google Slides) or an iframe embed code.
      </p>
      <input
        type="text"
        value={input}
        onChange={(e) => {
          setInput(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleEmbed()
          if (e.key === 'Escape') onClose()
        }}
        placeholder="https://youtube.com/watch?v=... or <iframe src=...>"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        data-testid="embed-url-input"
        autoFocus
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={() => {
            setInput('')
            setError(null)
            onClose()
          }}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-raised"
        >
          Cancel
        </button>
        <button
          onClick={handleEmbed}
          disabled={!input.trim()}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-hover disabled:opacity-50"
          data-testid="embed-submit-button"
        >
          Embed
        </button>
      </div>
    </div>
  )
}
