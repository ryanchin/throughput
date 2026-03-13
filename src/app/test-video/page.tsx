'use client'

import { useState } from 'react'
import type { JSONContent } from '@tiptap/react'
import BlockEditor from '@/components/editor/BlockEditor'

/**
 * Test-only video upload page outside the (app) route group.
 * Bypasses auth middleware for E2E testing of video block states.
 * This page should not be deployed to production.
 *
 * Since VideoNode uses DOM-based node views (not React), we test by
 * inserting video nodes with different attrs into the BlockEditor.
 */

type VideoState = 'dropzone' | 'uploading' | 'processing' | 'ready' | 'error'

const VIDEO_STATES: Record<VideoState, JSONContent> = {
  dropzone: {
    type: 'doc',
    content: [
      {
        type: 'video',
        attrs: {
          videoId: '',
          title: '',
          duration: 0,
          status: '', // empty/unrecognized status triggers the dropzone fallback branch
          uploadProgress: 0,
        },
      },
    ],
  },
  uploading: {
    type: 'doc',
    content: [
      {
        type: 'video',
        attrs: {
          videoId: 'test-upload-123',
          title: '',
          duration: 0,
          status: 'uploading',
          uploadProgress: 65,
        },
      },
    ],
  },
  processing: {
    type: 'doc',
    content: [
      {
        type: 'video',
        attrs: {
          videoId: 'test-processing-456',
          title: '',
          duration: 0,
          status: 'processing',
          uploadProgress: 100,
        },
      },
    ],
  },
  ready: {
    type: 'doc',
    content: [
      {
        type: 'video',
        attrs: {
          videoId: 'test-ready-789',
          title: 'Introduction to AAVA',
          duration: 300,
          status: 'ready',
          uploadProgress: 100,
        },
      },
    ],
  },
  error: {
    type: 'doc',
    content: [
      {
        type: 'video',
        attrs: {
          videoId: '',
          title: '',
          duration: 0,
          status: 'error',
          uploadProgress: 0,
        },
      },
    ],
  },
}

export default function TestVideoPage() {
  const [activeState, setActiveState] = useState<VideoState>('dropzone')
  // Use a key to force BlockEditor remount when state changes
  const [editorKey, setEditorKey] = useState(0)

  function switchState(state: VideoState) {
    setActiveState(state)
    setEditorKey((k) => k + 1)
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <h1 className="text-2xl font-bold text-foreground">Video Upload Test Page</h1>

        {/* State switcher buttons */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-4" data-testid="state-switcher">
          {(Object.keys(VIDEO_STATES) as VideoState[]).map((state) => (
            <button
              key={state}
              onClick={() => switchState(state)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                activeState === state
                  ? 'bg-accent text-background'
                  : 'bg-muted text-foreground'
              }`}
              data-testid={`state-${state}`}
            >
              {state.charAt(0).toUpperCase() + state.slice(1)}
            </button>
          ))}
        </div>

        {/* Active state label */}
        <p className="text-sm text-foreground-muted" data-testid="active-state-label">
          Current state: <span className="font-medium text-foreground">{activeState}</span>
        </p>

        {/* Block editor with video node */}
        <div data-testid="editor-container">
          <BlockEditor
            key={editorKey}
            initialContent={VIDEO_STATES[activeState]}
            editable={true}
          />
        </div>
      </div>
    </div>
  )
}
