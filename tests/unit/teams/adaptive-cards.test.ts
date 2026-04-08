import { describe, it, expect } from 'vitest'
import {
  buildConfirmationCard,
  buildSuccessCard,
  buildErrorCard,
  buildWelcomeCard,
  type ParsedAction,
} from '@/lib/teams/adaptive-cards'

// ============================================================
// Helpers
// ============================================================

function makeAction(overrides: Partial<ParsedAction> = {}): ParsedAction {
  return {
    action: 'create_activity',
    subject: 'Demo call',
    company_name: 'Acme Corp',
    type: 'call',
    ...overrides,
  }
}

// ============================================================
// buildConfirmationCard
// ============================================================

describe('buildConfirmationCard', () => {
  it('returns valid Adaptive Card with correct schema version (1.4)', () => {
    const card = buildConfirmationCard([makeAction()], 'Log a call with Acme') as Record<string, unknown>
    expect(card.type).toBe('AdaptiveCard')
    expect(card.version).toBe('1.4')
    expect(card.$schema).toBe('http://adaptivecards.io/schemas/adaptive-card.json')
  })

  it('includes original text in the card body', () => {
    const originalText = 'Had a meeting with Premera about renewal'
    const card = buildConfirmationCard([makeAction()], originalText) as Record<string, unknown>
    const body = card.body as Array<Record<string, unknown>>
    const bodyText = JSON.stringify(body)
    expect(bodyText).toContain(originalText)
  })

  it('creates a toggle input per action', () => {
    const actions = [
      makeAction({ action: 'create_activity', subject: 'Call 1' }),
      makeAction({ action: 'update_stage', opportunity_title: 'Deal X', new_stage: 'proposal' }),
      makeAction({ action: 'create_task', subject: 'Follow up' }),
    ]
    const card = buildConfirmationCard(actions, 'multiple actions') as Record<string, unknown>
    const body = card.body as Array<Record<string, unknown>>

    const toggles = body.filter((item) => item.type === 'Input.Toggle')
    expect(toggles).toHaveLength(3)

    // Each toggle should have a unique id
    const ids = toggles.map((t) => t.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids).toContain('action_0')
    expect(ids).toContain('action_1')
    expect(ids).toContain('action_2')
  })

  it('includes Apply and Cancel action buttons', () => {
    const card = buildConfirmationCard([makeAction()], 'test') as Record<string, unknown>
    const cardActions = card.actions as Array<Record<string, unknown>>

    expect(cardActions).toHaveLength(2)

    const applyAction = cardActions.find((a) => a.title === 'Apply Selected')
    const cancelAction = cardActions.find((a) => a.title === 'Cancel')

    expect(applyAction).toBeDefined()
    expect(cancelAction).toBeDefined()
    expect(applyAction!.type).toBe('Action.Submit')
    expect(cancelAction!.type).toBe('Action.Submit')

    // Apply sends type='confirm', Cancel sends type='cancel'
    const applyData = applyAction!.data as Record<string, unknown>
    const cancelData = cancelAction!.data as Record<string, unknown>
    expect(applyData.type).toBe('confirm')
    expect(cancelData.type).toBe('cancel')
  })

  it('handles empty actions array', () => {
    const card = buildConfirmationCard([], 'nothing parsed') as Record<string, unknown>
    const body = card.body as Array<Record<string, unknown>>

    // Should still be a valid Adaptive Card
    expect(card.type).toBe('AdaptiveCard')
    expect(card.version).toBe('1.4')

    // No toggle inputs
    const toggles = body.filter((item) => item.type === 'Input.Toggle')
    expect(toggles).toHaveLength(0)

    // Body should mention "0 actions"
    const bodyText = JSON.stringify(body)
    expect(bodyText).toContain('0 actions')
  })
})

// ============================================================
// buildSuccessCard
// ============================================================

describe('buildSuccessCard', () => {
  it('includes applied action descriptions', () => {
    const appliedActions = [
      'Logged call: "Demo call" for Acme Corp',
      'Moved "Big Deal" to proposal stage',
    ]
    const card = buildSuccessCard(appliedActions) as Record<string, unknown>
    const body = card.body as Array<Record<string, unknown>>
    const bodyText = JSON.stringify(body)

    expect(bodyText).toContain('Demo call')
    expect(bodyText).toContain('Big Deal')
    expect(bodyText).toContain('Updates Applied')
  })

  it('handles empty array', () => {
    const card = buildSuccessCard([]) as Record<string, unknown>

    expect(card.type).toBe('AdaptiveCard')
    expect(card.version).toBe('1.4')

    const body = card.body as Array<Record<string, unknown>>
    expect(body).toBeDefined()
    expect(Array.isArray(body)).toBe(true)
  })
})

// ============================================================
// buildErrorCard
// ============================================================

describe('buildErrorCard', () => {
  it('includes the error message text', () => {
    const errorMsg = 'Failed to connect to CRM database'
    const card = buildErrorCard(errorMsg) as Record<string, unknown>
    const body = card.body as Array<Record<string, unknown>>
    const bodyText = JSON.stringify(body)

    expect(bodyText).toContain(errorMsg)
    expect(bodyText).toContain('Something went wrong')
    expect(card.type).toBe('AdaptiveCard')
    expect(card.version).toBe('1.4')
  })
})

// ============================================================
// buildWelcomeCard
// ============================================================

describe('buildWelcomeCard', () => {
  it('includes bot name and example commands', () => {
    const card = buildWelcomeCard() as Record<string, unknown>
    const body = card.body as Array<Record<string, unknown>>
    const bodyText = JSON.stringify(body)

    expect(bodyText).toContain('Throughput CRM Bot')
    expect(bodyText).toContain('Examples')
    // Verify at least one example command is present
    expect(bodyText).toContain('Acme Corp')

    expect(card.type).toBe('AdaptiveCard')
    expect(card.version).toBe('1.4')
  })
})
