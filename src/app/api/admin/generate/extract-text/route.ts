import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { extractFileText } from '@/lib/generate/extract-file-text'

/** Maximum file size: 50 MB */
const MAX_FILE_SIZE = 50 * 1024 * 1024

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

/**
 * POST /api/admin/generate/extract-text
 *
 * Accepts a PDF or DOCX file via multipart form-data, extracts the
 * plain text content, and returns it with a word count.
 * Admin auth required.
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const fileEntry = formData.get('file')
  // FormData entries can be strings or file-like objects (File/Blob).
  // Use duck-typing for the check since different runtimes (Node, Edge, jsdom)
  // may return different Blob/File subtypes.
  const isFileLike =
    fileEntry !== null &&
    typeof fileEntry === 'object' &&
    'arrayBuffer' in fileEntry &&
    'type' in fileEntry &&
    'size' in fileEntry

  if (!isFileLike) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Safe to treat as a Blob-compatible object
  const file = fileEntry as Blob & { name?: string }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
      { status: 400 }
    )
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Only PDF and DOCX are accepted.' },
      { status: 400 }
    )
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const { text, wordCount } = await extractFileText(buffer, file.type)

    return NextResponse.json({ text, wordCount })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to extract text: ${message}` },
      { status: 500 }
    )
  }
}
