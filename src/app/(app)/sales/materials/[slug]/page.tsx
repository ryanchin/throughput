import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getMaterialBySlug } from '@/lib/sales/materials'
import { MATERIAL_TYPE_LABELS, type MaterialType } from '@/lib/sales/validation'
import { MaterialViewer } from '@/components/sales/MaterialViewer'
import { ShareButton } from './ShareButton'

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const material = await getMaterialBySlug(slug)

  if (material === null) {
    // Could be unauthorized or not found — getMaterialBySlug returns null for both
    notFound()
  }

  const typeLabel = MATERIAL_TYPE_LABELS[material.material_type as MaterialType] ?? material.material_type

  return (
    <div className="max-w-4xl" data-testid="material-detail">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-foreground-muted">
        <Link href="/sales?tab=materials" className="hover:text-accent transition-colors">
          ← Back to Materials
        </Link>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="inline-flex items-center rounded-full bg-secondary-muted px-2.5 py-0.5 text-xs font-medium text-secondary">
            {typeLabel}
          </span>
          {material.category && (
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground-muted">
              {material.category}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold text-foreground">{material.title}</h1>
        {material.description && (
          <p className="mt-2 text-lg text-foreground-muted">{material.description}</p>
        )}
        <div className="mt-4 flex items-center gap-4">
          <span className="text-sm text-foreground-muted">
            Updated {new Date(material.updated_at).toLocaleDateString()}
          </span>
          {material.shareable && material.share_token && (
            <ShareButton title={material.title} shareToken={material.share_token} />
          )}
        </div>
      </div>

      {/* Content */}
      <MaterialViewer
        content={material.content}
        fileName={material.file_name}
        fileMimeType={material.file_mime_type}
        fileSizeBytes={material.file_size_bytes}
        downloadUrl={material.download_url ?? null}
      />
    </div>
  )
}
