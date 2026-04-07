'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import UserTrackingTable from '@/components/admin/UserTrackingTable'
import { UserForm } from '@/components/admin/UserForm'

interface UserRow {
  id: string
  email: string
  fullName: string | null
  role: string
  coursesEnrolled: number
  coursesPassed: number
  avgScore: number | null
  lastActive: string
}

interface AdminUsersClientProps {
  initialUsers: UserRow[]
}

export function AdminUsersClient({ initialUsers }: AdminUsersClientProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)

  function handleSaved() {
    // Refresh server data after creating a user
    router.refresh()
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-foreground mb-6">User Management</h1>

      <UserTrackingTable
        users={initialUsers}
        onCreateUser={() => setCreateOpen(true)}
      />

      <UserForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={handleSaved}
      />
    </div>
  )
}
