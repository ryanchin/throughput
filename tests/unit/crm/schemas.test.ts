import { describe, it, expect } from 'vitest'
import {
  companyCreateSchema,
  companyUpdateSchema,
  companySearchSchema,
  contactCreateSchema,
  contactUpdateSchema,
  opportunityCreateSchema,
  opportunityUpdateSchema,
  activityCreateSchema,
  activityTaskUpdateSchema,
  enrichRequestSchema,
  nlParseRequestSchema,
  suggestActionsRequestSchema,
  csvImportSchema,
} from '@/lib/crm/schemas'

// ============================================================
// Company Schemas
// ============================================================

describe('companyCreateSchema', () => {
  it('accepts a valid company with all fields', () => {
    const result = companyCreateSchema.safeParse({
      name: 'Acme Corp',
      website: 'https://acme.com',
      industry: 'Technology',
      company_size: '51-200',
      status: 'prospect',
      notes: 'Great company',
      tags: ['enterprise', 'tech'],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a company with only name (minimum required)', () => {
    const result = companyCreateSchema.safeParse({ name: 'Acme Corp' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('prospect')
      expect(result.data.tags).toEqual([])
    }
  })

  it('rejects missing name', () => {
    const result = companyCreateSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = companyCreateSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status', () => {
    const result = companyCreateSchema.safeParse({ name: 'Acme', status: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid company_size', () => {
    const result = companyCreateSchema.safeParse({ name: 'Acme', company_size: '5000+' })
    expect(result.success).toBe(false)
  })

  it('accepts all valid company_size values', () => {
    const sizes = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
    for (const size of sizes) {
      const result = companyCreateSchema.safeParse({ name: 'Acme', company_size: size })
      expect(result.success).toBe(true)
    }
  })

  it('accepts empty string for optional URL fields', () => {
    const result = companyCreateSchema.safeParse({ name: 'Acme', website: '' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid URL for website', () => {
    const result = companyCreateSchema.safeParse({ name: 'Acme', website: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('rejects more than 20 tags', () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`)
    const result = companyCreateSchema.safeParse({ name: 'Acme', tags })
    expect(result.success).toBe(false)
  })

  it('rejects tags longer than 50 characters', () => {
    const result = companyCreateSchema.safeParse({ name: 'Acme', tags: ['a'.repeat(51)] })
    expect(result.success).toBe(false)
  })

  it('rejects name longer than 255 characters', () => {
    const result = companyCreateSchema.safeParse({ name: 'a'.repeat(256) })
    expect(result.success).toBe(false)
  })
})

describe('companyUpdateSchema', () => {
  it('accepts partial updates', () => {
    const result = companyUpdateSchema.safeParse({ status: 'active' })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (no changes)', () => {
    const result = companyUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('companySearchSchema', () => {
  it('defaults limit to 50 and offset to 0', () => {
    const result = companySearchSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(50)
      expect(result.data.offset).toBe(0)
    }
  })

  it('coerces string numbers for limit/offset', () => {
    const result = companySearchSchema.safeParse({ limit: '25', offset: '10' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(25)
      expect(result.data.offset).toBe(10)
    }
  })

  it('rejects limit > 100', () => {
    const result = companySearchSchema.safeParse({ limit: 200 })
    expect(result.success).toBe(false)
  })

  it('rejects negative offset', () => {
    const result = companySearchSchema.safeParse({ offset: -1 })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// Contact Schemas
// ============================================================

describe('contactCreateSchema', () => {
  it('accepts a valid contact with all fields', () => {
    const result = contactCreateSchema.safeParse({
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1-555-0100',
      title: 'VP of Engineering',
      linkedin_url: 'https://linkedin.com/in/johndoe',
      is_primary: true,
      notes: 'Key decision maker',
    })
    expect(result.success).toBe(true)
  })

  it('accepts contact with only name', () => {
    const result = contactCreateSchema.safeParse({ name: 'John Doe' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.is_primary).toBe(false)
    }
  })

  it('rejects invalid email', () => {
    const result = contactCreateSchema.safeParse({ name: 'John', email: 'not-email' })
    expect(result.success).toBe(false)
  })

  it('accepts empty string for email', () => {
    const result = contactCreateSchema.safeParse({ name: 'John', email: '' })
    expect(result.success).toBe(true)
  })

  it('rejects non-LinkedIn URL for linkedin_url', () => {
    const result = contactCreateSchema.safeParse({
      name: 'John',
      linkedin_url: 'https://twitter.com/johndoe',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid LinkedIn URL', () => {
    const result = contactCreateSchema.safeParse({
      name: 'John',
      linkedin_url: 'https://www.linkedin.com/in/johndoe',
    })
    expect(result.success).toBe(true)
  })
})

// ============================================================
// Opportunity Schemas
// ============================================================

describe('opportunityCreateSchema', () => {
  it('accepts a valid opportunity', () => {
    const result = opportunityCreateSchema.safeParse({
      company_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Enterprise License',
      value: 50000,
      stage: 'proposal',
      probability: 60,
    })
    expect(result.success).toBe(true)
  })

  it('defaults stage to lead', () => {
    const result = opportunityCreateSchema.safeParse({
      company_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'New Deal',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.stage).toBe('lead')
    }
  })

  it('rejects invalid stage', () => {
    const result = opportunityCreateSchema.safeParse({
      company_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Deal',
      stage: 'invalid_stage',
    })
    expect(result.success).toBe(false)
  })

  it('rejects probability > 100', () => {
    const result = opportunityCreateSchema.safeParse({
      company_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Deal',
      probability: 150,
    })
    expect(result.success).toBe(false)
  })

  it('rejects probability < 0', () => {
    const result = opportunityCreateSchema.safeParse({
      company_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Deal',
      probability: -10,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative value', () => {
    const result = opportunityCreateSchema.safeParse({
      company_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Deal',
      value: -1000,
    })
    expect(result.success).toBe(false)
  })

  it('accepts null value', () => {
    const result = opportunityCreateSchema.safeParse({
      company_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Deal',
      value: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts all valid stages', () => {
    const stages = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
    for (const stage of stages) {
      const result = opportunityCreateSchema.safeParse({
        company_id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Deal',
        stage,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid company_id (not UUID)', () => {
    const result = opportunityCreateSchema.safeParse({
      company_id: 'not-a-uuid',
      title: 'Deal',
    })
    expect(result.success).toBe(false)
  })
})

describe('opportunityUpdateSchema', () => {
  it('accepts partial updates without company_id', () => {
    const result = opportunityUpdateSchema.safeParse({ stage: 'negotiation', probability: 75 })
    expect(result.success).toBe(true)
  })

  it('does not accept company_id in update', () => {
    const result = opportunityUpdateSchema.safeParse({
      company_id: '550e8400-e29b-41d4-a716-446655440000',
    })
    // company_id is omitted from update schema, so it should be stripped
    expect(result.success).toBe(true)
    if (result.success) {
      expect('company_id' in result.data).toBe(false)
    }
  })
})

// ============================================================
// Activity Schemas
// ============================================================

describe('activityCreateSchema', () => {
  it('accepts a valid activity', () => {
    const result = activityCreateSchema.safeParse({
      company_id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'call',
      subject: 'Discovery call with CEO',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid activity type', () => {
    const result = activityCreateSchema.safeParse({
      company_id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'invalid',
      subject: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid activity types', () => {
    const types = ['call', 'email', 'meeting', 'note', 'task']
    for (const type of types) {
      const result = activityCreateSchema.safeParse({
        company_id: '550e8400-e29b-41d4-a716-446655440000',
        type,
        subject: 'Test',
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects empty subject', () => {
    const result = activityCreateSchema.safeParse({
      company_id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'call',
      subject: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('activityTaskUpdateSchema', () => {
  it('accepts completed boolean', () => {
    expect(activityTaskUpdateSchema.safeParse({ completed: true }).success).toBe(true)
    expect(activityTaskUpdateSchema.safeParse({ completed: false }).success).toBe(true)
  })

  it('rejects non-boolean', () => {
    expect(activityTaskUpdateSchema.safeParse({ completed: 'yes' }).success).toBe(false)
  })
})

// ============================================================
// AI Schemas
// ============================================================

describe('enrichRequestSchema', () => {
  it('accepts name only', () => {
    const result = enrichRequestSchema.safeParse({ name: 'Acme Corp' })
    expect(result.success).toBe(true)
  })

  it('accepts name + url', () => {
    const result = enrichRequestSchema.safeParse({ name: 'Acme', url: 'https://acme.com' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = enrichRequestSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('accepts empty string for url', () => {
    const result = enrichRequestSchema.safeParse({ name: 'Acme', url: '' })
    expect(result.success).toBe(true)
  })
})

describe('nlParseRequestSchema', () => {
  it('accepts valid text', () => {
    const result = nlParseRequestSchema.safeParse({ text: 'Had a call with Acme' })
    expect(result.success).toBe(true)
  })

  it('rejects empty text', () => {
    const result = nlParseRequestSchema.safeParse({ text: '' })
    expect(result.success).toBe(false)
  })

  it('rejects text over 2000 chars', () => {
    const result = nlParseRequestSchema.safeParse({ text: 'a'.repeat(2001) })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// CSV Import Schema
// ============================================================

describe('csvImportSchema', () => {
  it('accepts valid companies array', () => {
    const result = csvImportSchema.safeParse({
      companies: [
        { name: 'Acme Corp', industry: 'Tech' },
        { name: 'Beta Inc', website: 'https://beta.com' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty companies array', () => {
    const result = csvImportSchema.safeParse({ companies: [] })
    expect(result.success).toBe(false)
  })

  it('rejects companies without name', () => {
    const result = csvImportSchema.safeParse({
      companies: [{ industry: 'Tech' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than 1000 companies', () => {
    const companies = Array.from({ length: 1001 }, (_, i) => ({ name: `Company ${i}` }))
    const result = csvImportSchema.safeParse({ companies })
    expect(result.success).toBe(false)
  })
})
