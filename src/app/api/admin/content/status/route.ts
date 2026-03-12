import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { validateCoursePublish, validateCertTrackPublish } from '@/lib/admin/content-validation'
import type { ContentType } from '@/lib/admin/content-validation'

const StatusUpdateSchema = z.object({
  contentType: z.enum(['course', 'lesson', 'certification_track', 'docs_page']),
  contentId: z.string().uuid(),
  status: z.enum(['draft', 'published']),
})

/** Map content types to their database table names */
const TABLE_MAP: Record<ContentType, string> = {
  course: 'courses',
  lesson: 'lessons',
  certification_track: 'certification_tracks',
  docs_page: 'docs_pages',
}

/**
 * PATCH /api/admin/content/status
 * Toggle content status between draft and published.
 * Admin-only. Validates publishing prerequisites.
 */
export async function PATCH(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // Parse and validate body
  let body: z.infer<typeof StatusUpdateSchema>
  try {
    const raw = await request.json()
    body = StatusUpdateSchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { contentType, contentId, status } = body
  const table = TABLE_MAP[contentType]

  // Publishing validation
  if (status === 'published') {
    if (contentType === 'course') {
      // Fetch lessons for this course
      const { data: lessons, error: lessonsError } = await supabase
        .from('lessons')
        .select('id, title, status')
        .eq('course_id', contentId)

      if (lessonsError) {
        return NextResponse.json({ error: 'Failed to fetch lessons' }, { status: 500 })
      }

      const validation = validateCoursePublish(lessons || [])
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error, details: validation.details },
          { status: 422 }
        )
      }
    }

    if (contentType === 'certification_track') {
      // Fetch track config and question count
      const { data: track, error: trackError } = await supabase
        .from('certification_tracks')
        .select('*')
        .eq('id', contentId)
        .single()

      if (trackError || !track) {
        return NextResponse.json({ error: 'Certification track not found' }, { status: 404 })
      }

      const { count, error: countError } = await supabase
        .from('cert_questions')
        .select('id', { count: 'exact', head: true })
        .eq('track_id', contentId)

      if (countError) {
        return NextResponse.json({ error: 'Failed to count questions' }, { status: 500 })
      }

      const validation = validateCertTrackPublish(count || 0, track.questions_per_exam)
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error, details: validation.details },
          { status: 422 }
        )
      }
    }
  }

  // Update the status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from(table)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', contentId)

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update status', details: updateError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, contentType, contentId, status })
}
