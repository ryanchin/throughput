import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { MATERIAL_TYPE_LABELS, type MaterialType } from '@/lib/sales/validation'
import { MaterialViewer } from '@/components/sales/MaterialViewer'

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ shareToken: string }>
}) {
  const { shareToken } = await params

  if (!shareToken || shareToken.length < 8) {
    notFound()
  }

  const serviceClient = createServiceClient()

  const { data: material, error } = await serviceClient
    .from('sales_materials')
    .select('id, title, slug, description, material_type, category, content, file_name, file_mime_type, file_size_bytes, file_path, updated_at')
    .eq('share_token', shareToken)
    .eq('shareable', true)
    .eq('status', 'published')
    .single()

  if (error || !material) {
    notFound()
  }

  let downloadUrl: string | null = null
  if (material.file_path) {
    const { data: signedUrl } = await serviceClient.storage
      .from('sales-materials')
      .createSignedUrl(material.file_path, 3600)
    downloadUrl = signedUrl?.signedUrl ?? null
  }

  const typeLabel = MATERIAL_TYPE_LABELS[material.material_type as MaterialType] ?? material.material_type

  return (
    <div data-testid="public-share-page">
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
      </div>

      {/* Content */}
      <MaterialViewer
        content={material.content}
        fileName={material.file_name}
        fileMimeType={material.file_mime_type}
        fileSizeBytes={material.file_size_bytes}
        downloadUrl={downloadUrl}
      />
    </div>
  )
}
