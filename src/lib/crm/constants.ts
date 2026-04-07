// ============================================================
// Deal / Opportunity Stages (§3.4 of CRM Functional Spec)
// ============================================================

export const STAGES = [
  '1. Inquiry',
  '2. Investigation & Analysis',
  '3. Qualification',
  '4. Proposal Creation',
  '5. Proposal Presentation',
  '6. Negotiation/ Review',
  '7a. Closed Won',
  '7b. Closed Lost',
  '7c. Shelf',
] as const
export type Stage = typeof STAGES[number]

export const OPEN_STAGES: Stage[] = [
  '1. Inquiry',
  '2. Investigation & Analysis',
  '3. Qualification',
  '4. Proposal Creation',
  '5. Proposal Presentation',
  '6. Negotiation/ Review',
]
export const CLOSED_STAGES: Stage[] = ['7a. Closed Won', '7b. Closed Lost', '7c. Shelf']

export const STAGE_LABELS: Record<Stage, string> = {
  '1. Inquiry': 'Inquiry',
  '2. Investigation & Analysis': 'Investigation & Analysis',
  '3. Qualification': 'Qualification',
  '4. Proposal Creation': 'Proposal Creation',
  '5. Proposal Presentation': 'Proposal Presentation',
  '6. Negotiation/ Review': 'Negotiation / Review',
  '7a. Closed Won': 'Closed Won',
  '7b. Closed Lost': 'Closed Lost',
  '7c. Shelf': 'Shelf',
}

// Probability is 0–1 (decimal), not 0–100
export const STAGE_PROBABILITIES: Record<Stage, number> = {
  '1. Inquiry': 0,
  '2. Investigation & Analysis': 0.1,
  '3. Qualification': 0.2,
  '4. Proposal Creation': 0.3,
  '5. Proposal Presentation': 0.5,
  '6. Negotiation/ Review': 0.8,
  '7a. Closed Won': 1,
  '7b. Closed Lost': 0,
  '7c. Shelf': 0,
}

// ============================================================
// Company
// ============================================================

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

export const SEGMENTS = ['Flagship', 'Existing', 'Small', 'Nitor', 'Large', 'International'] as const
export type Segment = typeof SEGMENTS[number]

export const HEALTH_VALUES = ['G', 'Y', 'R'] as const
export type Health = typeof HEALTH_VALUES[number]

export const HEALTH_LABELS: Record<Health, string> = {
  G: 'Green',
  Y: 'Yellow',
  R: 'Red',
}

// ============================================================
// Activities / Actions
// ============================================================

export const ACTIVITY_TYPES = ['call', 'email', 'meeting', 'note', 'task'] as const
export type ActivityType = typeof ACTIVITY_TYPES[number]

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  note: 'Note',
  task: 'Task',
}

// Action categories from spec §3.8
export const ACTION_CATEGORIES = ['Follow-up', 'Meeting', 'Task', 'Presentation'] as const
export type ActionCategory = typeof ACTION_CATEGORIES[number]

// Action statuses from spec §3.9
export const ACTION_STATUSES = ['Completed', 'In Progress', 'Not Started', 'On Hold'] as const
export type ActionStatus = typeof ACTION_STATUSES[number]

// ============================================================
// Deals — additional enums from spec
// ============================================================

export const AGENTIC_TYPES = ['AAVA', 'Non-Agentic', 'Agentic, Non-Aava'] as const
export type AgenticType = typeof AGENTIC_TYPES[number]

export const DEAL_SOURCES = ['Parent', 'Moodys New', 'Nitor'] as const
export type DealSource = typeof DEAL_SOURCES[number]

// ============================================================
// Roles (§3.5–3.7)
// ============================================================

export const ROLE_FUNCTIONS = ['Program', 'Product', 'Engineering'] as const
export type RoleFunction = typeof ROLE_FUNCTIONS[number]

export const ROLE_STATUSES = ['Open', 'Filled', 'Filled- External', 'Fulfilled', 'Cancelled'] as const
export type RoleStatus = typeof ROLE_STATUSES[number]

export const ROLE_STAGES = [
  '1. Sourcing',
  '2. Internal Interview',
  '3. Client Interviews',
  '4. Final Interview',
  '5. Offer Extended',
  '6a. Offer Accepted',
  '6b. Offer Rejected',
  '7. Pending Start Date Confirm',
  '8. Start Date Confirmed',
  '9. Active, Billing',
] as const
export type RoleStage = typeof ROLE_STAGES[number]

// ============================================================
// Close reasons + thresholds (unchanged from original)
// ============================================================

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
