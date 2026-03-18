'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { MATERIAL_TYPE_LABELS, type MaterialType } from '@/lib/sales/validation'

interface MaterialCardProps {
  material: {
    id: string
    title: string
    slug: string
    description: string | null
    material_type: string
    category: string | null
    file_name: string | null
    file_mime_type: string | null
    shareable: boolean
    share_token: string | null
    updated_at: string
  }
  onShare?: (material: MaterialCardProps['material']) => void
}

export default function MaterialCard({ material, onShare }: MaterialCardProps) {
  const typeLabel = MATERIAL_TYPE_LABELS[material.material_type as MaterialType] ?? material.material_type

  return (
    <div
      className="group relative bg-surface border border-border rounded-xl shadow-card transition-all hover:border-accent/30 hover:shadow-accent-glow"
      data-testid="material-card"
      data-material-slug={material.slug}
    >
      <Link href={`/sales/materials/${material.slug}`} className="block p-4 space-y-3">
        {/* Type badge */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center rounded-full bg-secondary-muted px-2.5 py-0.5 text-xs font-medium text-secondary">
            {typeLabel}
          </span>
          {material.file_name && (
            <span className="text-xs text-foreground-muted">
              <FileIcon mimeType={material.file_mime_type} />
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-foreground group-hover:text-accent transition-colors line-clamp-1">
          {material.title}
        </h3>

        {/* Description */}
        {material.description && (
          <p className="text-sm text-foreground-muted line-clamp-2">{material.description}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          {material.category && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">
              {material.category}
            </span>
          )}
          <span>Updated {new Date(material.updated_at).toLocaleDateString()}</span>
        </div>
      </Link>

      {/* Share button */}
      {material.shareable && material.share_token && onShare && (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onShare(material)
          }}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-muted border border-border text-foreground-muted hover:text-accent hover:border-accent/30 transition-colors"
          title="Share with prospect"
          data-testid="share-button"
        >
          <ShareIcon />
        </button>
      )}
    </div>
  )
}

function FileIcon({ mimeType }: { mimeType: string | null }) {
  const label = mimeType?.includes('pdf') ? 'PDF'
    : mimeType?.includes('presentation') ? 'PPTX'
    : mimeType?.includes('word') ? 'DOCX'
    : mimeType?.includes('sheet') ? 'XLSX'
    : mimeType?.includes('image') ? 'IMG'
    : 'FILE'

  return (
    <span className={cn(
      'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
      'bg-muted text-foreground-muted'
    )}>
      {label}
    </span>
  )
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}
