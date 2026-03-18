'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  material: {
    title: string
    share_token: string | null
    shareable: boolean
  } | null
}

export function ShareDialog({ open, onOpenChange, material }: ShareDialogProps) {
  const [copied, setCopied] = useState(false)

  if (!material || !material.shareable || !material.share_token) return null

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/materials/${material.share_token}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input')
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-raised border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Share with Prospect</DialogTitle>
          <DialogDescription className="text-foreground-muted">
            Copy the public link below to share &ldquo;{material.title}&rdquo; with a prospect. No login required.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-background border border-border text-foreground text-sm rounded-lg px-3 py-2 outline-none"
              data-testid="share-url-input"
            />
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors"
              data-testid="copy-share-link"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
