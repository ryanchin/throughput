import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { isPublicRoute, getRequiredRoles } from '@/lib/auth/route-helpers'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always update the session (refresh tokens)
  const { user, supabaseResponse, supabase } = await updateSession(request)

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return supabaseResponse
  }

  // API routes handled separately (auth checked in route handlers)
  if (pathname.startsWith('/api/')) {
    return supabaseResponse
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

  return supabaseResponse
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
