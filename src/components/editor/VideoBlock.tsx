'use client'

import { useState, useEffect } from 'react'

interface VideoBlockViewProps {
  videoId: string
  title?: string
}

/**
 * Learner-facing video player component.
 * Fetches a signed playback URL and renders the Bunny.net Stream iframe.
 */
export default function VideoBlockView({ videoId, title }: VideoBlockViewProps) {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSignedUrl() {
      try {
        const res = await fetch(`/api/video/signed/${videoId}`)
        if (!res.ok) {
          setError('Unable to load video')
          return
        }
        const data = await res.json()
        setIframeUrl(data.iframe)
      } catch {
        setError('Unable to load video')
      } finally {
        setLoading(false)
      }
    }

    if (videoId) fetchSignedUrl()
  }, [videoId])

  if (loading) {
    return (
      <div
        className="my-4 rounded-xl border border-border bg-surface p-6 text-center"
        data-testid={`video-loading-${videoId}`}
      >
        <p className="text-sm text-foreground-muted">Loading video...</p>
      </div>
    )
  }

  if (error || !iframeUrl) {
    return (
      <div
        className="my-4 rounded-xl border border-border bg-surface p-6 text-center"
        data-testid={`video-error-${videoId}`}
      >
        <p className="text-sm text-destructive">{error || 'Video unavailable'}</p>
      </div>
    )
  }

  return (
    <div
      className="my-4 rounded-xl border border-border bg-surface overflow-hidden"
      data-testid={`video-player-${videoId}`}
    >
      <iframe
        src={iframeUrl}
        width="100%"
        height="360"
        style={{ border: 'none' }}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        data-testid="video-player-iframe"
      />
      {title && (
        <div className="px-4 py-2 border-t border-border">
          <p className="text-sm text-foreground-muted">{title}</p>
        </div>
      )}
    </div>
  )
}
