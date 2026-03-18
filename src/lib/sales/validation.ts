import { z } from 'zod'

/** All supported material types. */
export const MATERIAL_TYPES = [
  'battle_card',
  'one_pager',
  'case_study',
  'slide_deck',
  'email_template',
  'proposal_template',
  'roi_calculator',
  'video_demo',
  'other',
] as const

export type MaterialType = (typeof MATERIAL_TYPES)[number]

/** Human-readable labels for material types. */
export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  battle_card: 'Battle Card',
  one_pager: 'One-Pager',
  case_study: 'Case Study',
  slide_deck: 'Slide Deck',
  email_template: 'Email Template',
  proposal_template: 'Proposal Template',
  roi_calculator: 'ROI Calculator',
  video_demo: 'Video / Demo',
  other: 'Other',
}

/** Valid statuses for materials. */
export const MATERIAL_STATUSES = ['draft', 'published', 'archived'] as const
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number]

/** MIME types allowed for file uploads. */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
  'image/png',
  'image/jpeg',
] as const

/** Max file size in bytes (50 MB). */
export const MAX_FILE_SIZE_BYTES = 52_428_800

/** Zod schema for listing materials (query params). */
export const listMaterialsSchema = z.object({
  type: z.enum(MATERIAL_TYPES).optional(),
  category: z.string().optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

/** Zod schema for creating a material. */
export const createMaterialSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  slug: z.string().min(1, 'Slug is required').max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(2000).nullable().optional(),
  material_type: z.enum(MATERIAL_TYPES),
  category: z.string().max(100).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  content: z.any().optional(),
  shareable: z.boolean().default(false),
  status: z.enum(['draft', 'published']).default('draft'),
})

/** Zod schema for updating a material (all fields optional). */
export const updateMaterialSchema = createMaterialSchema.partial()

/** Generate a URL-safe slug from a title. */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}
