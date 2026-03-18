'use client'

import { useState } from 'react'
import { ShareDialog } from '@/components/sales/ShareDialog'

interface ShareButtonProps {
  title: string
  shareToken: string
}

export function ShareButton({ title, shareToken }: ShareButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:border-accent/30 hover:text-accent transition-colors"
        data-testid="detail-share-button"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        Share with Prospect
      </button>
      <ShareDialog
        open={open}
        onOpenChange={setOpen}
        material={{ title, share_token: shareToken, shareable: true }}
      />
    </>
  )
}
