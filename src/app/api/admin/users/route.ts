import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(1, 'Full name is required'),
  role: z.enum(['admin', 'sales', 'employee']),
})

/**
 * POST /api/admin/users
 *
 * Create a new user via Supabase Auth admin API + profiles table.
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { email, full_name, role } = parsed.data
  const serviceClient = createServiceClient()

  // Create auth user with a generated temp password
  const tempPassword = crypto.randomUUID() + '-Tp1!'
  const { data: authUser, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name },
  })

  if (createError) {
    // Supabase returns a message like "A user with this email address has already been registered"
    return NextResponse.json({ error: createError.message }, { status: 422 })
  }

  // Upsert the profile record
  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .upsert({
      id: authUser.user.id,
      email,
      full_name,
      role,
    })
    .select('id, email, full_name, role, created_at')
    .single()

  if (profileError) {
    return NextResponse.json({ error: 'User created but profile save failed' }, { status: 500 })
  }

  return NextResponse.json({ user: profile }, { status: 201 })
}

/**
 * GET /api/admin/users
 *
 * Returns all users with course enrollment/completion aggregates for the admin
 * tracking dashboard. Includes: courses enrolled, courses passed, avg score,
 * last activity timestamp.
 */
export async function GET() {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  // Fetch all profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (profilesError || !profiles) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  if (profiles.length === 0) {
    return NextResponse.json({ users: [] })
  }

  const userIds = profiles.map((p) => p.id)

  // Fetch all enrollments for these users
  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select('user_id, status, final_score, enrolled_at, completed_at')
    .in('user_id', userIds)

  // Build aggregates per user
  const userEnrollments = new Map<string, typeof enrollments>()
  for (const e of enrollments ?? []) {
    const existing = userEnrollments.get(e.user_id) ?? []
    existing.push(e)
    userEnrollments.set(e.user_id, existing)
  }

  const users = profiles.map((profile) => {
    const userE = userEnrollments.get(profile.id) ?? []
    const coursesEnrolled = userE.length
    const coursesPassed = userE.filter((e) => e.status === 'passed').length
    const scoresWithValues = userE
      .filter((e) => e.final_score !== null)
      .map((e) => e.final_score as number)
    const avgScore = scoresWithValues.length > 0
      ? Math.round(scoresWithValues.reduce((sum, s) => sum + s, 0) / scoresWithValues.length)
      : null

    // Last active = most recent enrollment or completion date
    const dates = userE.flatMap((e) => [e.enrolled_at, e.completed_at].filter(Boolean)) as string[]
    const lastActive = dates.length > 0
      ? dates.sort().reverse()[0]
      : profile.updated_at

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
      coursesEnrolled,
      coursesPassed,
      avgScore,
      lastActive,
    }
  })

  return NextResponse.json({ users })
}
