/**
 * Adaptive Card JSON builders for Microsoft Teams bot messages.
 *
 * Uses Adaptive Card schema 1.4 (Teams supports up to 1.5).
 * Cards are returned as plain objects — serialize to JSON before sending.
 *
 * Reference: https://adaptivecards.io/explorer/
 */

export interface ParsedAction {
  action: string
  company_name?: string
  subject?: string
  description?: string
  type?: string
  new_stage?: string
  opportunity_title?: string
  due_date?: string | null
  name?: string
  title?: string
  email?: string
  matched_company?: { id: string; name: string } | null
  [key: string]: unknown
}

// ── Icon mapping for action types ──────────────────────────
const ACTION_ICONS: Record<string, string> = {
  create_activity: '\u{1F4DD}',  // memo
  update_stage: '\u{1F4CA}',     // bar chart
  create_task: '\u{2705}',       // check mark
  create_company: '\u{1F3E2}',   // office building
  create_contact: '\u{1F464}',   // person silhouette
}

/**
 * Build a human-readable description of a parsed action.
 */
function describeAction(action: ParsedAction): string {
  switch (action.action) {
    case 'create_activity':
      return `Log ${action.type ?? 'activity'}: "${action.subject ?? ''}"${action.company_name ? ` for ${action.company_name}` : ''}`
    case 'update_stage':
      return `Move "${action.opportunity_title ?? 'deal'}"${action.company_name ? ` (${action.company_name})` : ''} to ${action.new_stage ?? 'unknown stage'}`
    case 'create_task':
      return `Create task: "${action.subject ?? ''}"${action.due_date ? ` (due ${action.due_date})` : ''}${action.company_name ? ` for ${action.company_name}` : ''}`
    case 'create_company':
      return `Create company: "${action.name ?? action.company_name ?? ''}"`
    case 'create_contact':
      return `Create contact: "${action.name ?? ''}"${action.title ? ` (${action.title})` : ''}${action.company_name ? ` at ${action.company_name}` : ''}`
    default:
      return `${action.action}: ${JSON.stringify(action)}`
  }
}

/**
 * Build a confirmation Adaptive Card that shows parsed NL actions with toggles.
 *
 * Each action gets a ToggleInput so the user can deselect actions they don't want.
 * "Apply Selected" submits with type='confirm' and the full action data.
 * "Cancel" submits with type='cancel'.
 */
export function buildConfirmationCard(
  actions: ParsedAction[],
  originalText: string
): object {
  const actionToggles = actions.map((action, index) => {
    const icon = ACTION_ICONS[action.action] ?? '\u{1F539}'
    const description = describeAction(action)
    const matchInfo =
      action.matched_company
        ? ` (matched: ${action.matched_company.name})`
        : action.company_name
          ? ' (new company)'
          : ''

    return {
      type: 'Input.Toggle',
      id: `action_${index}`,
      title: `${icon} ${description}${matchInfo}`,
      value: 'true',
      defaultValue: 'true',
    }
  })

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: 'CRM Update',
        weight: 'Bolder',
        size: 'Medium',
      },
      {
        type: 'TextBlock',
        text: `"${originalText}"`,
        wrap: true,
        isSubtle: true,
        spacing: 'Small',
      },
      {
        type: 'TextBlock',
        text: `I parsed ${actions.length} action${actions.length !== 1 ? 's' : ''} from your update. Toggle off any you want to skip:`,
        wrap: true,
        spacing: 'Medium',
      },
      ...actionToggles,
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: 'Apply Selected',
        style: 'positive',
        data: {
          msteams: { type: 'messageBack' },
          type: 'confirm',
          actions: actions,
          originalText,
        },
      },
      {
        type: 'Action.Submit',
        title: 'Cancel',
        data: {
          msteams: { type: 'messageBack' },
          type: 'cancel',
        },
      },
    ],
  }
}

/**
 * Build a success card after actions are applied.
 */
export function buildSuccessCard(appliedActions: string[]): object {
  const bulletList = appliedActions.map((a) => `\u{2705} ${a}`).join('\n\n')

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: 'Updates Applied',
        weight: 'Bolder',
        size: 'Medium',
        color: 'Good',
      },
      {
        type: 'TextBlock',
        text: bulletList,
        wrap: true,
        spacing: 'Small',
      },
    ],
  }
}

/**
 * Build an error card.
 */
export function buildErrorCard(message: string): object {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: 'Something went wrong',
        weight: 'Bolder',
        size: 'Medium',
        color: 'Attention',
      },
      {
        type: 'TextBlock',
        text: message,
        wrap: true,
        spacing: 'Small',
      },
    ],
  }
}

/**
 * Build a welcome card shown when the bot is first installed.
 */
export function buildWelcomeCard(): object {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: 'Throughput CRM Bot',
        weight: 'Bolder',
        size: 'Large',
      },
      {
        type: 'TextBlock',
        text: "I can update your CRM deals from right here in Teams. Just type a natural language update and I'll parse it into actions for you.",
        wrap: true,
        spacing: 'Small',
      },
      {
        type: 'TextBlock',
        text: '**Examples:**',
        wrap: true,
        spacing: 'Medium',
      },
      {
        type: 'TextBlock',
        text: '- "Had a call with Premera, moving to proposal stage"\n- "Log a meeting with Acme Corp about the Q3 renewal"\n- "Create a follow-up task for Microsoft due Friday"',
        wrap: true,
        spacing: 'Small',
      },
    ],
  }
}
