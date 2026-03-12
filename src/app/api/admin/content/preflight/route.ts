import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getUnpublishedLessons } from '@/lib/admin/content-validation'

const PreflightSchema = z.object({
  contentType: z.enum(['course', 'certification_track']),
  contentId: z.string().uuid(),
})

/**
 * GET /api/admin/content/preflight?contentType=course&contentId=xxx
 * Returns preflight check data before publishing.
 */
export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams
  let params: z.infer<typeof PreflightSchema>
  try {
    params = PreflightSchema.parse({
      contentType: searchParams.get('contentType'),
      contentId: searchParams.get('contentId'),
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid parameters', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }

  if (params.contentType === 'course') {
    const { data: lessons, error } = await supabase
      .from('lessons')
      .select('id, title, status')
      .eq('course_id', params.contentId)
      .order('order_index')

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch lessons' }, { status: 500 })
    }

    const unpublished = getUnpublishedLessons(lessons || [])
    const publishedCount = (lessons || []).length - unpublished.length

    return NextResponse.json({
      contentType: 'course',
      totalLessons: (lessons || []).length,
      publishedLessons: publishedCount,
      unpublishedLessons: unpublished,
      canPublish: publishedCount > 0,
    })
  }

  if (params.contentType === 'certification_track') {
    const { data: track } = await supabase
      .from('certification_tracks')
      .select('*')
      .eq('id', params.contentId)
      .single()

    const { count } = await supabase
      .from('cert_questions')
      .select('id', { count: 'exact', head: true })
      .eq('track_id', params.contentId)

    return NextResponse.json({
      contentType: 'certification_track',
      questionCount: count || 0,
      questionsRequired: track?.questions_per_exam || 30,
      canPublish: (count || 0) >= (track?.questions_per_exam || 30),
    })
  }

  return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 })
}
