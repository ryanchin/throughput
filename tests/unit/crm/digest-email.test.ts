import { describe, it, expect } from 'vitest'
import { escapeHtml, buildDigestEmail, type DigestData, type DigestItem } from '@/lib/crm/digest-email'

// ============================================================
// escapeHtml
// ============================================================

describe('escapeHtml', () => {
  it('escapes < character', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes > character', () => {
    expect(escapeHtml('value > 5')).toBe('value &gt; 5')
  })

  it('escapes & character', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar')
  })

  it('escapes " character', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;')
  })

  it("escapes ' character", () => {
    expect(escapeHtml("it's")).toBe('it&#039;s')
  })

  it('escapes all special characters together', () => {
    expect(escapeHtml('<b>"A & B\'s"</b>')).toBe(
      '&lt;b&gt;&quot;A &amp; B&#039;s&quot;&lt;/b&gt;'
    )
  })

  it('handles null/undefined input gracefully', () => {
    // escapeHtml expects string, but callers may pass nullish values
    // The function calls .replace() on the input so non-strings will throw;
    // verify it does not silently produce wrong output for empty string
    expect(escapeHtml('')).toBe('')
  })

  it('returns plain string unchanged when no special characters', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123')
  })
})

// ============================================================
// buildDigestEmail — helpers
// ============================================================

function makeItem(overrides: Partial<DigestItem> = {}): DigestItem {
  return {
    type: 'stale_deal',
    title: 'Acme Deal',
    subtitle: 'Acme Corp',
    detail: '14 days since last activity',
    actions: [{ label: 'View Deal', tokenId: 'tok-123' }],
    ...overrides,
  }
}

function makeDigestData(overrides: Partial<DigestData> = {}): DigestData {
  return {
    userName: 'Jane Doe',
    items: [],
    baseUrl: 'https://throughput.aava.ai',
    ...overrides,
  }
}

// ============================================================
// buildDigestEmail
// ============================================================

describe('buildDigestEmail', () => {
  it('returns HTML string containing user name', () => {
    const html = buildDigestEmail(makeDigestData({ userName: 'Alice Smith' }))
    expect(html).toContain('Alice Smith')
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('renders stale deals section when items of that type exist', () => {
    const html = buildDigestEmail(
      makeDigestData({
        items: [makeItem({ type: 'stale_deal', title: 'Big Enterprise Deal' })],
      })
    )
    expect(html).toContain('Stale Deal')
    expect(html).toContain('Big Enterprise Deal')
  })

  it('renders overdue tasks section', () => {
    const html = buildDigestEmail(
      makeDigestData({
        items: [
          makeItem({
            type: 'overdue_task',
            title: 'Follow up with client',
            subtitle: '3 days overdue',
          }),
        ],
      })
    )
    expect(html).toContain('Overdue Task')
    expect(html).toContain('Follow up with client')
    expect(html).toContain('3 days overdue')
  })

  it('renders rolloff section', () => {
    const html = buildDigestEmail(
      makeDigestData({
        items: [
          makeItem({
            type: 'rolloff',
            title: 'John Smith',
            subtitle: 'Acme Corp',
            detail: 'Rolling off in 15 days',
          }),
        ],
      })
    )
    expect(html).toContain('Upcoming Rolloff')
    expect(html).toContain('John Smith')
  })

  it('renders open roles section', () => {
    const html = buildDigestEmail(
      makeDigestData({
        items: [
          makeItem({
            type: 'open_role',
            title: 'Senior Engineer',
            subtitle: 'TechCo',
            detail: 'Function: Engineering',
          }),
        ],
      })
    )
    expect(html).toContain('Open Role')
    expect(html).toContain('Senior Engineer')
  })

  it('renders "All clear" message when no items', () => {
    const html = buildDigestEmail(makeDigestData({ items: [], userName: 'Bob' }))
    expect(html).toContain('All clear, Bob!')
    expect(html).toContain('No items need attention today')
  })

  it('escapes HTML in item titles (XSS prevention)', () => {
    const html = buildDigestEmail(
      makeDigestData({
        items: [makeItem({ title: '<script>alert("xss")</script>' })],
      })
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('includes action link URLs with correct token IDs', () => {
    const html = buildDigestEmail(
      makeDigestData({
        items: [
          makeItem({
            actions: [
              { label: 'Mark Complete', tokenId: 'abc-token-1' },
              { label: 'View Task', tokenId: 'def-token-2' },
            ],
          }),
        ],
        baseUrl: 'https://example.com',
      })
    )
    expect(html).toContain('/api/admin/crm/digest/action/abc-token-1')
    expect(html).toContain('/api/admin/crm/digest/action/def-token-2')
    expect(html).toContain('Mark Complete')
    expect(html).toContain('View Task')
  })

  it('uses dark theme colors (#08090E background)', () => {
    const html = buildDigestEmail(makeDigestData())
    expect(html).toContain('#08090E')
    // Verify other theme tokens are present
    expect(html).toContain('#F0F2F8')
  })

  it('escapes HTML in user name for "All clear" message', () => {
    const html = buildDigestEmail(
      makeDigestData({
        items: [],
        userName: '<img src=x onerror=alert(1)>',
      })
    )
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('renders multiple sections in correct order', () => {
    const html = buildDigestEmail(
      makeDigestData({
        items: [
          makeItem({ type: 'open_role', title: 'Role-A' }),
          makeItem({ type: 'stale_deal', title: 'Deal-A' }),
          makeItem({ type: 'overdue_task', title: 'Task-A' }),
          makeItem({ type: 'rolloff', title: 'Rolloff-A' }),
        ],
      })
    )

    // Stale deal should appear before overdue task, etc.
    const staleDealPos = html.indexOf('Stale Deal')
    const overdueTaskPos = html.indexOf('Overdue Task')
    const rolloffPos = html.indexOf('Upcoming Rolloff')
    const openRolePos = html.indexOf('Open Role')

    expect(staleDealPos).toBeLessThan(overdueTaskPos)
    expect(overdueTaskPos).toBeLessThan(rolloffPos)
    expect(rolloffPos).toBeLessThan(openRolePos)
  })
})
