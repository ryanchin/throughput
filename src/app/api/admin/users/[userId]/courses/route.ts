import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'

/**
 * GET /api/admin/users/[userId]/courses
 *
 * Returns per-course enrollment details for a specific user.
 * Used in the admin user detail view when clicking a user row.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // Verify user exists
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Fetch enrollments with course info
  const { data: enrollments, error: enrollError } = await supabase
    .from('course_enrollments')
    .select('id, course_id, status, final_score, enrolled_at, completed_at')
    .eq('user_id', userId)
    .order('enrolled_at', { ascending: false })

  if (enrollError) {
    return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 })
  }

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({
      user: {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role,
      },
      courses: [],
    })
  }

  // Fetch course details
  const courseIds = enrollments.map((e) => e.course_id)
  const { data: courses } = await supabase
    .from('courses')
    .select('id, title, slug, zone, passing_score')
    .in('id', courseIds)

  const courseMap = new Map((courses ?? []).map((c) => [c.id, c]))

  // Fetch lesson progress for this user across all enrolled courses
  const { data: lessonProgress } = await supabase
    .from('lesson_progress')
    .select('lesson_id, completed_at')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)

  const completedLessonIds = new Set((lessonProgress ?? []).map((p) => p.lesson_id))

  // Fetch lesson counts per course
  const { data: allLessons } = await supabase
    .from('lessons')
    .select('id, course_id')
    .in('course_id', courseIds)
    .eq('status', 'published')

  // Build lesson count + completed count per course
  const lessonsByCourse = new Map<string, string[]>()
  for (const l of allLessons ?? []) {
    const existing = lessonsByCourse.get(l.course_id) ?? []
    existing.push(l.id)
    lessonsByCourse.set(l.course_id, existing)
  }

  const courseDetails = enrollments.map((e) => {
    const course = courseMap.get(e.course_id)
    const courseLessonIds = lessonsByCourse.get(e.course_id) ?? []
    const completedCount = courseLessonIds.filter((id) => completedLessonIds.has(id)).length

    return {
      courseId: e.course_id,
      courseTitle: course?.title ?? 'Unknown',
      courseSlug: course?.slug ?? '',
      zone: course?.zone ?? 'training',
      passingScore: course?.passing_score ?? 70,
      status: e.status,
      finalScore: e.final_score,
      enrolledAt: e.enrolled_at,
      completedAt: e.completed_at,
      lessonsCompleted: completedCount,
      lessonsTotal: courseLessonIds.length,
    }
  })

  return NextResponse.json({
    user: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
    },
    courses: courseDetails,
  })
}
