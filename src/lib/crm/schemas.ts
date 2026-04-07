import { z } from 'zod'
import { STAGES, COMPANY_SIZES, COMPANY_STATUSES, ACTIVITY_TYPES } from './constants'

// ============================================================
// Company Schemas
// ============================================================

export const companyCreateSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(255),
  website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  industry: z.string().max(100).optional().or(z.literal('')),
  company_size: z.enum(COMPANY_SIZES).optional(),
  status: z.enum(COMPANY_STATUSES).default('prospect'),
  notes: z.string().max(5000).optional().or(z.literal('')),
  tags: z.array(z.string().max(50)).max(20).default([]),
})

export const companyUpdateSchema = companyCreateSchema.partial()

export const companySearchSchema = z.object({
  search: z.string().optional(),
  status: z.enum(COMPANY_STATUSES).optional(),
  industry: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

// ============================================================
// Contact Schemas
// ============================================================

export const contactCreateSchema = z.object({
  name: z.string().min(1, 'Contact name is required').max(255),
  email: z.string().email('Must be a valid email').optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  title: z.string().max(255).optional().or(z.literal('')),
  linkedin_url: z.string().url().refine(
    (url) => url.includes('linkedin.com'),
    'Must be a LinkedIn URL'
  ).optional().or(z.literal('')),
  is_primary: z.boolean().default(false),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export const contactUpdateSchema = contactCreateSchema.partial()

// ============================================================
// Opportunity Schemas
// ============================================================

export const opportunityCreateSchema = z.object({
  company_id: z.string().uuid(),
  contact_id: z.string().uuid().optional().or(z.literal('')),
  title: z.string().min(1, 'Title is required').max(255),
  value: z.number().min(0).max(999999999999.99).optional().nullable(),
  stage: z.enum(STAGES).default('lead'),
  probability: z.number().int().min(0).max(100).optional(),
  expected_close_date: z.string().optional().or(z.literal('')),
  close_reason: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export const opportunityUpdateSchema = opportunityCreateSchema.partial().omit({ company_id: true })

// ============================================================
// Activity Schemas
// ============================================================

export const activityCreateSchema = z.object({
  company_id: z.string().uuid(),
  contact_id: z.string().uuid().optional().or(z.literal('')),
  opportunity_id: z.string().uuid().optional().or(z.literal('')),
  type: z.enum(ACTIVITY_TYPES),
  subject: z.string().min(1, 'Subject is required').max(255),
  description: z.string().max(10000).optional().or(z.literal('')),
  activity_date: z.string().datetime().optional(),
  completed: z.boolean().optional(),
})

export const activityTaskUpdateSchema = z.object({
  completed: z.boolean(),
})

// ============================================================
// AI Schemas
// ============================================================

export const enrichRequestSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  url: z.string().url().optional().or(z.literal('')),
})

export const nlParseRequestSchema = z.object({
  text: z.string().min(1, 'Input text is required').max(2000),
})

export const suggestActionsRequestSchema = z.object({
  activity_type: z.enum(ACTIVITY_TYPES),
  subject: z.string(),
  description: z.string().optional(),
  company_name: z.string(),
  stage: z.enum(STAGES).optional(),
  value: z.number().optional().nullable(),
  days_in_stage: z.number().optional(),
})

// ============================================================
// CSV Import Schemas
// ============================================================

export const csvImportSchema = z.object({
  companies: z.array(z.object({
    name: z.string().min(1),
    website: z.string().optional(),
    industry: z.string().optional(),
    company_size: z.string().optional(),
    status: z.string().optional(),
    notes: z.string().optional(),
  })).min(1).max(1000),
})
