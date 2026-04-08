/**
 * Core message handling logic for the Microsoft Teams CRM bot.
 *
 * Processes two types of interactions:
 *   1. Text messages — parsed via NL engine into CRM actions, presented as Adaptive Cards
 *   2. Card actions — confirmed/cancelled actions applied to the CRM database
 *
 * Server-side only. Never import in client components.
 */

import { callOpenRouter } from '@/lib/openrouter/client'
import { buildNLParsePrompt } from '@/lib/crm/ai-prompts'
import { createServiceClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/database.types'
import {
  buildConfirmationCard,
  buildSuccessCard,
  buildErrorCard,
  buildWelcomeCard,
  type ParsedAction,
} from './adaptive-cards'
import { replyToActivity } from './reply'

// ── Types ──────────────────────────────────────────────────

export interface TeamsActivity {
  type: string
  text?: string
  from: { id: string; name: string; aadObjectId?: string }
  conversation: { id: string; tenantId?: string }
  serviceUrl: string
  channelId: string
  id: string
  replyToId?: string
  value?: Record<string, unknown> // For card action submissions
}

interface ActionWithMatch extends ParsedAction {
  matched_company?: { id: string; name: string } | null
  company_candidates?: { id: string; name: string }[]
}

// ── Helpers ────────────────────────────────────────────────

/**
 * Look up a CRM user profile by Teams display name.
 *
 * v1: Matches by full_name (case-insensitive).
 *
 * TODO (v2): Match by email via Microsoft Graph API. This requires
 * the bot to have User.Read.All permission to resolve the Teams
 * user's UPN/email from their aadObjectId, then match against
 * profiles.email. This is more reliable than name matching.
 */
async function findUserProfile(
  activity: TeamsActivity
): Promise<{ id: string; full_name: string } | null> {
  const supabase = createServiceClient()

  // Try name-based matching (case-insensitive)
  const displayName = activity.from.name
  if (!displayName) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .ilike('full_name', displayName)
    .limit(1)
    .single()

  if (!data || !data.full_name) return null
  return { id: data.id, full_name: data.full_name }
}

/**
 * Parse natural language text into structured CRM actions.
 * Reuses the same prompt builder and LLM call as the web-based NL parse.
 */
async function parseNaturalLanguage(text: string): Promise<ActionWithMatch[]> {
  const prompt = buildNLParsePrompt(text)

  const result = await callOpenRouter(
    [
      {
        role: 'system',
        content:
          'You are a CRM assistant that parses sales updates into structured actions.',
      },
      { role: 'user', content: prompt },
    ],
    {
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2048,
    }
  )

  // Parse response — could be a JSON array or an object with an actions array
  let actions: ParsedAction[]
  const parsed = JSON.parse(result)
  if (Array.isArray(parsed)) {
    actions = parsed
  } else if (Array.isArray(parsed.actions)) {
    actions = parsed.actions
  } else {
    actions = [parsed]
  }

  // Fuzzy match company names against existing companies
  const supabase = createServiceClient()
  const enriched: ActionWithMatch[] = []

  for (const action of actions) {
    const enrichedAction: ActionWithMatch = { ...action }

    if (action.company_name && typeof action.company_name === 'string') {
      const companyName = action.company_name
      const { data: candidates } = await supabase
        .from('crm_companies')
        .select('id, name')
        .or(`name.ilike.%${companyName}%,name.ilike.${companyName}%`)
        .limit(5)

      if (candidates && candidates.length > 0) {
        const exactMatch = candidates.find(
          (c) => c.name.toLowerCase() === companyName.toLowerCase()
        )
        enrichedAction.matched_company = exactMatch ?? candidates[0]
        enrichedAction.company_candidates = candidates.slice(0, 3)
      } else {
        enrichedAction.matched_company = null
        enrichedAction.company_candidates = []
      }
    }

    enriched.push(enrichedAction)
  }

  return enriched
}

/**
 * Build a human-readable description of an applied action.
 */
function describeApplied(action: ParsedAction): string {
  switch (action.action) {
    case 'create_activity':
      return `Logged ${action.type ?? 'activity'}: "${action.subject ?? ''}"${action.company_name ? ` for ${action.company_name}` : ''}`
    case 'update_stage':
      return `Moved "${action.opportunity_title ?? 'deal'}" to ${action.new_stage ?? 'unknown'}`
    case 'create_task':
      return `Created task: "${action.subject ?? ''}"${action.due_date ? ` (due ${action.due_date})` : ''}`
    case 'create_company':
      return `Created company: "${action.name ?? action.company_name ?? ''}"`
    case 'create_contact':
      return `Created contact: "${action.name ?? ''}"`
    default:
      return `Applied: ${action.action}`
  }
}

// ── Main Handlers ──────────────────────────────────────────

/**
 * Handle an incoming text message from a Teams user.
 *
 * Flow: identify user -> parse NL text -> show confirmation card
 */
export async function handleMessage(activity: TeamsActivity): Promise<void> {
  const { serviceUrl, conversation, id: activityId } = activity
  const text = activity.text?.trim()

  // Strip bot @mention prefix (Teams includes it in the text)
  const cleanedText = text?.replace(/<at>.*?<\/at>\s*/gi, '').trim()

  if (!cleanedText) {
    await replyToActivity(serviceUrl, conversation.id, activityId, {
      type: 'card',
      card: buildWelcomeCard(),
    })
    return
  }

  // Identify the CRM user
  const profile = await findUserProfile(activity)
  if (!profile) {
    await replyToActivity(serviceUrl, conversation.id, activityId, {
      type: 'card',
      card: buildErrorCard(
        "I don't recognize your account. Your Teams display name doesn't match any CRM profile. Please contact your admin."
      ),
    })
    return
  }

  // Parse the natural language update
  let actions: ActionWithMatch[]
  try {
    actions = await parseNaturalLanguage(cleanedText)
  } catch (error) {
    console.error(
      '[Teams Bot] NL parse error:',
      error instanceof Error ? error.message : error
    )
    await replyToActivity(serviceUrl, conversation.id, activityId, {
      type: 'card',
      card: buildErrorCard(
        "I couldn't understand that update. Try something like: \"Had a call with Acme, moving to proposal stage.\""
      ),
    })
    return
  }

  if (actions.length === 0) {
    await replyToActivity(serviceUrl, conversation.id, activityId, {
      type: 'card',
      card: buildErrorCard(
        "I couldn't find any CRM actions in your message. Try mentioning a company, activity type, or stage change."
      ),
    })
    return
  }

  // Log the parse to crm_nl_parse_log for accuracy tracking
  const supabase = createServiceClient()
  await supabase.from('crm_nl_parse_log').insert({
    raw_input: cleanedText,
    parsed_actions: actions as unknown as Json,
    created_by: profile.id,
  })

  // Send confirmation card
  const card = buildConfirmationCard(actions, cleanedText)
  await replyToActivity(serviceUrl, conversation.id, activityId, {
    type: 'card',
    card,
  })

  // Store conversation reference for future proactive messaging
  // TODO (v2): Save activity.conversation.id + activity.serviceUrl to
  // a teams_conversations table or profiles.teams_conversation_id column
  // for proactive notifications.
}

/**
 * Handle a card action submission (user clicked "Apply" or "Cancel").
 */
export async function handleCardAction(activity: TeamsActivity): Promise<void> {
  const { serviceUrl, conversation, id: activityId, value } = activity

  if (!value) {
    return
  }

  const actionType = value.type as string

  // Handle cancel
  if (actionType === 'cancel') {
    await replyToActivity(serviceUrl, conversation.id, activityId, {
      type: 'message',
      text: 'Cancelled. No changes were made.',
    })
    return
  }

  // Handle confirm
  if (actionType === 'confirm') {
    const allActions = value.actions as ParsedAction[] | undefined
    if (!allActions || allActions.length === 0) {
      await replyToActivity(serviceUrl, conversation.id, activityId, {
        type: 'card',
        card: buildErrorCard('No actions to apply.'),
      })
      return
    }

    // Determine which actions the user kept toggled on
    const selectedActions = allActions.filter((_, index) => {
      const toggleKey = `action_${index}`
      // Toggle values come as 'true'/'false' strings from Adaptive Cards
      return value[toggleKey] !== 'false'
    })

    if (selectedActions.length === 0) {
      await replyToActivity(serviceUrl, conversation.id, activityId, {
        type: 'message',
        text: 'No actions were selected. Nothing was applied.',
      })
      return
    }

    // Identify the user for creating activities
    const profile = await findUserProfile(activity)
    if (!profile) {
      await replyToActivity(serviceUrl, conversation.id, activityId, {
        type: 'card',
        card: buildErrorCard("I don't recognize your account."),
      })
      return
    }

    const supabase = createServiceClient()
    const appliedDescriptions: string[] = []
    const errors: string[] = []

    for (const action of selectedActions) {
      try {
        await applyAction(supabase, action, profile.id)
        appliedDescriptions.push(describeApplied(action))
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Teams Bot] Failed to apply action:`, action, msg)
        errors.push(`Failed: ${describeApplied(action)} (${msg})`)
      }
    }

    if (appliedDescriptions.length > 0) {
      const card = buildSuccessCard(appliedDescriptions)
      await replyToActivity(serviceUrl, conversation.id, activityId, {
        type: 'card',
        card,
      })
    }

    if (errors.length > 0) {
      await replyToActivity(serviceUrl, conversation.id, activityId, {
        type: 'card',
        card: buildErrorCard(errors.join('\n')),
      })
    }

    return
  }

  // Unknown action type
  await replyToActivity(serviceUrl, conversation.id, activityId, {
    type: 'message',
    text: 'Unknown action. Please try again.',
  })
}

/**
 * Handle the conversationUpdate event (bot installed or user added).
 */
export async function handleConversationUpdate(
  activity: TeamsActivity
): Promise<void> {
  await replyToActivity(
    activity.serviceUrl,
    activity.conversation.id,
    activity.id,
    { type: 'card', card: buildWelcomeCard() }
  )
}

// ── Action Appliers ────────────────────────────────────────

/**
 * Apply a single parsed action to the CRM database.
 *
 * Uses the service client (bypasses RLS) because the bot acts on behalf
 * of the identified user. The user_id is set explicitly on all records.
 */
async function applyAction(
  supabase: ReturnType<typeof createServiceClient>,
  action: ParsedAction,
  userId: string
): Promise<void> {
  // Resolve company ID from matched_company or by name
  const companyId = action.matched_company?.id ?? (await resolveCompanyId(supabase, action.company_name))

  switch (action.action) {
    case 'create_activity': {
      if (!companyId) {
        throw new Error('Cannot create activity: company not found')
      }
      const { error } = await supabase.from('crm_activities').insert({
        company_id: companyId,
        created_by: userId,
        type: (action.type as string) ?? 'note',
        subject: (action.subject as string) ?? 'Teams bot update',
        description: (action.description as string) ?? null,
        activity_date: new Date().toISOString(),
      })
      if (error) throw new Error(`create_activity: ${error.message}`)
      break
    }

    case 'update_stage': {
      if (!companyId) {
        throw new Error('Cannot update stage: company not found')
      }
      // Find the opportunity by title and company
      const oppTitle = (action.opportunity_title as string) ?? ''
      let oppQuery = supabase
        .from('crm_opportunities')
        .select('id')
        .eq('company_id', companyId)

      if (oppTitle) {
        oppQuery = oppQuery.ilike('title', `%${oppTitle}%`)
      }

      const { data: opps } = await oppQuery.limit(1)
      const opp = opps?.[0]
      if (!opp) {
        throw new Error(
          `Cannot update stage: no matching opportunity found${oppTitle ? ` for "${oppTitle}"` : ''}`
        )
      }

      const { error } = await supabase
        .from('crm_opportunities')
        .update({
          stage: action.new_stage as string,
          updated_at: new Date().toISOString(),
        })
        .eq('id', opp.id)
      if (error) throw new Error(`update_stage: ${error.message}`)

      // Also log an activity for the stage change
      await supabase.from('crm_activities').insert({
        company_id: companyId,
        opportunity_id: opp.id,
        created_by: userId,
        type: 'note',
        subject: `Stage updated to ${action.new_stage}`,
        description: `Updated via Teams bot`,
        activity_date: new Date().toISOString(),
      })
      break
    }

    case 'create_task': {
      if (!companyId) {
        throw new Error('Cannot create task: company not found')
      }
      // crm_activities with type='task'; due_date is stored in the description
      // since the schema doesn't have a dedicated due_date column
      const dueInfo = action.due_date ? ` (due: ${action.due_date})` : ''
      const { error } = await supabase.from('crm_activities').insert({
        company_id: companyId,
        created_by: userId,
        type: 'task',
        subject: (action.subject as string) ?? 'Task from Teams',
        description: ((action.description as string) ?? '') + dueInfo || null,
        activity_date: new Date().toISOString(),
        completed: false,
      })
      if (error) throw new Error(`create_task: ${error.message}`)
      break
    }

    case 'create_company': {
      const name = (action.name as string) ?? (action.company_name as string) ?? ''
      if (!name) throw new Error('create_company: name is required')
      const { error } = await supabase.from('crm_companies').insert({
        name,
        status: 'prospect',
      })
      if (error) throw new Error(`create_company: ${error.message}`)
      break
    }

    case 'create_contact': {
      if (!companyId) {
        throw new Error('Cannot create contact: company not found')
      }
      const { error } = await supabase.from('crm_contacts').insert({
        company_id: companyId,
        name: (action.name as string) ?? 'Unknown',
        title: (action.title as string) ?? null,
        email: (action.email as string) ?? null,
      })
      if (error) throw new Error(`create_contact: ${error.message}`)
      break
    }

    default:
      console.warn(`[Teams Bot] Unknown action type: ${action.action}`)
  }
}

/**
 * Resolve a company name to its ID via fuzzy match.
 * Returns null if no match found (action can still proceed without a company).
 */
async function resolveCompanyId(
  supabase: ReturnType<typeof createServiceClient>,
  companyName: string | undefined
): Promise<string | null> {
  if (!companyName) return null

  const { data } = await supabase
    .from('crm_companies')
    .select('id, name')
    .or(`name.ilike.%${companyName}%,name.ilike.${companyName}%`)
    .limit(1)

  return data?.[0]?.id ?? null
}
