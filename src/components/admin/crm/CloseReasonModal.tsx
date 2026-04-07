'use client'

import { useState } from 'react'
import { CLOSE_REASONS_WON, CLOSE_REASONS_LOST } from '@/lib/crm/constants'
import type { Stage } from '@/lib/crm/constants'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface CloseReasonModalProps {
  stage: '7a. Closed Won' | '7b. Closed Lost'
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
}

const REASON_LABELS: Record<string, string> = {
  price: 'Price',
  features: 'Features',
  relationship: 'Relationship',
  timing: 'Timing',
  budget: 'Budget',
  competitor: 'Competitor',
  no_decision: 'No Decision',
  other: 'Other',
}

export function CloseReasonModal({ stage, open, onOpenChange, onConfirm }: CloseReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState('')
  const reasons = stage === '7a. Closed Won' ? CLOSE_REASONS_WON : CLOSE_REASONS_LOST
  const title = stage === '7a. Closed Won' ? 'Why was this deal won?' : 'Why was this deal lost?'

  function handleConfirm() {
    if (!selectedReason) return
    onConfirm(selectedReason)
    setSelectedReason('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2" data-testid="close-reason-options">
          {reasons.map((reason) => (
            <label
              key={reason}
              className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                selectedReason === reason
                  ? 'border-accent bg-accent-muted'
                  : 'border-border bg-muted hover:bg-raised'
              }`}
            >
              <input
                type="radio"
                name="close-reason"
                value={reason}
                checked={selectedReason === reason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="size-4 text-accent focus:ring-accent"
                data-testid={`close-reason-${reason}`}
              />
              <span className="text-sm text-foreground">
                {REASON_LABELS[reason] ?? reason}
              </span>
            </label>
          ))}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg bg-muted border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-raised transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedReason}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow disabled:opacity-50"
            data-testid="close-reason-confirm"
          >
            Confirm
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
