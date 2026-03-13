import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { exportCompletionsCSV } from '@/lib/admin/analytics'

/**
 * GET /api/admin/analytics/export-completions
 *
 * Downloads a CSV file of all course enrollment/completion data.
 * Admin only.
 */
export async function GET() {
  const { error: authError } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  const csv = await exportCompletionsCSV()

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="completions-export-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
