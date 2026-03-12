import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'

const UpdateLessonSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must be lowercase alphanumeric with hyphens'
  ).optional(),
  content: z.unknown().optional(),
  status: z.enum(['draft', 'published']).optional(),
  order_index: z.number().int().min(0).optional(),
  video_ids: z.array(z.string()).optional(),
  duration_minutes: z.number().int().min(0).nullable().optional(),
}).strict()

type RouteParams = { params: Promise<{ courseId: string; lessonId: string }> }

/**
 * GET /api/admin/courses/[courseId]/lessons/[lessonId]
 * Fetches a single lesson with all fields including content.
 * Admin-only.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { courseId, lessonId } = await params

  const { data: lesson, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .single()

  if (error || !lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  return NextResponse.json({ lesson })
}

/**
 * PATCH /api/admin/courses/[courseId]/lessons/[lessonId]
 * Updates lesson fields. Supports partial updates for auto-save.
 * Admin-only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { courseId, lessonId } = await params

  // Parse and validate body
  let body: z.infer<typeof UpdateLessonSchema>
  try {
    const raw = await request.json()
    body = UpdateLessonSchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Ensure at least one field is being updated
  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Verify the lesson exists and belongs to the course
  const { data: existing, error: fetchError } = await supabase
    .from('lessons')
    .select('id, slug')
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  // If slug is changing, check for duplicates within this course
  if (body.slug && body.slug !== existing.slug) {
    const { data: duplicate } = await supabase
      .from('lessons')
      .select('id')
      .eq('course_id', courseId)
      .eq('slug', body.slug)
      .neq('id', lessonId)
      .maybeSingle()

    if (duplicate) {
      return NextResponse.json(
        { error: 'A lesson with this slug already exists in this course' },
        { status: 409 }
      )
    }
  }

  // Build the update payload
  const updatePayload: Record<string, unknown> = {
    ...body,
    updated_at: new Date().toISOString(),
  }

  const { data: lesson, error: updateError } = await supabase
    .from('lessons')
    .update(updatePayload)
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update lesson', details: updateError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ lesson })
}

/**
 * DELETE /api/admin/courses/[courseId]/lessons/[lessonId]
 * Deletes a lesson from the course.
 * Admin-only.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { courseId, lessonId } = await params

  // Verify the lesson exists and belongs to the course
  const { data: existing, error: fetchError } = await supabase
    .from('lessons')
    .select('id, order_index')
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  // Delete the lesson
  const { error: deleteError } = await supabase
    .from('lessons')
    .delete()
    .eq('id', lessonId)
    .eq('course_id', courseId)

  if (deleteError) {
    return NextResponse.json(
      { error: 'Failed to delete lesson', details: deleteError.message },
      { status: 500 }
    )
  }

  // Re-index remaining lessons to close the gap
  const { data: remaining } = await supabase
    .from('lessons')
    .select('id')
    .eq('course_id', courseId)
    .order('order_index', { ascending: true })

  if (remaining) {
    for (let i = 0; i < remaining.length; i++) {
      await supabase
        .from('lessons')
        .update({ order_index: i })
        .eq('id', remaining[i].id)
    }
  }

  return NextResponse.json({ success: true })
}
