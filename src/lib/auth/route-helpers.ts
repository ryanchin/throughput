/** Routes that don't require authentication */
export const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/docs',
  '/verify',
  '/api/badges',
  '/test-editor',
  '/test-admin-status',
  '/test-course-cms',
  '/test-quiz-builder',
  '/test-ai-generator',
  '/test-video',
  '/test-training-catalog',
  '/test-lesson-nav',
  '/test-quiz-player',
  '/test-course-scorecard',
  '/test-admin-users',
  '/test-certifications',
  '/test-cert-signup',
  '/test-cert-exam',
  '/test-cert-exam-maxed',
  '/test-certificate',
  '/test-verify-valid',
  '/test-verify-revoked',
  '/test-admin-dashboard',
  '/test-knowledge',
  '/test-knowledge-page',
  '/test-admin-knowledge',
  '/test-knowledge-search',
  '/test-landing',
  '/test-sales-browse',
  '/test-admin-sales-materials',
]

/** Route zone -> required roles */
export const ZONE_ROLES: Record<string, string[]> = {
  '/training': ['employee', 'sales', 'admin'],
  '/sales': ['sales', 'admin'],
  '/admin': ['admin'],
  '/knowledge': ['employee', 'sales', 'admin'],
}

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))
}

export function getRequiredRoles(pathname: string): string[] | null {
  for (const [zone, roles] of Object.entries(ZONE_ROLES)) {
    if (pathname === zone || pathname.startsWith(zone + '/')) {
      return roles
    }
  }
  if (pathname.startsWith('/certifications')) {
    return ['employee', 'sales', 'admin', 'public']
  }
  return null
}
