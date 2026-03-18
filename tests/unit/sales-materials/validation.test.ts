import { describe, it, expect } from 'vitest'
import {
  createMaterialSchema,
  updateMaterialSchema,
  listMaterialsSchema,
  MATERIAL_TYPES,
  MATERIAL_TYPE_LABELS,
  MATERIAL_STATUSES,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  generateSlug,
} from '@/lib/sales/validation'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('MATERIAL_TYPES', () => {
  it('contains all expected material types', () => {
    expect(MATERIAL_TYPES).toContain('battle_card')
    expect(MATERIAL_TYPES).toContain('one_pager')
    expect(MATERIAL_TYPES).toContain('case_study')
    expect(MATERIAL_TYPES).toContain('slide_deck')
    expect(MATERIAL_TYPES).toContain('email_template')
    expect(MATERIAL_TYPES).toContain('proposal_template')
    expect(MATERIAL_TYPES).toContain('roi_calculator')
    expect(MATERIAL_TYPES).toContain('video_demo')
    expect(MATERIAL_TYPES).toContain('other')
    expect(MATERIAL_TYPES).toHaveLength(9)
  })
})

describe('MATERIAL_TYPE_LABELS', () => {
  it('has a label for every material type', () => {
    for (const type of MATERIAL_TYPES) {
      expect(MATERIAL_TYPE_LABELS[type]).toBeDefined()
      expect(typeof MATERIAL_TYPE_LABELS[type]).toBe('string')
      expect(MATERIAL_TYPE_LABELS[type].length).toBeGreaterThan(0)
    }
  })
})

describe('MATERIAL_STATUSES', () => {
  it('contains draft, published, and archived', () => {
    expect(MATERIAL_STATUSES).toEqual(['draft', 'published', 'archived'])
  })
})

describe('ALLOWED_MIME_TYPES', () => {
  it('includes PDF and common Office formats', () => {
    expect(ALLOWED_MIME_TYPES).toContain('application/pdf')
    expect(ALLOWED_MIME_TYPES).toContain('image/png')
    expect(ALLOWED_MIME_TYPES).toContain('image/jpeg')
  })
})

describe('MAX_FILE_SIZE_BYTES', () => {
  it('equals 50 MB', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(50 * 1024 * 1024)
  })
})

// ---------------------------------------------------------------------------
// createMaterialSchema
// ---------------------------------------------------------------------------

