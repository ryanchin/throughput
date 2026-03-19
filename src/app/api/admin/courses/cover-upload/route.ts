import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

/**
 * POST /api/admin/courses/cover-upload
 * Uploads a course cover image to Supabase Storage.
 * Returns the public URL. Admin only.
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File exceeds 5 MB limit' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only PNG, JPG, WebP, and GIF images are allowed' }, { status: 400 })
  }

  // Generate a unique filename to avoid collisions
  const ext = file.name.split('.').pop() ?? 'jpg'
  const fileName = `${crypto.randomUUID()}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const serviceClient = createServiceClient()

  const { error: uploadError } = await serviceClient.storage
    .from('course-covers')
    .upload(fileName, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  // Get the public URL
  const { data: urlData } = serviceClient.storage
    .from('course-covers')
    .getPublicUrl(fileName)

  return NextResponse.json({ url: urlData.publicUrl })
}
