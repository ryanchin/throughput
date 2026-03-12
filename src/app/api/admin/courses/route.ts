import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'

/**
 * GET /api/admin/courses
 * Lists ALL courses (draft + published) for admin users.
 * Includes lesson_count and enrollment_count aggregates.
 */
export async function GET() {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // Fetch courses with related counts via separate queries
  const { data: courses, error } = await supabase
    .from('courses')
    .select('id, title, slug, description, zone, status, cover_image_url, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 })
  }

  // Fetch lesson counts per course
  const courseIds = courses.map((c) => c.id)

  const { data: lessonCounts } = await supabase
    .from('lessons')
    .select('course_id')
    .in('course_id', courseIds)

  const { data: enrollmentCounts } = await supabase
    .from('course_enrollments')
    .select('course_id')
    .in('course_id', courseIds)

  // Build count maps
  const lessonCountMap: Record<string, number> = {}
  for (const row of lessonCounts ?? []) {
    lessonCountMap[row.course_id] = (lessonCountMap[row.course_id] ?? 0) + 1
  }

  const enrollmentCountMap: Record<string, number> = {}
  for (const row of enrollmentCounts ?? []) {
    enrollmentCountMap[row.course_id] = (enrollmentCountMap[row.course_id] ?? 0) + 1
  }

  // Merge counts into course objects
  const enrichedCourses = courses.map((course) => ({
    ...course,
    lesson_count: lessonCountMap[course.id] ?? 0,
    enrollment_count: enrollmentCountMap[course.id] ?? 0,
  }))

  return NextResponse.json({ courses: enrichedCourses })
}

const createCourseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  slug: z.string().min(1, 'Slug is required').max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(2000).nullable().optional(),
  zone: z.enum(['training', 'sales']).optional().default('training'),
  passing_score: z.number().int().min(0).max(100).optional().default(70),
  cover_image_url: z.string().url().nullable().optional(),
})

/**
 * POST /api/admin/courses
 * Creates a new course in draft status.
 * Validates input with Zod and checks slug uniqueness.
 */
export async function POST(request: NextRequest) {
  const { error: authError, supabase, profile } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createCourseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { title, slug, description, zone, passing_score, cover_image_url } = parsed.data

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from('courses')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'A course with this slug already exists' }, { status: 409 })
  }

  const { data: course, error } = await supabase
    .from('courses')
    .insert({
      title,
      slug,
      description: description ?? null,
      zone,
      passing_score,
      cover_image_url: cover_image_url ?? null,
      created_by: profile!.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create course' }, { status: 500 })
  }

  return NextResponse.json({ course }, { status: 201 })
}
