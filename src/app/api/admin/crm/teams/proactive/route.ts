import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getBotToken } from '@/lib/teams/auth'
import { REMINDER_THRESHOLDS, OPEN_STAGES } from '@/lib/crm/constants'

/**
 * POST /api/admin/crm/teams/proactive
 *
 * Sends proactive Teams DMs to each CRM user asking for updates on:
 * - Stale opportunities (>14 days no activity)
 * - Overdue tasks
 *
 * Called by Vercel Cron or manually. Requires CRON_SECRET bearer token.
 * Only messages users who have previously interacted with the bot
 * (have a row in crm_teams_conversations).
 */
export async function POST(request: NextRequest) {
  // Auth: verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Fetch users with Teams conversation references
  const { data: conversations } = await supabase
    .from('crm_teams_conversations')
    .select('user_id, conversation_id, service_url, teams_user_name')

  if (!conversations || conversations.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No users have registered with the Teams bot yet.' })
  }

  // Get a bot token for sending messages
  let botToken: string
  try {
    botToken = await getBotToken()
  } catch {
    return NextResponse.json({ error: 'Failed to get bot token' }, { status: 500 })
  }

  // For each user, check for stale deals and overdue tasks
  const staleDealCutoff = new Date(today)
  staleDealCutoff.setDate(staleDealCutoff.getDate() - REMINDER_THRESHOLDS.staleDealDays)

  let sentCount = 0

  for (const conv of conversations) {
    const items: string[] = []

    // Stale deals for this user (deals they own or created)
    const { data: openOpps } = await supabase
      .from('crm_opportunities')
      .select('id, title, company_id, stage, updated_at, created_by')
      .in('stage', OPEN_STAGES as unknown as string[])
      .eq('created_by', conv.user_id)

    if (openOpps) {
      // Get recent activities for these deals
      const oppIds = openOpps.map(o => o.id)
      const companyIds = [...new Set(openOpps.map(o => o.company_id))]

      let activities: { opportunity_id: string | null; company_id: string; activity_date: string }[] = []
      if (companyIds.length > 0) {
        const { data: actData } = await supabase
          .from('crm_activities')
          .select('opportunity_id, company_id, activity_date')
          .in('company_id', companyIds)
        activities = actData ?? []
      }

      for (const opp of openOpps) {
        const relevant = activities.filter(
          a => a.opportunity_id === opp.id || a.company_id === opp.company_id
        )
        const maxDate = relevant.reduce<Date | null>((max, a) => {
          const d = new Date(a.activity_date)
          return max === null || d > max ? d : max
        }, null)
        const lastActivity = maxDate ?? new Date(opp.updated_at)
        if (lastActivity < staleDealCutoff) {
          const days = Math.floor((today.getTime() - lastActivity.getTime()) / 86400000)
          items.push(`📊 **${opp.title}** has had no activity for ${days} days (stage: ${opp.stage}). Any update?`)
        }
      }
    }

    // Overdue tasks created by this user
    // Use raw query since crm_action_owners isn't in the typed schema
    const { data: overdueTasks } = await supabase
      .from('crm_activities')
      .select('id, subject')
      .eq('type', 'task')
      .eq('completed', false)
      .eq('created_by', conv.user_id) as { data: { id: string; subject: string }[] | null }

    if (overdueTasks) {
      for (const task of overdueTasks) {
        items.push(`✅ **${task.subject}** needs attention. Done? Reply to update.`)
      }
    }

    // Send DM if there are items
    if (items.length > 0) {
      const greeting = conv.teams_user_name
        ? `Hey ${conv.teams_user_name.split(' ')[0]}!`
        : 'Hey!'

      const message = `${greeting} Here's what needs your attention:\n\n${items.join('\n\n')}\n\n💬 Reply with an update (e.g., "Premera deal moving to proposal") and I'll update the CRM for you.`

      try {
        const url = `${conv.service_url}v3/conversations/${conv.conversation_id}/activities`
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${botToken}`,
          },
          body: JSON.stringify({
            type: 'message',
            text: message,
          }),
        })

        if (res.ok) {
          sentCount++
        } else {
          console.error(`[Teams Proactive] Failed to send to ${conv.user_id}:`, res.status)
        }
      } catch (err) {
        console.error(`[Teams Proactive] Error sending to ${conv.user_id}:`, err)
      }
    }
  }

  return NextResponse.json({ sent: sentCount, total_users: conversations.length })
}
