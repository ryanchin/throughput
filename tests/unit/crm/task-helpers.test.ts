import { describe, it, expect } from 'vitest'
import {
  taskCreateSchema,
  taskUpdateSchema,
  taskSearchSchema,
} from '@/lib/crm/schemas'

// ============================================================
// taskCreateSchema
// ============================================================

describe('taskCreateSchema', () => {
  it('accepts a valid task with all fields', () => {
    const result = taskCreateSchema.safeParse({
      subject: 'Follow up with client',
      company_id: '550e8400-e29b-41d4-a716-446655440000',
      contact_id: '550e8400-e29b-41d4-a716-446655440001',
      opportunity_id: '550e8400-e29b-41d4-a716-446655440002',
      description: 'Discuss renewal terms',
      due_date: '2026-04-15',
      priority: 1,
      status: 'In Progress',
      category: 'Follow-up',
      assignee_ids: ['550e8400-e29b-41d4-a716-446655440003'],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a task with only subject (minimum required)', () => {
    const result = taskCreateSchema.safeParse({ subject: 'Quick task' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe(2)
      expect(result.data.status).toBe('Not Started')
      expect(result.data.assignee_ids).toEqual([])
    }
  })

  it('rejects missing subject', () => {
    const result = taskCreateSchema.safeParse({})
    expect(result.success).toBe(false)
    if (!result.success) {
      const subjectIssue = result.error.issues.find(
        (i) => i.path.includes('subject')
      )
      expect(subjectIssue).toBeDefined()
    }
  })

  it('rejects empty subject', () => {
    const result = taskCreateSchema.safeParse({ subject: '' })
    expect(result.success).toBe(false)
  })

  it('rejects subject longer than 255 characters', () => {
    const result = taskCreateSchema.safeParse({ subject: 'a'.repeat(256) })
    expect(result.success).toBe(false)
  })

  it('rejects invalid priority (0)', () => {
    const result = taskCreateSchema.safeParse({ subject: 'Task', priority: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid priority (3)', () => {
    const result = taskCreateSchema.safeParse({ subject: 'Task', priority: 3 })
    expect(result.success).toBe(false)
  })

  it('accepts priority 1 (high)', () => {
    const result = taskCreateSchema.safeParse({ subject: 'Task', priority: 1 })
    expect(result.success).toBe(true)
  })

  it('accepts priority 2 (normal) — default', () => {
    const result = taskCreateSchema.safeParse({ subject: 'Task' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe(2)
    }
  })

  it('rejects invalid status', () => {
    const result = taskCreateSchema.safeParse({
      subject: 'Task',
      status: 'Cancelled',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid status values', () => {
    const statuses = ['Not Started', 'In Progress', 'Completed', 'On Hold']
    for (const status of statuses) {
      const result = taskCreateSchema.safeParse({ subject: 'Task', status })
      expect(result.success).toBe(true)
    }
  })

  it('accepts all valid category values', () => {
    const categories = ['Follow-up', 'Meeting', 'Task', 'Presentation']
    for (const category of categories) {
      const result = taskCreateSchema.safeParse({ subject: 'Task', category })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid category', () => {
    const result = taskCreateSchema.safeParse({
      subject: 'Task',
      category: 'Unknown',
    })
    expect(result.success).toBe(false)
  })

  it('accepts empty string for optional UUID fields', () => {
    const result = taskCreateSchema.safeParse({
      subject: 'Task',
      company_id: '',
      contact_id: '',
      opportunity_id: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID company_id', () => {
    const result = taskCreateSchema.safeParse({
      subject: 'Task',
      company_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('accepts empty assignee_ids array', () => {
    const result = taskCreateSchema.safeParse({
      subject: 'Task',
      assignee_ids: [],
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID values in assignee_ids', () => {
    const result = taskCreateSchema.safeParse({
      subject: 'Task',
      assignee_ids: ['not-a-uuid'],
    })
    expect(result.success).toBe(false)
  })

  it('accepts multiple valid UUIDs in assignee_ids', () => {
    const result = taskCreateSchema.safeParse({
      subject: 'Task',
      assignee_ids: [
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty string for description', () => {
    const result = taskCreateSchema.safeParse({
      subject: 'Task',
      description: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects description longer than 10000 characters', () => {
    const result = taskCreateSchema.safeParse({
      subject: 'Task',
      description: 'a'.repeat(10001),
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// taskUpdateSchema
// ============================================================

describe('taskUpdateSchema', () => {
  it('accepts partial update with just subject', () => {
    const result = taskUpdateSchema.safeParse({ subject: 'Updated subject' })
    expect(result.success).toBe(true)
  })

  it('accepts partial update with just status', () => {
    const result = taskUpdateSchema.safeParse({ status: 'Completed' })
    expect(result.success).toBe(true)
  })

  it('accepts partial update with just completed', () => {
    const result = taskUpdateSchema.safeParse({ completed: true })
    expect(result.success).toBe(true)
  })

  it('accepts partial update with just assignee_ids', () => {
    const result = taskUpdateSchema.safeParse({
      assignee_ids: ['550e8400-e29b-41d4-a716-446655440000'],
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (all fields optional)', () => {
    const result = taskUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects invalid status enum', () => {
    const result = taskUpdateSchema.safeParse({ status: 'Cancelled' })
    expect(result.success).toBe(false)
  })

  it('accepts all valid status values', () => {
    const statuses = ['Not Started', 'In Progress', 'Completed', 'On Hold']
    for (const status of statuses) {
      const result = taskUpdateSchema.safeParse({ status })
      expect(result.success).toBe(true)
    }
  })

  it('accepts nullable category', () => {
    const result = taskUpdateSchema.safeParse({ category: null })
    expect(result.success).toBe(true)
  })

  it('accepts nullable due_date', () => {
    const result = taskUpdateSchema.safeParse({ due_date: null })
    expect(result.success).toBe(true)
  })

  it('accepts empty string for due_date (cleared)', () => {
    const result = taskUpdateSchema.safeParse({ due_date: '' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid priority value', () => {
    const result = taskUpdateSchema.safeParse({ priority: 5 })
    expect(result.success).toBe(false)
  })

  it('rejects empty subject string', () => {
    const result = taskUpdateSchema.safeParse({ subject: '' })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// taskSearchSchema
// ============================================================

describe('taskSearchSchema', () => {
  it('defaults tab to "my"', () => {
    const result = taskSearchSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tab).toBe('my')
    }
  })

  it('defaults limit to 100 and offset to 0', () => {
    const result = taskSearchSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(100)
      expect(result.data.offset).toBe(0)
    }
  })

  it('accepts tab=all', () => {
    const result = taskSearchSchema.safeParse({ tab: 'all' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tab).toBe('all')
    }
  })

  it('accepts tab=overdue', () => {
    const result = taskSearchSchema.safeParse({ tab: 'overdue' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tab).toBe('overdue')
    }
  })

  it('accepts tab=my', () => {
    const result = taskSearchSchema.safeParse({ tab: 'my' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tab).toBe('my')
    }
  })

  it('rejects invalid tab value', () => {
    const result = taskSearchSchema.safeParse({ tab: 'completed' })
    expect(result.success).toBe(false)
  })

  it('coerces string numbers for limit and offset', () => {
    const result = taskSearchSchema.safeParse({ limit: '50', offset: '10' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(50)
      expect(result.data.offset).toBe(10)
    }
  })

  it('coerces string number for priority', () => {
    const result = taskSearchSchema.safeParse({ priority: '1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe(1)
    }
  })

  it('rejects limit > 200', () => {
    const result = taskSearchSchema.safeParse({ limit: 201 })
    expect(result.success).toBe(false)
  })

  it('rejects limit < 1', () => {
    const result = taskSearchSchema.safeParse({ limit: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative offset', () => {
    const result = taskSearchSchema.safeParse({ offset: -1 })
    expect(result.success).toBe(false)
  })

  it('accepts optional company_id filter as UUID', () => {
    const result = taskSearchSchema.safeParse({
      company_id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID company_id', () => {
    const result = taskSearchSchema.safeParse({ company_id: 'not-uuid' })
    expect(result.success).toBe(false)
  })

  it('accepts optional status filter as string', () => {
    const result = taskSearchSchema.safeParse({ status: 'In Progress' })
    expect(result.success).toBe(true)
  })
})
