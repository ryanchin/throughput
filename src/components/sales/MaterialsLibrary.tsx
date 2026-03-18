'use client'

import { useState } from 'react'
import MaterialCard from './MaterialCard'
import { MaterialFilters } from './MaterialFilters'
import { ShareDialog } from './ShareDialog'

interface Material {
  id: string
  title: string
  slug: string
  description: string | null
  material_type: string
  category: string | null
  tags: string[]
  file_name: string | null
  file_mime_type: string | null
  shareable: boolean
  share_token: string | null
  updated_at: string
}

interface MaterialsLibraryProps {
  materials: Material[]
  categories: { id: string; name: string; slug: string }[]
}

export function MaterialsLibrary({ materials, categories }: MaterialsLibraryProps) {
  const [shareTarget, setShareTarget] = useState<Material | null>(null)

  return (
    <div className="space-y-6" data-testid="materials-library">
      {/* Filters toolbar */}
      <MaterialFilters categories={categories} />

      {/* Materials grid */}
      {materials.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {materials.map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
              onShare={() => setShareTarget(material)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface py-20">
          <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--foreground-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="materials-empty">
            No materials found
          </h2>
          <p className="text-sm text-foreground-muted">
            Try adjusting your filters or check back soon for new content.
          </p>
        </div>
      )}

      {/* Share dialog */}
      <ShareDialog
        open={!!shareTarget}
        onOpenChange={(open) => !open && setShareTarget(null)}
        material={shareTarget}
      />
    </div>
  )
}
