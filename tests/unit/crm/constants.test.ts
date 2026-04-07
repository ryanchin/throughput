import { describe, it, expect } from 'vitest'
import {
  STAGES,
  OPEN_STAGES,
  CLOSED_STAGES,
  STAGE_LABELS,
  STAGE_PROBABILITIES,
  COMPANY_SIZES,
  COMPANY_STATUSES,
  ACTIVITY_TYPES,
  CLOSE_REASONS_WON,
  CLOSE_REASONS_LOST,
  VELOCITY_THRESHOLDS,
  REMINDER_THRESHOLDS,
} from '@/lib/crm/constants'

describe('STAGES', () => {
  it('has 6 stages in correct order', () => {
    expect(STAGES).toEqual([
      'lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost',
    ])
  })

  it('OPEN_STAGES excludes closed stages', () => {
    expect(OPEN_STAGES).toEqual(['lead', 'qualified', 'proposal', 'negotiation'])
    for (const stage of OPEN_STAGES) {
      expect(CLOSED_STAGES).not.toContain(stage)
    }
  })

  it('CLOSED_STAGES includes only closed stages', () => {
    expect(CLOSED_STAGES).toEqual(['closed_won', 'closed_lost'])
  })

  it('OPEN_STAGES + CLOSED_STAGES = STAGES', () => {
    expect([...OPEN_STAGES, ...CLOSED_STAGES]).toEqual([...STAGES])
  })
})

describe('STAGE_LABELS', () => {
  it('has a label for every stage', () => {
    for (const stage of STAGES) {
      expect(STAGE_LABELS[stage]).toBeDefined()
      expect(typeof STAGE_LABELS[stage]).toBe('string')
      expect(STAGE_LABELS[stage].length).toBeGreaterThan(0)
    }
  })
})

describe('STAGE_PROBABILITIES', () => {
  it('has a probability for every stage', () => {
    for (const stage of STAGES) {
      expect(STAGE_PROBABILITIES[stage]).toBeDefined()
      expect(typeof STAGE_PROBABILITIES[stage]).toBe('number')
    }
  })

  it('probabilities increase with stage progression (for open stages)', () => {
    expect(STAGE_PROBABILITIES.lead).toBeLessThan(STAGE_PROBABILITIES.qualified)
    expect(STAGE_PROBABILITIES.qualified).toBeLessThan(STAGE_PROBABILITIES.proposal)
    expect(STAGE_PROBABILITIES.proposal).toBeLessThan(STAGE_PROBABILITIES.negotiation)
  })

  it('closed_won = 100, closed_lost = 0', () => {
    expect(STAGE_PROBABILITIES.closed_won).toBe(100)
    expect(STAGE_PROBABILITIES.closed_lost).toBe(0)
  })

  it('all probabilities are between 0-100', () => {
    for (const stage of STAGES) {
      expect(STAGE_PROBABILITIES[stage]).toBeGreaterThanOrEqual(0)
      expect(STAGE_PROBABILITIES[stage]).toBeLessThanOrEqual(100)
    }
  })
})

describe('COMPANY_SIZES', () => {
  it('has 6 size ranges', () => {
    expect(COMPANY_SIZES).toHaveLength(6)
  })

  it('ranges are in ascending order', () => {
    expect(COMPANY_SIZES).toEqual(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'])
  })
})

describe('COMPANY_STATUSES', () => {
  it('has 4 statuses', () => {
    expect(COMPANY_STATUSES).toEqual(['prospect', 'active', 'churned', 'partner'])
  })
})

describe('ACTIVITY_TYPES', () => {
  it('has 5 types', () => {
    expect(ACTIVITY_TYPES).toEqual(['call', 'email', 'meeting', 'note', 'task'])
  })
})

describe('CLOSE_REASONS', () => {
  it('won reasons include expected values', () => {
    expect(CLOSE_REASONS_WON).toContain('price')
    expect(CLOSE_REASONS_WON).toContain('features')
    expect(CLOSE_REASONS_WON).toContain('other')
  })

  it('lost reasons include expected values', () => {
    expect(CLOSE_REASONS_LOST).toContain('budget')
    expect(CLOSE_REASONS_LOST).toContain('competitor')
    expect(CLOSE_REASONS_LOST).toContain('no_decision')
    expect(CLOSE_REASONS_LOST).toContain('other')
  })
})

describe('VELOCITY_THRESHOLDS', () => {
  it('green < yellow', () => {
    expect(VELOCITY_THRESHOLDS.green).toBeLessThan(VELOCITY_THRESHOLDS.yellow)
  })
})

describe('REMINDER_THRESHOLDS', () => {
  it('has positive values', () => {
    expect(REMINDER_THRESHOLDS.staleDealDays).toBeGreaterThan(0)
    expect(REMINDER_THRESHOLDS.staleCompanyDays).toBeGreaterThan(0)
    expect(REMINDER_THRESHOLDS.upcomingCloseDays).toBeGreaterThan(0)
  })

  it('stale company threshold > stale deal threshold', () => {
    expect(REMINDER_THRESHOLDS.staleCompanyDays).toBeGreaterThan(REMINDER_THRESHOLDS.staleDealDays)
  })
})
