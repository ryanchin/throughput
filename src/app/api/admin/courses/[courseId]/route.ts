import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'

/**
 * GET /api/admin/courses/[courseId]
 * Fetches a single course with all fields for admin editing.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const { data: course, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 })
  }

  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  return NextResponse.json({ course })
}

const updateCourseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  description: z.string().max(2000).nullable().optional(),
  zone: z.enum(['training', 'sales']).optional(),
  status: z.enum(['draft', 'published']).optional(),
  passing_score: z.number().int().min(0).max(100).optional(),
  navigation_mode: z.enum(['sequential', 'free']).optional(),
  cover_image_url: z.string().url().nullable().optional(),
})

/**
 * PATCH /api/admin/courses/[courseId]
 * Updates an existing course. Validates input with Zod.
 * If slug is changed, checks uniqueness (excluding current course).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = updateCourseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const updates = parsed.data

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Verify course exists
  const { data: existingCourse } = await supabase
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .maybeSingle()

  if (!existingCourse) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  // If slug is being updated, check uniqueness (excluding this course)
  if (updates.slug) {
    const { data: slugConflict } = await supabase
      .from('courses')
      .select('id')
      .eq('slug', updates.slug)
      .neq('id', courseId)
      .maybeSingle()

    if (slugConflict) {
      return NextResponse.json({ error: 'A course with this slug already exists' }, { status: 409 })
    }
  }

  const { data: course, error } = await supabase
    .from('courses')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', courseId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update course' }, { status: 500 })
  }

  return NextResponse.json({ course })
}

/**
 * DELETE /api/admin/courses/[courseId]
 * Deletes a course and its associated lessons (via cascade).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // Verify course exists
  const { data: existingCourse } = await supabase
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .maybeSingle()

  if (!existingCourse) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', courseId)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete course' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
