'use client'

import { useState } from 'react'
import type { JSONContent } from '@tiptap/react'
import BlockEditor from '@/components/editor/BlockEditor'
import LessonViewer from '@/components/editor/LessonViewer'

/**
 * Test-only editor page outside the (app) route group.
 * Bypasses auth middleware for E2E testing of the block editor.
 * This page should not be deployed to production.
 */
export default function TestEditorPage() {
  const [content, setContent] = useState<JSONContent | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  async function handleSave(json: JSONContent) {
    setContent(json)
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-3xl font-bold text-foreground">Block Editor Test</h1>
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground hover:bg-raised"
            data-testid="toggle-preview"
          >
            {showPreview ? 'Show Editor' : 'Show Preview'}
          </button>
        </div>
        {showPreview && content ? (
          <LessonViewer content={content} />
        ) : (
          <BlockEditor onSave={handleSave} placeholder="Type / for commands..." />
        )}
      </div>
    </div>
  )
}
