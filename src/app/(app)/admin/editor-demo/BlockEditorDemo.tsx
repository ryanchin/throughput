'use client'

import { useState } from 'react'
import type { JSONContent } from '@tiptap/react'
import BlockEditor from '@/components/editor/BlockEditor'
import LessonViewer from '@/components/editor/LessonViewer'

export default function BlockEditorDemo() {
  const [content, setContent] = useState<JSONContent | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  async function handleSave(json: JSONContent) {
    setContent(json)
    // In production, this would save to the database
    console.log('Saved content:', json)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-raised"
        >
          {showPreview ? 'Show Editor' : 'Show Learner Preview'}
        </button>
      </div>

      {showPreview && content ? (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground-muted">Learner View</h2>
          <LessonViewer content={content} />
        </div>
      ) : (
        <BlockEditor onSave={handleSave} placeholder="Type / for commands..." />
      )}
    </div>
  )
}
