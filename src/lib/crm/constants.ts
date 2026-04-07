export const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] as const
export type Stage = typeof STAGES[number]

export const OPEN_STAGES: Stage[] = ['lead', 'qualified', 'proposal', 'negotiation']
export const CLOSED_STAGES: Stage[] = ['closed_won', 'closed_lost']

export const STAGE_LABELS: Record<Stage, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

export const STAGE_PROBABILITIES: Record<Stage, number> = {
  lead: 10,
  qualified: 25,
  proposal: 50,
  negotiation: 75,
  closed_won: 100,
  closed_lost: 0,
}

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'] as const
export type CompanySize = typeof COMPANY_SIZES[number]

export const COMPANY_STATUSES = ['prospect', 'active', 'churned', 'partner'] as const
export type CompanyStatus = typeof COMPANY_STATUSES[number]

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  prospect: 'Prospect',
  active: 'Active',
  churned: 'Churned',
  partner: 'Partner',
}

export const ACTIVITY_TYPES = ['call', 'email', 'meeting', 'note', 'task'] as const
export type ActivityType = typeof ACTIVITY_TYPES[number]

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  note: 'Note',
  task: 'Task',
}

export const CLOSE_REASONS_WON = ['price', 'features', 'relationship', 'timing', 'other'] as const
export const CLOSE_REASONS_LOST = ['budget', 'competitor', 'timing', 'no_decision', 'features', 'other'] as const

/** Days since last activity thresholds for velocity indicators */
export const VELOCITY_THRESHOLDS = {
  green: 7,   // activity within 7 days
  yellow: 14, // 7-14 days since last activity
  // >14 days = red
} as const

/** Stale deal thresholds for reminders */
export const REMINDER_THRESHOLDS = {
  staleDealDays: 14,
  staleCompanyDays: 30,
  upcomingCloseDays: 7,
} as const
