import { describe, it, expect } from 'vitest'
import {
  buildEnrichmentPrompt,
  buildNLParsePrompt,
  buildNextActionPrompt,
  buildDealScorePrompt,
  buildWeeklyDigestPrompt,
} from '@/lib/crm/ai-prompts'

describe('buildEnrichmentPrompt', () => {
  it('includes company name', () => {
    const prompt = buildEnrichmentPrompt('Acme Corp')
    expect(prompt).toContain('Acme Corp')
    expect(prompt).toContain('not provided')
  })

  it('includes URL when provided', () => {
    const prompt = buildEnrichmentPrompt('Acme Corp', 'https://acme.com')
    expect(prompt).toContain('https://acme.com')
    // The URL line should show the actual URL, not "not provided"
    expect(prompt).toContain('URL: https://acme.com')
  })

  it('requests JSON output', () => {
    const prompt = buildEnrichmentPrompt('Test')
    expect(prompt).toContain('JSON')
    expect(prompt).toContain('industry')
    expect(prompt).toContain('company_size')
    expect(prompt).toContain('description')
  })

  it('includes valid company_size options', () => {
    const prompt = buildEnrichmentPrompt('Test')
    expect(prompt).toContain('1-10')
    expect(prompt).toContain('1000+')
  })
})

describe('buildNLParsePrompt', () => {
  it('includes user input text', () => {
    const prompt = buildNLParsePrompt('Had a call with Acme')
    expect(prompt).toContain('Had a call with Acme')
  })

  it('lists all valid stages', () => {
    const prompt = buildNLParsePrompt('test')
    expect(prompt).toContain('lead')
    expect(prompt).toContain('closed_won')
    expect(prompt).toContain('closed_lost')
  })

  it('describes all action types', () => {
    const prompt = buildNLParsePrompt('test')
    expect(prompt).toContain('create_activity')
    expect(prompt).toContain('update_stage')
    expect(prompt).toContain('create_task')
    expect(prompt).toContain('create_company')
    expect(prompt).toContain('create_contact')
  })

  it('requests JSON array output', () => {
    const prompt = buildNLParsePrompt('test')
    expect(prompt).toContain('JSON array')
  })
})

describe('buildNextActionPrompt', () => {
  it('includes activity context', () => {
    const prompt = buildNextActionPrompt({
      activityType: 'call',
      subject: 'Discovery call',
      companyName: 'Acme',
      stage: 'lead',
    })
    expect(prompt).toContain('call')
    expect(prompt).toContain('Discovery call')
    expect(prompt).toContain('Acme')
    expect(prompt).toContain('lead')
  })

  it('handles missing stage', () => {
    const prompt = buildNextActionPrompt({
      activityType: 'note',
      subject: 'Internal note',
      companyName: 'Beta',
    })
    expect(prompt).toContain('No active deal')
  })

  it('includes value when provided', () => {
    const prompt = buildNextActionPrompt({
      activityType: 'meeting',
      subject: 'Demo',
      companyName: 'Acme',
      value: 50000,
    })
    expect(prompt).toContain('$50000')
  })

  it('includes description when provided', () => {
    const prompt = buildNextActionPrompt({
      activityType: 'call',
      subject: 'Follow-up',
      description: 'Discussed pricing',
      companyName: 'Acme',
    })
    expect(prompt).toContain('Discussed pricing')
  })
})

describe('buildDealScorePrompt', () => {
  it('includes all deal context', () => {
    const prompt = buildDealScorePrompt({
      companyName: 'Acme',
      title: 'Enterprise Plan',
      stage: 'proposal',
      value: 100000,
      daysInStage: 5,
      activityCount: 12,
      daysSinceLastActivity: 2,
    })
    expect(prompt).toContain('Acme')
    expect(prompt).toContain('Enterprise Plan')
    expect(prompt).toContain('proposal')
    expect(prompt).toContain('$100000')
    expect(prompt).toContain('5')
    expect(prompt).toContain('12')
    expect(prompt).toContain('2')
  })

  it('handles null daysSinceLastActivity', () => {
    const prompt = buildDealScorePrompt({
      companyName: 'Acme',
      title: 'Deal',
      stage: 'lead',
      daysInStage: 10,
      activityCount: 0,
      daysSinceLastActivity: null,
    })
    expect(prompt).toContain('No activities')
  })

  it('requests JSON with score and reasoning', () => {
    const prompt = buildDealScorePrompt({
      companyName: 'Test',
      title: 'Deal',
      stage: 'lead',
      daysInStage: 1,
      activityCount: 0,
      daysSinceLastActivity: null,
    })
    expect(prompt).toContain('"score"')
    expect(prompt).toContain('"reasoning"')
  })
})

describe('buildWeeklyDigestPrompt', () => {
  it('includes pipeline metrics', () => {
    const prompt = buildWeeklyDigestPrompt({
      totalPipeline: 500000,
      weightedPipeline: 200000,
      dealCount: 15,
      wonThisWeek: 2,
      wonValueThisWeek: 75000,
      lostThisWeek: 1,
      stageBreakdown: { lead: { count: 5, value: 100000 } },
      staleDeals: [],
      upcomingCloses: [],
    })
    expect(prompt).toContain('500,000')
    expect(prompt).toContain('200,000')
    expect(prompt).toContain('15')
    expect(prompt).toContain('2')
  })

  it('lists stale deals', () => {
    const prompt = buildWeeklyDigestPrompt({
      totalPipeline: 0,
      weightedPipeline: 0,
      dealCount: 0,
      wonThisWeek: 0,
      wonValueThisWeek: 0,
      lostThisWeek: 0,
      stageBreakdown: {},
      staleDeals: [{ title: 'Big Deal', company: 'Acme', daysSinceActivity: 21 }],
      upcomingCloses: [],
    })
    expect(prompt).toContain('Big Deal')
    expect(prompt).toContain('Acme')
    expect(prompt).toContain('21 days')
  })

  it('lists upcoming closes', () => {
    const prompt = buildWeeklyDigestPrompt({
      totalPipeline: 0,
      weightedPipeline: 0,
      dealCount: 0,
      wonThisWeek: 0,
      wonValueThisWeek: 0,
      lostThisWeek: 0,
      stageBreakdown: {},
      staleDeals: [],
      upcomingCloses: [{ title: 'Hot Deal', company: 'Beta', closeDate: '2026-04-10' }],
    })
    expect(prompt).toContain('Hot Deal')
    expect(prompt).toContain('2026-04-10')
  })

  it('shows None when no stale deals', () => {
    const prompt = buildWeeklyDigestPrompt({
      totalPipeline: 0,
      weightedPipeline: 0,
      dealCount: 0,
      wonThisWeek: 0,
      wonValueThisWeek: 0,
      lostThisWeek: 0,
      stageBreakdown: {},
      staleDeals: [],
      upcomingCloses: [],
    })
    expect(prompt).toContain('None')
  })
})
