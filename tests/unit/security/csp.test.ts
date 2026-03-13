import { describe, it, expect } from 'vitest'
import { buildCSP } from '@/lib/security/csp'

describe('buildCSP', () => {
  it('returns a CSP string with frame-src directive', () => {
    const csp = buildCSP()
    expect(csp).toContain('frame-src')
  })

  it('allows YouTube embeds', () => {
    const csp = buildCSP()
    expect(csp).toContain('https://www.youtube.com')
    expect(csp).toContain('https://www.youtube-nocookie.com')
  })

  it('allows Vimeo embeds', () => {
    const csp = buildCSP()
    expect(csp).toContain('https://player.vimeo.com')
  })

  it('allows Loom embeds', () => {
    const csp = buildCSP()
    expect(csp).toContain('https://www.loom.com')
  })

  it('allows Figma embeds', () => {
    const csp = buildCSP()
    expect(csp).toContain('https://www.figma.com')
  })

  it('allows Google embeds', () => {
    const csp = buildCSP()
    expect(csp).toContain('https://docs.google.com')
    expect(csp).toContain('https://slides.google.com')
  })

  it('allows Bunny.net Stream player', () => {
    const csp = buildCSP()
    expect(csp).toContain('https://iframe.mediadelivery.net')
  })

  it('includes frame-ancestors self', () => {
    const csp = buildCSP()
    expect(csp).toContain("frame-ancestors 'self'")
  })

  it('includes default-src self', () => {
    const csp = buildCSP()
    expect(csp).toContain("default-src 'self'")
  })
})
