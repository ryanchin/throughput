import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/training/courses
 *
 * Lists published training courses for authenticated users, enriched with
 * lesson counts, total duration, enrollment status, and completion progress.
 *
 * Belt-and-suspenders: filters status='published' in query AND RLS.
 *
 * Zone filtering:
 * - employee: sees only 'training' zone courses
 * - sales: sees 'training' + 'sales' zone courses
 * - admin: sees all zones
 */
export async function GET() {
  const supabase = await createClient()

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

  // Belt-and-suspenders: explicit status filter + RLS
  let query = supabase
    .from('courses')
    .select('id, title, slug, description, zone, status, cover_image_url, learning_objectives, passing_score, created_at')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  // Non-admin users only see their zone
  if (profile.role === 'employee') {
    query = query.eq('zone', 'training')
  }

  const { data: courses, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 })
  }

  if (!courses || courses.length === 0) {
    return NextResponse.json({ courses: [] })
  }

  const courseIds = courses.map((c) => c.id)

  // Batch queries: lessons, enrollments, and lesson progress — run in parallel
  const [lessonsResult, enrollmentsResult, progressResult] = await Promise.all([
    supabase
      .from('lessons')
      .select('id, course_id, duration_minutes')
      .in('course_id', courseIds)
      .eq('status', 'published'),
    supabase
      .from('course_enrollments')
      .select('*')
      .eq('user_id', user.id)
      .in('course_id', courseIds),
    supabase
      .from('lesson_progress')
      .select('lesson_id, completed_at')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null),
  ])

  if (lessonsResult.error || enrollmentsResult.error || progressResult.error) {
    return NextResponse.json({ error: 'Failed to fetch course details' }, { status: 500 })
  }

  const lessons = lessonsResult.data ?? []
  const enrollments = enrollmentsResult.data ?? []
  const completedProgress = progressResult.data ?? []

  // Build lookup maps
  const lessonsByCoursId = new Map<string, typeof lessons>()
  for (const lesson of lessons) {
    const existing = lessonsByCoursId.get(lesson.course_id) ?? []
    existing.push(lesson)
    lessonsByCoursId.set(lesson.course_id, existing)
  }

  const enrollmentByCourseId = new Map<string, (typeof enrollments)[number]>()
  for (const enrollment of enrollments) {
    enrollmentByCourseId.set(enrollment.course_id, enrollment)
  }

  const completedLessonIds = new Set(completedProgress.map((p) => p.lesson_id))

  // Enrich courses
  const enrichedCourses = courses.map((course) => {
    const courseLessons = lessonsByCoursId.get(course.id) ?? []
    const lessonCount = courseLessons.length
    const totalDurationMinutes = courseLessons.reduce(
      (sum, l) => sum + (l.duration_minutes ?? 15),
      0
    )
    const completedLessonCount = courseLessons.filter((l) =>
      completedLessonIds.has(l.id)
    ).length
    const enrollment = enrollmentByCourseId.get(course.id) ?? null

    return {
      ...course,
      lesson_count: lessonCount,
      total_duration_minutes: totalDurationMinutes,
      completed_lesson_count: completedLessonCount,
      enrollment,
    }
  })

  return NextResponse.json({ courses: enrichedCourses })
}
