import { describe, it, expect } from 'vitest'
import { isPublicRoute, getRequiredRoles } from '@/lib/auth/route-helpers'

describe('isPublicRoute', () => {
  it('returns true for root path', () => {
    expect(isPublicRoute('/')).toBe(true)
  })

  it('returns true for /login', () => {
    expect(isPublicRoute('/login')).toBe(true)
  })

  it('returns true for /docs and nested paths', () => {
    expect(isPublicRoute('/docs')).toBe(true)
    expect(isPublicRoute('/docs/getting-started')).toBe(true)
  })

  it('returns true for /verify paths', () => {
    expect(isPublicRoute('/verify/abc123')).toBe(true)
  })

  it('returns true for /api/badges paths', () => {
    expect(isPublicRoute('/api/badges/hash123')).toBe(true)
  })

  it('returns false for protected routes', () => {
    expect(isPublicRoute('/training')).toBe(false)
    expect(isPublicRoute('/sales')).toBe(false)
    expect(isPublicRoute('/admin')).toBe(false)
  })

  it('returns false for /certifications', () => {
    expect(isPublicRoute('/certifications')).toBe(false)
  })

  it('returns false for /knowledge', () => {
    expect(isPublicRoute('/knowledge')).toBe(false)
  })
})

describe('getRequiredRoles', () => {
  it('returns correct roles for /training', () => {
    expect(getRequiredRoles('/training')).toEqual(['employee', 'sales', 'admin'])
    expect(getRequiredRoles('/training/course/1')).toEqual(['employee', 'sales', 'admin'])
  })

  it('returns correct roles for /sales', () => {
    expect(getRequiredRoles('/sales')).toEqual(['sales', 'admin'])
  })

  it('returns correct roles for /admin', () => {
    expect(getRequiredRoles('/admin')).toEqual(['admin'])
    expect(getRequiredRoles('/admin/courses')).toEqual(['admin'])
  })

  it('returns correct roles for /knowledge', () => {
    expect(getRequiredRoles('/knowledge')).toEqual(['employee', 'sales', 'admin'])
  })

  it('returns all roles for /certifications', () => {
    expect(getRequiredRoles('/certifications')).toEqual(['employee', 'sales', 'admin', 'public'])
  })

  it('returns null for unrecognized routes', () => {
    expect(getRequiredRoles('/unknown')).toBeNull()
  })

  it('returns null for root path', () => {
    expect(getRequiredRoles('/')).toBeNull()
  })

  it('handles nested paths correctly', () => {
    expect(getRequiredRoles('/sales/courses/123')).toEqual(['sales', 'admin'])
    expect(getRequiredRoles('/admin/users')).toEqual(['admin'])
    expect(getRequiredRoles('/certifications/track/foundations')).toEqual(['employee', 'sales', 'admin', 'public'])
  })
})
