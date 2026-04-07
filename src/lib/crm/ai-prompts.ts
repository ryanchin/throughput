import { STAGES } from './constants'

/**
 * AI prompt for enriching company data from a name/URL.
 * Returns structured JSON with industry, size, description, website.
 */
export function buildEnrichmentPrompt(name: string, url?: string): string {
  return `Given a company name (and optionally a URL), return a JSON object with:
- industry (string, e.g. "Financial Services", "Healthcare", "Technology")
- company_size (one of: 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+)
- description (1-2 sentences about what they do)
- website (URL if not provided, or the same URL if provided)

Company: ${name}
URL: ${url || 'not provided'}

Return ONLY valid JSON, no markdown fences, no preamble.`
}

/**
 * AI prompt for parsing natural language sales updates into structured actions.
 * Returns a JSON array of actions to apply.
 */
export function buildNLParsePrompt(text: string): string {
  const stageList = STAGES.join(', ')
  return `Parse this sales update into structured actions. Return a JSON array of actions.

Action types:
- create_activity: {"action": "create_activity", "type": "call|email|meeting|note|task", "subject": "string", "description": "string", "company_name": "string"}
- update_stage: {"action": "update_stage", "company_name": "string", "opportunity_title": "string", "new_stage": "string"}
- create_task: {"action": "create_task", "subject": "string", "due_date": "YYYY-MM-DD or null", "company_name": "string"}
- create_company: {"action": "create_company", "name": "string"}
- create_contact: {"action": "create_contact", "name": "string", "company_name": "string", "title": "string", "email": "string"}

Valid stages: ${stageList}

Input: "${text}"

Return ONLY a valid JSON array of actions. If a company or opportunity doesn't exist, include the action anyway and note the company_name as given. Do not wrap in markdown fences.`
}

/**
 * AI prompt for suggesting next actions after logging an activity.
 */
export function buildNextActionPrompt(params: {
  activityType: string
  subject: string
  description?: string
  companyName: string
  stage?: string
  value?: number | null
  daysInStage?: number
}): string {
  return `Given this sales activity and deal context, suggest 2-3 concrete next actions.

Activity just logged: ${params.activityType} - ${params.subject}${params.description ? ` - ${params.description}` : ''}
Company: ${params.companyName}
${params.stage ? `Deal stage: ${params.stage}` : 'No active deal'}
${params.value != null ? `Deal value: $${params.value}` : ''}
${params.daysInStage != null ? `Days in current stage: ${params.daysInStage}` : ''}

Return a JSON array of objects with {action: string, priority: "high"|"medium"|"low"}.
Return ONLY valid JSON, no markdown fences, no preamble.`
}

/**
 * AI prompt for scoring a deal's close probability.
 */
export function buildDealScorePrompt(params: {
  companyName: string
  title: string
  stage: string
  value?: number | null
  daysInStage: number
  activityCount: number
  daysSinceLastActivity: number | null
}): string {
  return `Score this deal's likelihood of closing on a scale of 0-100.

Company: ${params.companyName}
Deal: ${params.title}
Stage: ${params.stage}
Value: ${params.value != null ? `$${params.value}` : 'Unknown'}
Days in current stage: ${params.daysInStage}
Total activities logged: ${params.activityCount}
Days since last activity: ${params.daysSinceLastActivity ?? 'No activities'}

Consider: stage progression, engagement level (activity frequency), deal value, and time-in-stage.
Higher activity + faster stage progression = higher score.
Deals stuck in early stages with no activity should score low.

Return ONLY a JSON object: {"score": number, "reasoning": "one sentence"}.
No markdown fences, no preamble.`
}

/**
 * AI prompt for generating a weekly pipeline digest.
 */
export function buildWeeklyDigestPrompt(params: {
  totalPipeline: number
  weightedPipeline: number
  dealCount: number
  wonThisWeek: number
  wonValueThisWeek: number
  lostThisWeek: number
  stageBreakdown: Record<string, { count: number; value: number }>
  staleDeals: { title: string; company: string; daysSinceActivity: number }[]
  upcomingCloses: { title: string; company: string; closeDate: string }[]
}): string {
  return `Generate a concise weekly pipeline digest for a sales team meeting. Write in a direct, actionable tone.

Pipeline Summary:
- Total pipeline value: $${params.totalPipeline.toLocaleString()}
- Weighted pipeline: $${params.weightedPipeline.toLocaleString()}
- Active deals: ${params.dealCount}
- Won this week: ${params.wonThisWeek} deals ($${params.wonValueThisWeek.toLocaleString()})
- Lost this week: ${params.lostThisWeek} deals

Stage breakdown: ${JSON.stringify(params.stageBreakdown)}

Stale deals (no activity in 14+ days):
${params.staleDeals.map(d => `- "${d.title}" at ${d.company} (${d.daysSinceActivity} days)`).join('\n') || 'None'}

Upcoming closes (within 7 days):
${params.upcomingCloses.map(d => `- "${d.title}" at ${d.company} (${d.closeDate})`).join('\n') || 'None'}

Return a JSON object: {"summary": "2-3 paragraph digest", "highlights": ["bullet1", "bullet2", "bullet3"], "action_items": ["item1", "item2"]}.
No markdown fences, no preamble.`
}
