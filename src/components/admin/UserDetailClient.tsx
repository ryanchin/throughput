'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserForm } from '@/components/admin/UserForm'
import { DeleteUserDialog } from '@/components/admin/DeleteUserDialog'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: string
}

interface CourseDetail {
  courseTitle: string
  courseSlug: string
  zone: string
  passingScore: number
  status: string
  finalScore: number | null
  enrolledAt: string
  completedAt: string | null
  lessonsCompleted: number
  lessonsTotal: number
}

interface UserDetailClientProps {
  userProfile: UserProfile
  courseDetails: CourseDetail[]
  isCurrentUser: boolean
}

const roleColor = (role: string) => {
  switch (role) {
    case 'admin': return 'text-accent bg-accent-muted border-accent/30'
    case 'sales': return 'text-[var(--secondary)] bg-[var(--secondary-muted)] border-[var(--secondary)]/30'
    default: return 'text-foreground-muted bg-muted border-border'
  }
}

const statusColor = (status: string) => {
  switch (status) {
    case 'passed': return 'text-[var(--success)] bg-[var(--success-muted)]'
    case 'failed': return 'text-[var(--warning)] bg-[var(--warning-muted)]'
    default: return 'text-foreground-muted bg-muted'
  }
}

export function UserDetailClient({ userProfile, courseDetails, isCurrentUser }: UserDetailClientProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function handleEditSaved() {
    router.refresh()
  }

  function handleDeleted() {
    router.push('/admin/users')
  }

  return (
    <div className="p-8">
      <Link href="/admin/users" className="text-accent hover:text-accent-hover text-sm mb-4 inline-block">
        &larr; Back to Users
      </Link>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {userProfile.full_name || 'Unnamed User'}
          </h1>
          <p className="text-foreground-muted">{userProfile.email}</p>
          <span className={`inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-medium border ${roleColor(userProfile.role)}`}>
            {userProfile.role}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditOpen(true)}
            className="bg-muted border border-border text-foreground hover:bg-raised px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            data-testid="edit-user-btn"
          >
            Edit
          </button>
          {!isCurrentUser && (
            <button
              onClick={() => setDeleteOpen(true)}
              className="bg-[var(--destructive-muted)] border border-[var(--destructive)] text-[var(--destructive)] hover:bg-[var(--destructive)] hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              data-testid="delete-user-btn"
            >
              Delete
            </button>
          )}
        </div>
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

      {/* Edit User Dialog */}
      <UserForm
        user={{
          id: userProfile.id,
          email: userProfile.email,
          full_name: userProfile.full_name ?? '',
          role: userProfile.role,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={handleEditSaved}
      />

      {/* Delete User Confirmation */}
      {!isCurrentUser && (
        <DeleteUserDialog
          userId={userProfile.id}
          userName={userProfile.full_name || userProfile.email}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
