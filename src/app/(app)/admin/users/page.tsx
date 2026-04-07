import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth/getProfile'
import { createClient } from '@/lib/supabase/server'
import { AdminUsersClient } from '@/components/admin/AdminUsersClient'

/**
 * Admin user management page.
 * Shows all users with enrollment/completion stats + create/edit/delete.
 */
export default async function AdminUsersPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/login')

  const supabase = await createClient()

  // Fetch all profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, updated_at')
    .order('updated_at', { ascending: false })

  if (!profiles || profiles.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-foreground mb-6">User Management</h1>
        <p className="text-foreground-muted">No users found.</p>
      </div>
    )
  }

  const userIds = profiles.map((p) => p.id)

  // Fetch all enrollments
  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select('user_id, status, final_score, enrolled_at, completed_at')
    .in('user_id', userIds)

  // Build aggregates per user
  const userEnrollments = new Map<string, typeof enrollments>()
  for (const e of enrollments ?? []) {
    const existing = userEnrollments.get(e.user_id) ?? []
    existing.push(e)
    userEnrollments.set(e.user_id, existing)
  }

  const users = profiles.map((p) => {
    const userE = userEnrollments.get(p.id) ?? []
    const coursesEnrolled = userE.length
    const coursesPassed = userE.filter((e) => e.status === 'passed').length
    const scores = userE.filter((e) => e.final_score !== null).map((e) => e.final_score as number)
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
      : null

    const dates = userE.flatMap((e) => [e.enrolled_at, e.completed_at].filter(Boolean)) as string[]
    const lastActive = dates.length > 0 ? dates.sort().reverse()[0] : p.updated_at

    return {
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      role: p.role,
      coursesEnrolled,
      coursesPassed,
      avgScore,
      lastActive,
    }
  })

  return <AdminUsersClient initialUsers={users} />
}
