import { NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'

/**
 * GET /api/admin/crm/digest/stats
 * Admin-only. Returns digest analytics:
 * - Total digests sent (last 7 days)
 * - Total actions clicked
 * - Per-user breakdown
 */
export async function GET() {
  const { profile, error: authError, supabase } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // Only admins can view digest stats
  if (profile!.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
  }

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const cutoff = sevenDaysAgo.toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Fetch digest logs from last 7 days
  const { data: logs, error: logsError } = await sb
    .from('crm_digest_logs')
    .select('user_id, sent_at, items_count, clicked_items, delivery_status')
    .gte('sent_at', cutoff)
    .order('sent_at', { ascending: false })

  if (logsError) {
    return NextResponse.json({ error: 'Failed to fetch digest logs' }, { status: 500 })
  }

  interface DigestLog {
    user_id: string
    sent_at: string
    items_count: number
    clicked_items: number
    delivery_status: string
  }

  const allLogs: DigestLog[] = logs ?? []

  // Get user names
  const userIds = [...new Set(allLogs.map((l) => l.user_id))]
  let userNameMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)
    for (const p of profiles ?? []) {
      userNameMap[p.id] = p.full_name ?? 'Unknown'
    }
  }

  // Aggregate
  const totalSent = allLogs.filter((l) => l.delivery_status === 'sent').length
  const totalFailed = allLogs.filter((l) => l.delivery_status === 'failed').length
  const totalClicks = allLogs.reduce((sum, l) => sum + (l.clicked_items ?? 0), 0)

  // Per-user breakdown
  const userBreakdown: Record<string, { name: string; digests_received: number; actions_taken: number }> = {}
  for (const log of allLogs) {
    if (!userBreakdown[log.user_id]) {
      userBreakdown[log.user_id] = {
        name: userNameMap[log.user_id] ?? 'Unknown',
        digests_received: 0,
        actions_taken: 0,
      }
    }
    if (log.delivery_status === 'sent') {
      userBreakdown[log.user_id].digests_received++
    }
    userBreakdown[log.user_id].actions_taken += log.clicked_items ?? 0
  }

  return NextResponse.json({
    period: '7d',
    total_sent: totalSent,
    total_failed: totalFailed,
    total_clicks: totalClicks,
    users: Object.values(userBreakdown),
  })
}
