'use client'

import UserTrackingTable from '@/components/admin/UserTrackingTable'

/**
 * Test page for admin UserTrackingTable E2E tests.
 * Renders the table with mock data, bypassing auth.
 */
export default function TestAdminUsersPage() {
  const mockUsers = [
    {
      id: 'u1',
      email: 'alice@aava.ai',
      fullName: 'Alice Johnson',
      role: 'employee',
      coursesEnrolled: 3,
      coursesPassed: 2,
      avgScore: 88,
      lastActive: '2026-03-12T10:00:00Z',
    },
    {
      id: 'u2',
      email: 'bob@aava.ai',
      fullName: 'Bob Smith',
      role: 'sales',
      coursesEnrolled: 2,
      coursesPassed: 1,
      avgScore: 72,
      lastActive: '2026-03-10T14:00:00Z',
    },
    {
      id: 'u3',
      email: 'carol@aava.ai',
      fullName: 'Carol Williams',
      role: 'employee',
      coursesEnrolled: 1,
      coursesPassed: 0,
      avgScore: null,
      lastActive: '2026-03-08T09:00:00Z',
    },
    {
      id: 'u4',
      email: 'dave@aava.ai',
      fullName: null,
      role: 'admin',
      coursesEnrolled: 5,
      coursesPassed: 5,
      avgScore: 95,
      lastActive: '2026-03-12T16:00:00Z',
    },
  ]

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold text-foreground mb-6">User Tracking (Test)</h1>
      <UserTrackingTable users={mockUsers} />
    </div>
  )
}
