'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MATERIAL_TYPES, MATERIAL_TYPE_LABELS, type MaterialType, generateSlug } from '@/lib/sales/validation'

interface MaterialFormProps {
  material?: {
    id: string
    title: string
    slug: string
    description: string | null
    material_type: string
    category: string | null
    tags: string[]
    content: unknown
    shareable: boolean
    share_token: string | null
    status: string
    file_name: string | null
    file_mime_type: string | null
    file_size_bytes: number | null
    download_url?: string | null
  }
  categories: string[]
}

export function MaterialForm({ material, categories }: MaterialFormProps) {
  const router = useRouter()
  const isEditing = !!material

  const [title, setTitle] = useState(material?.title ?? '')
  const [slug, setSlug] = useState(material?.slug ?? '')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [description, setDescription] = useState(material?.description ?? '')
  const [materialType, setMaterialType] = useState(material?.material_type ?? 'other')
  const [category, setCategory] = useState(material?.category ?? '')
  const [tagsInput, setTagsInput] = useState(material?.tags?.join(', ') ?? '')
  const [shareable, setShareable] = useState(material?.shareable ?? false)
  const [status, setStatus] = useState(material?.status ?? 'draft')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // File upload state
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState(material?.file_name ?? '')

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManuallyEdited && !isEditing) {
      setSlug(generateSlug(title))
    }
  }, [title, slugManuallyEdited, isEditing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const body = {
      title,
      slug,
      description: description || null,
      material_type: materialType,
      category: category || null,
      tags,
      shareable,
      status,
    }

    try {
      const url = isEditing
        ? `/api/admin/sales-materials/${material.id}`
        : '/api/admin/sales-materials'
      const method = isEditing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        setSaving(false)
        return
      }

      const materialId = data.material?.id ?? material?.id

      // Upload file if selected
      if (file && materialId) {
        setUploading(true)
        const formData = new FormData()
        formData.append('file', file)

        const uploadRes = await fetch(`/api/admin/sales-materials/${materialId}/upload`, {
          method: 'POST',
          body: formData,
        })

        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json()
          setError(uploadData.error ?? 'File upload failed')
          setUploading(false)
          setSaving(false)
          return
        }
        setUploading(false)
      }

      router.push('/admin/sales-materials')
      router.refresh()
    } catch {
      setError('Network error')
      setSaving(false)
    }
  }

  const shareUrl = material?.share_token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/materials/${material.share_token}`
    : null

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6" data-testid="material-form">
      {error && (
        <div className="rounded-lg bg-destructive-muted border border-destructive/20 p-3 text-sm text-destructive" data-testid="form-error">
          {error}
        </div>
      )}

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Title</label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
          placeholder="e.g., Enterprise Battle Card"
          data-testid="title-input"
        />
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Slug</label>
        <input
          type="text"
          required
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value)
            setSlugManuallyEdited(true)
          }}
          className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
          data-testid="slug-input"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none resize-none"
          placeholder="Brief description for search and previews"
          data-testid="description-input"
        />
      </div>

      {/* Type + Category row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Type</label>
          <select
            value={materialType}
            onChange={(e) => setMaterialType(e.target.value)}
            className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent outline-none"
            data-testid="type-select"
          >
            {MATERIAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {MATERIAL_TYPE_LABELS[t as MaterialType]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list="category-suggestions"
            className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
            placeholder="e.g., Enterprise"
            data-testid="category-input"
          />
          <datalist id="category-suggestions">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Tags</label>
        <input
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent outline-none"
          placeholder="Comma-separated, e.g., enterprise, healthcare, q1-2026"
          data-testid="tags-input"
        />
      </div>

      {/* File upload */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">File Attachment</label>
        {uploadedFileName && !file && (
          <p className="text-sm text-foreground-muted">
            Current file: <span className="text-foreground">{uploadedFileName}</span>
          </p>
        )}
        <input
          type="file"
          accept=".pdf,.pptx,.docx,.xlsx,.png,.jpg,.jpeg"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full bg-background border border-border text-foreground text-sm rounded-lg px-3 py-2 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-muted file:text-foreground"
          data-testid="file-input"
        />
        <p className="text-xs text-foreground-muted">PDF, PPTX, DOCX, XLSX, PNG, JPG — max 50 MB</p>
      </div>

      {/* Shareable + Status row */}
      <div className="flex items-center gap-8">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={shareable}
            onChange={(e) => setShareable(e.target.checked)}
            className="rounded border-border text-accent focus:ring-accent"
            data-testid="shareable-toggle"
          />
          <span className="text-sm text-foreground">Publicly shareable</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={status === 'published'}
            onChange={(e) => setStatus(e.target.checked ? 'published' : 'draft')}
            className="rounded border-border text-accent focus:ring-accent"
            data-testid="status-toggle"
          />
          <span className="text-sm text-foreground">Published</span>
        </label>
      </div>

      {/* Share URL display */}
      {shareable && shareUrl && (
        <div className="rounded-lg bg-muted border border-border p-3">
          <p className="text-xs text-foreground-muted mb-1">Public share link:</p>
          <code className="text-sm text-accent break-all">{shareUrl}</code>
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving || uploading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow disabled:opacity-50"
          data-testid="save-button"
        >
          {saving ? (uploading ? 'Uploading...' : 'Saving...') : isEditing ? 'Save Changes' : 'Create Material'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/sales-materials')}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-raised transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
