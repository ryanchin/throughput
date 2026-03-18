import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/sales/validation'

/**
 * POST /api/admin/sales-materials/[id]/upload
 * Upload a file attachment for a material.
 * Uses the service role client to write to private storage bucket.
 * Admin only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { id } = await params

  // Verify material exists
  const { data: material } = await supabase
    .from('sales_materials')
    .select('id')
    .eq('id', id)
    .single()

  if (!material) {
    return NextResponse.json({ error: 'Material not found' }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 50MB limit' }, { status: 400 })
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
    return NextResponse.json({ error: `File type '${file.type}' not allowed` }, { status: 400 })
  }

  const filePath = `${id}/${file.name}`
  const buffer = Buffer.from(await file.arrayBuffer())

  // Use service client for storage writes (private bucket)
  const serviceClient = createServiceClient()
  const { error: uploadError } = await serviceClient.storage
    .from('sales-materials')
    .upload(filePath, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  // Update material row with file metadata
  const { error: updateError } = await serviceClient
    .from('sales_materials')
    .update({
      file_path: filePath,
      file_name: file.name,
      file_size_bytes: file.size,
      file_mime_type: file.type,
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: 'File uploaded but metadata update failed' }, { status: 500 })
  }

  return NextResponse.json({ file_path: filePath, file_name: file.name })
}
