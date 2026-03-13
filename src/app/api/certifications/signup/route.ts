import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { rateLimiters, checkRateLimit } from '@/lib/security/rate-limiter'

const signupBodySchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(200, 'Full name must be 200 characters or fewer'),
  email: z.string().email('A valid email address is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100, 'Password must be 100 characters or fewer'),
})

/**
 * POST /api/certifications/signup
 *
 * Creates a public certification account. Anyone can sign up to attempt
 * AAVA certification tracks. The new user receives role = 'public' in
 * the profiles table, which grants access to public certification content
 * but not to internal training or sales zones.
 *
 * Flow:
 * 1. Validate input (fullName, email, password)
 * 2. Create auth user via Supabase Auth signUp
 * 3. Insert a profiles row with role = 'public' using the service client
 *    (service role needed because RLS may restrict public inserts)
 * 4. Return the created user summary
 *
 * @returns {{ user: { id, email, fullName }, message }} with status 201
 */
export async function POST(request: NextRequest) {
  // --- Rate limiting: 10 attempts per IP per 15 minutes ---
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown'
  const rateLimitResponse = await checkRateLimit(rateLimiters.authSignup, ip)
  if (rateLimitResponse) return rateLimitResponse

  // --- Input validation ---
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = signupBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { fullName, email, password } = parsed.data

  // --- Create auth user ---
  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })

  if (authError) {
    if (authError.message.includes('User already registered')) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create account', details: authError.message },
      { status: 500 }
    )
  }

  if (!authData.user) {
    return NextResponse.json(
      { error: 'Account creation did not return a user' },
      { status: 500 }
    )
  }

  // --- Create profile with service client (bypasses RLS) ---
  // Service role is required here because RLS policies on the profiles
  // table do not allow unauthenticated inserts. The auth user was just
  // created but no session cookie exists yet for this request.
  const serviceClient = createServiceClient()

  const { error: profileError } = await serviceClient
    .from('profiles')
    .insert({
      id: authData.user.id,
      full_name: fullName,
      email,
      role: 'public',
    })

  if (profileError) {
    // If profile creation fails, the auth user exists but has no profile.
    // Log the error so it can be investigated and manually resolved.
    console.error(
      `[certifications/signup] Profile insert failed for auth user ${authData.user.id}:`,
      profileError.message
    )

    return NextResponse.json(
      { error: 'Account created but profile setup failed. Please contact support.' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      user: {
        id: authData.user.id,
        email,
        fullName,
      },
      message: 'Account created successfully',
    },
    { status: 201 }
  )
}
