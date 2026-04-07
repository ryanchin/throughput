import type {
  Stage,
  CompanyStatus,
  CompanySize,
  ActivityType,
} from './constants'

export interface Company {
  id: string
  name: string
  website: string | null
  industry: string | null
  company_size: CompanySize | null
  status: CompanyStatus
  notes: string | null
  tags: string[]
  ai_enriched: boolean
  ai_enrichment_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  company_id: string
  name: string
  email: string | null
  phone: string | null
  title: string | null
  linkedin_url: string | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface Opportunity {
  id: string
  company_id: string
  contact_id: string | null
  title: string
  value: number
  stage: Stage
  expected_close_date: string | null
  notes: string | null
  close_reason: string | null
  ai_score: number | null
  ai_score_explanation: string | null
  created_at: string
  updated_at: string
  // Joined fields
  company?: Pick<Company, 'id' | 'name'>
  contact?: Pick<Contact, 'id' | 'name'> | null
}

export interface Activity {
  id: string
  company_id: string | null
  contact_id: string | null
  opportunity_id: string | null
  user_id: string
  type: ActivityType
  subject: string
  description: string | null
  activity_date: string
  created_at: string
  // Joined fields
  company?: Pick<Company, 'id' | 'name'> | null
  contact?: Pick<Contact, 'id' | 'name'> | null
  opportunity?: Pick<Opportunity, 'id' | 'title'> | null
}

export interface CrmStats {
  pipeline_value: number
  weighted_pipeline: number
  active_deals: number
  won_this_month: number
  won_value_this_month: number
}

export interface Reminder {
  id: string
  type: 'stale_deal' | 'stale_company' | 'upcoming_close'
  title: string
  description: string
  entity_id: string
  entity_type: 'company' | 'opportunity'
  days: number
}
