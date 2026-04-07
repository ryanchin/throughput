import { notFound, redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/getProfile'
import { createClient } from '@/lib/supabase/server'
import { UserDetailClient } from '@/components/admin/UserDetailClient'

/**
 * Admin user detail page — shows profile info + per-course enrollment data.
 * Edit and delete actions handled client-side.
 */
export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/login')

  const supabase = await createClient()

  // Fetch user profile
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .single()

  if (!userProfile) notFound()

  // Fetch enrollments
  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select('id, course_id, status, final_score, enrolled_at, completed_at')
    .eq('user_id', userId)
    .order('enrolled_at', { ascending: false })

  // Fetch course details
  const courseIds = (enrollments ?? []).map((e) => e.course_id)
  const { data: courses } = courseIds.length > 0
    ? await supabase.from('courses').select('id, title, slug, zone, passing_score').in('id', courseIds)
    : { data: [] }

  const courseMap = new Map((courses ?? []).map((c) => [c.id, c]))

  // Fetch lesson progress
  const { data: allLessons } = courseIds.length > 0
    ? await supabase.from('lessons').select('id, course_id').in('course_id', courseIds).eq('status', 'published')
    : { data: [] }

  const { data: lessonProgress } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)

  const completedLessonIds = new Set((lessonProgress ?? []).map((p) => p.lesson_id))

  const lessonsByCourse = new Map<string, string[]>()
  for (const l of allLessons ?? []) {
    const existing = lessonsByCourse.get(l.course_id) ?? []
    existing.push(l.id)
    lessonsByCourse.set(l.course_id, existing)
  }

  const courseDetails = (enrollments ?? []).map((e) => {
    const course = courseMap.get(e.course_id)
    const courseLessonIds = lessonsByCourse.get(e.course_id) ?? []
    const completedCount = courseLessonIds.filter((id) => completedLessonIds.has(id)).length
    return {
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

  const isCurrentUser = profile.id === userId

  return (
    <UserDetailClient
      userProfile={{
        id: userProfile.id,
        email: userProfile.email,
        full_name: userProfile.full_name,
        role: userProfile.role,
      }}
      courseDetails={courseDetails}
      isCurrentUser={isCurrentUser}
    />
  )
}
