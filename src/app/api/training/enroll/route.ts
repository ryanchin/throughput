import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const enrollBodySchema = z.object({
  courseId: z.string().uuid('courseId must be a valid UUID'),
})

/**
 * POST /api/training/enroll
 *
 * Enrolls the authenticated user in a published course.
 *
 * Validates:
 * - User is authenticated with employee/sales/admin role
 * - Course exists and is published
 * - User's role has access to the course zone (employee cannot enroll in sales courses)
 *
 * If the user is already enrolled (unique constraint), returns the existing
 * enrollment with status 200 instead of erroring.
 *
 * @returns {{ enrollment }} with status 201 (new) or 200 (existing)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // --- Auth ---
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || !['employee', 'sales', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // --- Input validation ---
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = enrollBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { courseId } = parsed.data

  // --- Course existence + status check ---
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, zone, status')
    .eq('id', courseId)
    .eq('status', 'published')
    .single()

  if (courseError || !course) {
    return NextResponse.json({ error: 'Course not found or not published' }, { status: 404 })
  }

  // --- Zone access check ---
  if (profile.role === 'employee' && course.zone === 'sales') {
    return NextResponse.json(
      { error: 'You do not have access to this course' },
      { status: 403 }
    )
  }

  // --- Insert enrollment ---
  const { data: enrollment, error: insertError } = await supabase
    .from('course_enrollments')
    .insert({ user_id: user.id, course_id: courseId })
    .select()
    .single()

  if (insertError) {
    // Unique constraint violation — user already enrolled
    if (insertError.code === '23505') {
      const { data: existing, error: fetchError } = await supabase
        .from('course_enrollments')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .single()

      if (fetchError || !existing) {
        return NextResponse.json({ error: 'Failed to fetch existing enrollment' }, { status: 500 })
      }

      return NextResponse.json({ enrollment: existing }, { status: 200 })
    }

    return NextResponse.json({ error: 'Failed to enroll' }, { status: 500 })
  }

  return NextResponse.json({ enrollment }, { status: 201 })
}
