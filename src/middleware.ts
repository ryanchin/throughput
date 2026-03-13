import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { isPublicRoute, getRequiredRoles } from '@/lib/auth/route-helpers'
import { buildCSP } from '@/lib/security/csp'

/**
 * Adds security headers (CSP, X-Frame-Options, etc.) to a response.
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  const csp = buildCSP()
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes without touching Supabase
  if (isPublicRoute(pathname)) {
    return addSecurityHeaders(NextResponse.next())
  }

  // Skip auth if Supabase is not configured (local dev without env vars)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) {
    return addSecurityHeaders(NextResponse.next())
  }

  // Update the session (refresh tokens)
  const { user, supabaseResponse, supabase } = await updateSession(request)

  // API routes handled separately (auth checked in route handlers)
  if (pathname.startsWith('/api/')) {
    return addSecurityHeaders(supabaseResponse)
  }

  // Not logged in -> redirect to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Check role-based access
  const requiredRoles = getRequiredRoles(pathname)
  if (requiredRoles) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !requiredRoles.includes(profile.role)) {
      // Redirect to appropriate default page based on role
      const url = request.nextUrl.clone()
      if (profile?.role === 'public') {
        url.pathname = '/certifications'
      } else {
        url.pathname = '/training'
      }
      return NextResponse.redirect(url)
    }
  }

  return addSecurityHeaders(supabaseResponse)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
