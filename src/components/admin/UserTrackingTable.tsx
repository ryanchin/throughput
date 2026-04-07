'use client'

import { useState } from 'react'
import Link from 'next/link'

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

interface UserTrackingTableProps {
  users: UserRow[]
  onCreateUser?: () => void
}

/**
 * Admin user tracking table with sortable columns and CSV export.
 */
export default function UserTrackingTable({ users, onCreateUser }: UserTrackingTableProps) {
  const [sortField, setSortField] = useState<keyof UserRow>('lastActive')
  const [sortAsc, setSortAsc] = useState(false)
  const [search, setSearch] = useState('')

  const filteredUsers = users.filter((u) => {
    const term = search.toLowerCase()
    return (
      u.email.toLowerCase().includes(term) ||
      (u.fullName ?? '').toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term)
    )
  })

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]
    if (aVal === null && bVal === null) return 0
    if (aVal === null) return 1
    if (bVal === null) return -1
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortAsc ? aVal - bVal : bVal - aVal
    }
    return 0
  })

  const handleSort = (field: keyof UserRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Role', 'Courses Enrolled', 'Courses Passed', 'Avg Score', 'Last Active']
    const rows = sortedUsers.map((u) => [
      u.fullName ?? '',
      u.email,
      u.role,
      u.coursesEnrolled.toString(),
      u.coursesPassed.toString(),
      u.avgScore !== null ? u.avgScore.toString() : '',
      new Date(u.lastActive).toISOString(),
    ])

    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `user-tracking-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const SortIcon = ({ field }: { field: keyof UserRow }) => {
    if (sortField !== field) return <span className="text-foreground-subtle ml-1">&#8597;</span>
    return <span className="text-accent ml-1">{sortAsc ? '↑' : '↓'}</span>
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-4" data-testid="user-tracking-table">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-muted border border-border rounded-lg px-4 py-2 text-foreground placeholder:text-foreground-subtle text-sm w-64"
          data-testid="user-search"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="bg-muted border border-border text-foreground hover:bg-raised px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            data-testid="export-csv-btn"
          >
            Export CSV
          </button>
          {onCreateUser && (
            <button
              onClick={onCreateUser}
              className="bg-accent text-background hover:bg-accent-hover px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-accent-glow"
              data-testid="create-user-btn"
            >
              Create User
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-foreground-muted text-sm">
                <th
                  className="text-left px-4 py-3 cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('fullName')}
                >
                  Name <SortIcon field="fullName" />
                </th>
                <th
                  className="text-left px-4 py-3 cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('email')}
                >
                  Email <SortIcon field="email" />
                </th>
                <th
                  className="text-left px-4 py-3 cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('role')}
                >
                  Role <SortIcon field="role" />
                </th>
                <th
                  className="text-right px-4 py-3 cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('coursesEnrolled')}
                >
                  Enrolled <SortIcon field="coursesEnrolled" />
                </th>
                <th
                  className="text-right px-4 py-3 cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('coursesPassed')}
                >
                  Passed <SortIcon field="coursesPassed" />
                </th>
                <th
                  className="text-right px-4 py-3 cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('avgScore')}
                >
                  Avg Score <SortIcon field="avgScore" />
                </th>
                <th
                  className="text-right px-4 py-3 cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('lastActive')}
                >
                  Last Active <SortIcon field="lastActive" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-foreground-muted">
                    {search ? 'No users match your search.' : 'No users found.'}
                  </td>
                </tr>
              ) : (
                sortedUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border-subtle last:border-b-0 hover:bg-muted transition-colors"
                    data-testid="user-row"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="text-accent hover:text-accent-hover text-sm font-medium"
                      >
                        {user.fullName || 'Unnamed'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground text-sm">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground-muted border border-border">
                        {user.role}
                      </span>
                    </td>
                    <td className="text-right px-4 py-3 text-foreground text-sm">
                      {user.coursesEnrolled}
                    </td>
                    <td className="text-right px-4 py-3 text-foreground text-sm">
                      {user.coursesPassed}
                    </td>
                    <td className="text-right px-4 py-3 text-sm">
                      {user.avgScore !== null ? (
                        <span className={user.avgScore >= 70 ? 'text-[var(--success)]' : 'text-[var(--warning)]'}>
                          {user.avgScore}%
                        </span>
                      ) : (
                        <span className="text-foreground-subtle">-</span>
                      )}
                    </td>
                    <td className="text-right px-4 py-3 text-foreground-muted text-sm">
                      {formatDate(user.lastActive)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-foreground-subtle text-xs">
        {sortedUsers.length} of {users.length} users shown
      </p>
    </div>
  )
}
