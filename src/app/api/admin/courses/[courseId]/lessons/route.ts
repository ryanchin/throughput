import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import type { Json } from '@/lib/supabase/database.types'

const CreateLessonSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  slug: z.string().min(1, 'Slug is required').max(255).regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must be lowercase alphanumeric with hyphens'
  ),
  content: z.unknown().optional(),
  status: z.enum(['draft', 'published']).default('draft'),
})

/**
 * GET /api/admin/courses/[courseId]/lessons
 * Lists all lessons for a course, ordered by order_index.
 * Admin-only: returns both draft and published lessons.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { courseId } = await params

  // Verify the course exists
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .single()

  if (courseError || !course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const { data: lessons, error } = await supabase
    .from('lessons')
    .select('id, title, slug, status, order_index, duration_minutes, video_ids, created_at, updated_at')
    .eq('course_id', courseId)
    .order('order_index', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch lessons' }, { status: 500 })
  }

  return NextResponse.json({ lessons })
}

/**
 * POST /api/admin/courses/[courseId]/lessons
 * Creates a new lesson for the course.
 * Automatically assigns the next order_index.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { courseId } = await params

  // Verify the course exists
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .single()

  if (courseError || !course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  // Parse and validate body
  let body: z.infer<typeof CreateLessonSchema>
  try {
    const raw = await request.json()
    body = CreateLessonSchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Check for duplicate slug within this course
  const { data: existing } = await supabase
    .from('lessons')
    .select('id')
    .eq('course_id', courseId)
    .eq('slug', body.slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'A lesson with this slug already exists in this course' },
      { status: 409 }
    )
  }

  // Determine the next order_index
  const { data: lastLesson } = await supabase
    .from('lessons')
    .select('order_index')
    .eq('course_id', courseId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrderIndex = lastLesson ? lastLesson.order_index + 1 : 0

  // Create the lesson
  const { data: lesson, error: insertError } = await supabase
    .from('lessons')
    .insert({
      course_id: courseId,
      title: body.title,
      slug: body.slug,
      content: (body.content as Json) ?? null,
      status: body.status,
      order_index: nextOrderIndex,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json(
      { error: 'Failed to create lesson', details: insertError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ lesson }, { status: 201 })
}
