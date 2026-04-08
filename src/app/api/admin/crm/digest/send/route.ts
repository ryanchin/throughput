import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { OPEN_STAGES, REMINDER_THRESHOLDS } from '@/lib/crm/constants'
import { buildDigestEmail, type DigestItem } from '@/lib/crm/digest-email'

/**
 * POST /api/admin/crm/digest/send
 * Called by Vercel Cron. Generates and sends daily digest emails.
 *
 * Security: requires Bearer token matching CRON_SECRET env var.
 * Uses service client since this runs as a cron (no user session).
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://throughput.aava.ai'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  // 1. Fetch all users with digest enabled
  const { data: prefs, error: prefsError } = await supabase
    .from('crm_digest_preferences')
    .select('user_id, send_time, timezone')
    .eq('enabled', true)

  if (prefsError) {
    console.error('[Digest] Failed to fetch preferences:', prefsError.message)
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }

  if (!prefs || prefs.length === 0) {
    return NextResponse.json({ message: 'No users with digest enabled', sent: 0 })
  }

  // Fetch profiles for all enabled users
  const userIds = prefs.map((p: { user_id: string }) => p.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds)

  const profileMap: Record<string, { full_name: string; email: string }> = {}
  for (const p of profiles ?? []) {
    profileMap[p.id] = { full_name: p.full_name ?? 'User', email: p.email }
  }

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  // 2. Fetch shared data once (all users see the same pool, filtered by relevance)
  // -- Stale deals --
  const staleDealCutoff = new Date(now)
  staleDealCutoff.setDate(staleDealCutoff.getDate() - REMINDER_THRESHOLDS.staleDealDays)

  const { data: openOpps } = await supabase
    .from('crm_opportunities')
    .select('id, title, company_id, stage, value, created_at')
    .in('stage', OPEN_STAGES as unknown as string[])

  // Get all activities for relevant companies
  const companyIds = [...new Set((openOpps ?? []).map((o: { company_id: string }) => o.company_id))]
  const oppIds = (openOpps ?? []).map((o: { id: string }) => o.id)

  let activities: { company_id: string; opportunity_id: string | null; activity_date: string }[] = []
  if (companyIds.length > 0) {
    const { data: actData } = await supabase
      .from('crm_activities')
      .select('company_id, opportunity_id, activity_date')
      .in('company_id', companyIds)
    activities = actData ?? []
  }

  // Build stale deals list
  const staleDeals: { id: string; title: string; company_id: string; stage: string; value: number | null; daysSinceActivity: number }[] = []
  for (const opp of openOpps ?? []) {
    const relevantActivities = activities.filter(
      (a) => a.opportunity_id === opp.id || a.company_id === opp.company_id
    )
    const maxDate = relevantActivities.reduce<Date | null>((max, a) => {
      const d = new Date(a.activity_date)
      return max === null || d > max ? d : max
    }, null)
    const lastActivity = maxDate ?? new Date(opp.created_at)
    if (lastActivity < staleDealCutoff) {
      const daysSince = Math.floor((now.getTime() - lastActivity.getTime()) / 86400000)
      staleDeals.push({
        id: opp.id,
        title: opp.title,
        company_id: opp.company_id,
        stage: opp.stage,
        value: opp.value != null ? Number(opp.value) : null,
        daysSinceActivity: daysSince,
      })
    }
  }

  // Get company names for stale deals
  let companyNameMap: Record<string, string> = {}
  const staleDealCompanyIds = [...new Set(staleDeals.map((d) => d.company_id))]
  if (staleDealCompanyIds.length > 0) {
    const { data: companies } = await supabase
      .from('crm_companies')
      .select('id, name')
      .in('id', staleDealCompanyIds)
    for (const c of companies ?? []) {
      companyNameMap[c.id] = c.name
    }
  }

  // -- Overdue tasks --
  const { data: overdueTasks } = await supabase
    .from('crm_activities')
    .select('id, subject, company_id, opportunity_id, due_date, created_by')
    .eq('type', 'task')
    .eq('completed', false)
    .lt('due_date', todayStr)
    .not('status', 'eq', 'Completed')

  // Get task owners
  let taskOwnerMap: Record<string, string[]> = {}
  const taskIds = (overdueTasks ?? []).map((t: { id: string }) => t.id)
  if (taskIds.length > 0) {
    const { data: owners } = await supabase
      .from('crm_action_owners')
      .select('activity_id, user_id')
      .in('activity_id', taskIds)
    for (const o of owners ?? []) {
      if (!taskOwnerMap[o.activity_id]) taskOwnerMap[o.activity_id] = []
      taskOwnerMap[o.activity_id].push(o.user_id)
    }
  }

  // -- Upcoming rolloffs (within 30 days) --
  const rolloffCutoff = new Date(now)
  rolloffCutoff.setDate(rolloffCutoff.getDate() + 30)
  const rolloffCutoffStr = rolloffCutoff.toISOString().split('T')[0]

  const { data: rolloffs } = await supabase
    .from('crm_assignments')
    .select('id, consultant_id, expected_end_date, account_id, crm_consultants!inner(profiles!inner(full_name)), crm_companies!inner(name)')
    .eq('status', 'Active')
    .gte('expected_end_date', todayStr)
    .lte('expected_end_date', rolloffCutoffStr)

  // -- Open roles --
  const { data: openRoles } = await supabase
    .from('crm_roles')
    .select('id, name, function, account_id, crm_companies(name)')
    .eq('status', 'Open')

  // 3. For each user, build their digest and send
  let sentCount = 0
  let failedCount = 0

  for (const pref of prefs as { user_id: string }[]) {
    const userId = pref.user_id
    const profile = profileMap[userId]
    if (!profile) continue

    const items: DigestItem[] = []

    // Stale deals (all users see all stale deals)
    for (const deal of staleDeals) {
      const companyName = companyNameMap[deal.company_id] ?? 'Unknown'
      const tokenId = await createActionToken(supabase, userId, 'view', 'opportunity', deal.id)
      items.push({
        type: 'stale_deal',
        title: deal.title,
        subtitle: companyName,
        detail: `${deal.daysSinceActivity} days since last activity - Stage: ${deal.stage}${deal.value ? ` - $${deal.value.toLocaleString()}` : ''}`,
        actions: [
          { label: 'View Deal', tokenId },
        ],
      })
    }

    // Overdue tasks (only tasks owned by or created by this user)
    for (const task of overdueTasks ?? []) {
      const owners = taskOwnerMap[task.id] ?? []
      if (!owners.includes(userId) && task.created_by !== userId) continue

      const dueDate = new Date(task.due_date)
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / 86400000)
      const completeTokenId = await createActionToken(supabase, userId, 'mark_complete', 'task', task.id)
      const viewTokenId = await createActionToken(supabase, userId, 'view', 'task', task.id)
      items.push({
        type: 'overdue_task',
        title: task.subject,
        subtitle: `${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue`,
        detail: `Due: ${task.due_date}`,
        actions: [
          { label: 'Mark Complete', tokenId: completeTokenId },
          { label: 'View Task', tokenId: viewTokenId },
        ],
      })
    }

    // Rolloffs (all users see all)
    for (const rolloff of rolloffs ?? []) {
      const endDate = new Date(rolloff.expected_end_date)
      const daysUntil = Math.ceil((endDate.getTime() - now.getTime()) / 86400000)
      const consultant = (rolloff as Record<string, unknown>).crm_consultants as { profiles: { full_name: string } }
      const account = (rolloff as Record<string, unknown>).crm_companies as { name: string }
      const tokenId = await createActionToken(supabase, userId, 'view', 'assignment', rolloff.id)
      items.push({
        type: 'rolloff',
        title: consultant?.profiles?.full_name ?? 'Unknown Consultant',
        subtitle: account?.name ?? 'Unknown Account',
        detail: `Rolling off in ${daysUntil} day${daysUntil === 1 ? '' : 's'} (${rolloff.expected_end_date})`,
        actions: [
          { label: 'View Details', tokenId },
        ],
      })
    }

    // Open roles (all users see all)
    for (const role of openRoles ?? []) {
      const account = (role as Record<string, unknown>).crm_companies as { name: string } | null
      const tokenId = await createActionToken(supabase, userId, 'view', 'role', role.id)
      items.push({
        type: 'open_role',
        title: role.name,
        subtitle: account?.name ?? 'No account',
        detail: role.function ? `Function: ${role.function}` : 'No function specified',
        actions: [
          { label: 'View Role', tokenId },
        ],
      })
    }

    // Build email
    const emailHtml = buildDigestEmail({
      userName: profile.full_name,
      items,
      baseUrl,
    })

    // Send via Resend
    let deliveryStatus = 'sent'
    let retries = 0

    while (retries < 2) {
      try {
        const sendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'Throughput CRM <crm@throughput.aava.ai>',
            to: profile.email,
            subject: items.length === 0
              ? 'Daily Digest - All Clear!'
              : `Daily Digest - ${items.length} item${items.length === 1 ? '' : 's'} need attention`,
            html: emailHtml,
          }),
        })

        if (sendRes.ok) {
          deliveryStatus = 'sent'
          sentCount++
          break
        } else {
          const errText = await sendRes.text()
          console.error(`[Digest] Resend error for ${profile.email}:`, errText)
          deliveryStatus = 'failed'
          retries++
        }
      } catch (err) {
        console.error(`[Digest] Send error for ${profile.email}:`, err)
        deliveryStatus = 'failed'
        retries++
      }
    }

    if (deliveryStatus === 'failed') failedCount++

    // Log to crm_digest_logs
    await supabase.from('crm_digest_logs').insert({
      user_id: userId,
      sent_at: new Date().toISOString(),
      items_count: items.length,
      clicked_items: 0,
      delivery_status: deliveryStatus,
    })
  }

  return NextResponse.json({
    message: 'Digest send complete',
    sent: sentCount,
    failed: failedCount,
    total: prefs.length,
  })
}

/**
 * Create an action token and return its ID.
 */
async function createActionToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  actionType: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown> = {}
): Promise<string> {
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 24)

  const { data, error } = await supabase
    .from('crm_action_tokens')
    .insert({
      user_id: userId,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      payload,
      used: false,
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[Digest] Failed to create action token:', error?.message)
    return 'invalid'
  }

  return data.id
}
