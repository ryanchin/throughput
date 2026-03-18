'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const LessonViewer = dynamic(
  () => import('@/components/editor/LessonViewer'),
  { loading: () => <div className="h-40 bg-muted rounded-lg animate-pulse" /> }
)

interface MaterialViewerProps {
  content: unknown
  fileName: string | null
  fileMimeType: string | null
  fileSizeBytes: number | null
  downloadUrl: string | null
}

export function MaterialViewer({
  content,
  fileName,
  fileMimeType,
  fileSizeBytes,
  downloadUrl,
}: MaterialViewerProps) {
  return (
    <div className="space-y-8">
      {/* Rich text content */}
      {content != null && (
        <div className="prose prose-invert max-w-none">
          <LessonViewer content={content as Record<string, unknown>} />
        </div>
      )}

      {/* File attachment */}
      {downloadUrl && fileName && (
        <FileCard
          fileName={fileName}
          mimeType={fileMimeType}
          fileSize={fileSizeBytes}
          downloadUrl={downloadUrl}
        />
      )}

      {/* Show empty state if neither content nor file */}
      {!content && !downloadUrl && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <p className="text-foreground-muted">This material has no content yet.</p>
        </div>
      )}
    </div>
  )
}

function FileCard({
  fileName,
  mimeType,
  fileSize,
  downloadUrl,
}: {
  fileName: string
  mimeType: string | null
  fileSize: number | null
  downloadUrl: string
}) {
  const isPdf = mimeType === 'application/pdf'
  const [showPreview, setShowPreview] = useState(isPdf)

  const fileSizeLabel = fileSize
    ? fileSize > 1_048_576
      ? `${(fileSize / 1_048_576).toFixed(1)} MB`
      : `${Math.round(fileSize / 1024)} KB`
    : null

  const fileTypeLabel = mimeType?.includes('pdf') ? 'PDF'
    : mimeType?.includes('presentation') ? 'PowerPoint'
    : mimeType?.includes('word') ? 'Word Document'
    : mimeType?.includes('sheet') ? 'Spreadsheet'
    : mimeType?.includes('image') ? 'Image'
    : 'File'

  return (
    <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden" data-testid="file-card">
      {/* PDF inline preview */}
      {showPreview && isPdf && (
        <div className="bg-background">
          <iframe
            src={downloadUrl}
            title={fileName}
            className="w-full h-[600px] border-b border-border"
          />
        </div>
      )}

      {/* File info bar */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
            <FileTypeIcon mimeType={mimeType} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{fileName}</p>
            <p className="text-xs text-foreground-muted">
              {fileTypeLabel}{fileSizeLabel ? ` · ${fileSizeLabel}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPdf && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-raised transition-colors"
            >
              {showPreview ? 'Hide Preview' : 'Preview'}
            </button>
          )}
          <a
            href={downloadUrl}
            download={fileName}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-hover transition-colors"
            data-testid="download-button"
          >
            Download
          </a>
        </div>
      </div>
    </div>
  )
}

function FileTypeIcon({ mimeType }: { mimeType: string | null }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--foreground-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      {mimeType?.includes('pdf') && <line x1="16" y1="13" x2="8" y2="13" />}
      {mimeType?.includes('pdf') && <line x1="16" y1="17" x2="8" y2="17" />}
    </svg>
  )
}
