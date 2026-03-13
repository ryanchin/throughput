import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { exportUsersCSV } from '@/lib/admin/analytics'

/**
 * GET /api/admin/analytics/export-users
 *
 * Downloads a CSV file of all users with enrollment summary.
 * Admin only.
 */
export async function GET() {
  const { error: authError } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const csv = await exportUsersCSV()

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="users-export-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
