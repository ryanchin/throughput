import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'

const ReorderSchema = z.object({
  lessonIds: z.array(z.string().uuid()).min(1, 'At least one lesson ID is required'),
})

/**
 * PATCH /api/admin/courses/[courseId]/lessons/reorder
 * Reorders lessons within a course by updating order_index values.
 * The lessonIds array represents the desired order (index 0 = first).
 * Admin-only.
 */
export async function PATCH(
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
  let body: z.infer<typeof ReorderSchema>
  try {
    const raw = await request.json()
    body = ReorderSchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Verify all lesson IDs belong to this course
  const { data: lessons, error: fetchError } = await supabase
    .from('lessons')
    .select('id')
    .eq('course_id', courseId)

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to fetch lessons' }, { status: 500 })
  }

  const existingIds = new Set((lessons || []).map((l) => l.id))
  const invalidIds = body.lessonIds.filter((id) => !existingIds.has(id))

  if (invalidIds.length > 0) {
    return NextResponse.json(
      { error: 'Some lesson IDs do not belong to this course', invalidIds },
      { status: 400 }
    )
  }

  // Check that all course lessons are accounted for
  if (body.lessonIds.length !== existingIds.size) {
    return NextResponse.json(
      {
        error: `Expected ${existingIds.size} lesson IDs but received ${body.lessonIds.length}. All lessons must be included in the reorder.`,
      },
      { status: 400 }
    )
  }

  // Check for duplicates
  const uniqueIds = new Set(body.lessonIds)
  if (uniqueIds.size !== body.lessonIds.length) {
    return NextResponse.json(
      { error: 'Duplicate lesson IDs are not allowed' },
      { status: 400 }
    )
  }

  // Update order_index for each lesson
  const updates = body.lessonIds.map((id, index) =>
    supabase
      .from('lessons')
      .update({ order_index: index, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('course_id', courseId)
  )

  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)

  if (failed?.error) {
    return NextResponse.json(
      { error: 'Failed to reorder lessons', details: failed.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, order: body.lessonIds })
}
