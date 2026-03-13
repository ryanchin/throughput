import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getProfile } from '@/lib/auth/getProfile'
import { createClient } from '@/lib/supabase/server'

/**
 * Admin user detail page — shows per-course enrollment/completion data.
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

  const statusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-[var(--success)] bg-[var(--success-muted)]'
      case 'failed': return 'text-[var(--warning)] bg-[var(--warning-muted)]'
      default: return 'text-foreground-muted bg-muted'
    }
  }

  return (
    <div className="p-8">
      <Link href="/admin/users" className="text-accent hover:text-accent-hover text-sm mb-4 inline-block">
        &larr; Back to Users
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          {userProfile.full_name || 'Unnamed User'}
        </h1>
        <p className="text-foreground-muted">{userProfile.email}</p>
        <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground-muted border border-border">
          {userProfile.role}
        </span>
      </div>

      <h2 className="text-xl font-semibold text-foreground mb-4">Course Enrollments</h2>

      {courseDetails.length === 0 ? (
        <p className="text-foreground-muted">No course enrollments.</p>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-foreground-muted text-sm">
                <th className="text-left px-4 py-3">Course</th>
                <th className="text-left px-4 py-3">Zone</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Score</th>
                <th className="text-right px-4 py-3">Progress</th>
                <th className="text-right px-4 py-3">Enrolled</th>
                <th className="text-right px-4 py-3">Completed</th>
              </tr>
            </thead>
            <tbody>
              {courseDetails.map((c, idx) => (
                <tr key={idx} className="border-b border-border-subtle last:border-b-0">
                  <td className="px-4 py-3 text-foreground text-sm font-medium">
                    {c.courseTitle}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-foreground-muted">{c.zone}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(c.status)}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 text-sm">
                    {c.finalScore !== null ? (
                      <span className={c.finalScore >= c.passingScore ? 'text-[var(--success)]' : 'text-[var(--warning)]'}>
                        {c.finalScore}%
                      </span>
                    ) : (
                      <span className="text-foreground-subtle">-</span>
                    )}
                  </td>
                  <td className="text-right px-4 py-3 text-foreground-muted text-sm">
                    {c.lessonsCompleted}/{c.lessonsTotal}
                  </td>
                  <td className="text-right px-4 py-3 text-foreground-muted text-sm">
                    {new Date(c.enrolledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="text-right px-4 py-3 text-foreground-muted text-sm">
                    {c.completedAt
                      ? new Date(c.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