describe('createMaterialSchema', () => {
  const validInput = {
    title: 'Enterprise Battle Card',
    slug: 'enterprise-battle-card',
    material_type: 'battle_card' as const,
  }

  it('accepts valid input with only required fields', () => {
    const result = createMaterialSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Enterprise Battle Card')
      expect(result.data.slug).toBe('enterprise-battle-card')
      expect(result.data.material_type).toBe('battle_card')
      // Defaults
      expect(result.data.tags).toEqual([])
      expect(result.data.shareable).toBe(false)
      expect(result.data.status).toBe('draft')
    }
  })

  it('accepts valid input with all fields populated', () => {
    const full = {
      ...validInput,
      description: 'Competitive analysis for enterprise segment',
      category: 'Enterprise',
      tags: ['competitive', 'enterprise'],
      content: { blocks: [] },
      shareable: true,
      status: 'published' as const,
    }
    const result = createMaterialSchema.safeParse(full)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBe('Competitive analysis for enterprise segment')
      expect(result.data.category).toBe('Enterprise')
      expect(result.data.tags).toEqual(['competitive', 'enterprise'])
      expect(result.data.shareable).toBe(true)
      expect(result.data.status).toBe('published')
    }
  })

  it('rejects missing title', () => {
    const result = createMaterialSchema.safeParse({ slug: 'test', material_type: 'other' })
    expect(result.success).toBe(false)
  })

  it('rejects empty title', () => {
    const result = createMaterialSchema.safeParse({ ...validInput, title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects title exceeding max length', () => {
    const result = createMaterialSchema.safeParse({ ...validInput, title: 'a'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('rejects missing slug', () => {
    const result = createMaterialSchema.safeParse({ title: 'Test', material_type: 'other' })
    expect(result.success).toBe(false)
  })

  it('rejects empty slug', () => {
    const result = createMaterialSchema.safeParse({ ...validInput, slug: '' })
    expect(result.success).toBe(false)
  })

  it('rejects slug with uppercase letters', () => {
    const result = createMaterialSchema.safeParse({ ...validInput, slug: 'Enterprise-Card' })
    expect(result.success).toBe(false)
  })

  it('rejects slug with spaces', () => {
    const result = createMaterialSchema.safeParse({ ...validInput, slug: 'enterprise card' })
    expect(result.success).toBe(false)
  })

  it('rejects slug with consecutive hyphens', () => {
    const result = createMaterialSchema.safeParse({ ...validInput, slug: 'enterprise--card' })
    expect(result.success).toBe(false)
  })

  it('rejects slug with leading hyphen', () => {
    const result = createMaterialSchema.safeParse({ ...validInput, slug: '-enterprise-card' })
    expect(result.success).toBe(false)
  })

  it('rejects slug with trailing hyphen', () => {
    const result = createMaterialSchema.safeParse({ ...validInput, slug: 'enterprise-card-' })
    expect(result.success).toBe(false)
  })

  it('accepts slug with numbers', () => {
    const result = createMaterialSchema.safeParse({ ...validInput, slug: 'card-v2' })
    expect(result.success).toBe(true)
  })

  it('accepts single-segment slug', () => {
    const result = createMaterialSchema.safeParse({ ...validInput, slug: 'enterprise' })
    expect(result.success).toBe(true)
  })

  it('rejects missing material_type', () => {
    const result = createMaterialSchema.safeParse({ title: 'Test', slug: 'test' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid material_type', () => {
    const result = createMaterialSchema.safeParse({ ...validInput, material_type: 'brochure' })
    expect(result.success).toBe(false)
  })

  it('accepts every valid material type', () => {
    for (const type of MATERIAL_TYPES) {
      const result = createMaterialSchema.safeParse({ ...validInput, material_type: type })
      expect(result.success).toBe(true)
    }
  })

  it('rejects description exceeding 2000 characters', () => {
    const result = createMaterialSchema.safeParse({ ...validInput, description: 'x'.repeat(2001) })
    expect(result.success).toBe(false)
  })

  it('accepts null description', () => {
    const result = createMaterialSchema.safeParse({ ...validInput, description: null })
    expect(result.success).toBe(true)
  })

  it('rejects category exceeding 100 characters', () => {
    const result = createMaterialSchema.safeParse({ ...validInput, category: 'c'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('rejects more than 20 tags', () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`)
    const result = createMaterialSchema.safeParse({ ...validInput, tags })
    expect(result.success).toBe(false)
  })

  it('rejects individual tag exceeding 50 characters', () => {
    const result = createMaterialSchema.safeParse({ ...validInput, tags: ['t'.repeat(51)] })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status value', () => {
    const result = createMaterialSchema.safeParse({ ...validInput, status: 'archived' })
    expect(result.success).toBe(false)
  })

  it('accepts draft and published as valid status values', () => {
    for (const status of ['draft', 'published'] as const) {
      const result = createMaterialSchema.safeParse({ ...validInput, status })
      expect(result.success).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// updateMaterialSchema
// ---------------------------------------------------------------------------

describe('updateMaterialSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    const result = updateMaterialSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts a partial update with only title', () => {
    const result = updateMaterialSchema.safeParse({ title: 'Updated Title' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Updated Title')
      expect(result.data.slug).toBeUndefined()
    }
  })

  it('accepts a partial update with only status', () => {
    const result = updateMaterialSchema.safeParse({ status: 'published' })
    expect(result.success).toBe(true)
  })

  it('still validates field constraints on partial update', () => {
    const result = updateMaterialSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('still validates slug format on partial update', () => {
    const result = updateMaterialSchema.safeParse({ slug: 'INVALID SLUG' })
    expect(result.success).toBe(false)
  })

  it('still validates material_type enum on partial update', () => {
    const result = updateMaterialSchema.safeParse({ material_type: 'invalid' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// listMaterialsSchema
// ---------------------------------------------------------------------------

describe('listMaterialsSchema', () => {
  it('accepts empty object and applies defaults', () => {
    const result = listMaterialsSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    }
  })

  it('coerces string page and limit to numbers', () => {
    const result = listMaterialsSchema.safeParse({ page: '3', limit: '10' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.limit).toBe(10)
    }
  })

  it('rejects page less than 1', () => {
    const result = listMaterialsSchema.safeParse({ page: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects limit greater than 50', () => {
    const result = listMaterialsSchema.safeParse({ limit: 51 })
    expect(result.success).toBe(false)
  })

  it('rejects search query exceeding 200 characters', () => {
    const result = listMaterialsSchema.safeParse({ q: 'a'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('accepts a valid material type filter', () => {
    const result = listMaterialsSchema.safeParse({ type: 'battle_card' })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid material type filter', () => {
    const result = listMaterialsSchema.safeParse({ type: 'nonexistent' })
    expect(result.success).toBe(false)
  })
})
