import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface CrmAccessResult {
  profile: Profile | null
  error: { message: string; status: number } | null
  supabase: Awaited<ReturnType<typeof createClient>>
}

/**
 * Check that the current request is from a user with CRM access (admin or sales role).
 * Returns the profile and supabase client, or an error to return.
 */
export async function requireCrmAccess(): Promise<CrmAccessResult> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { profile: null, error: { message: 'Unauthorized', status: 401 }, supabase }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { profile: null, error: { message: 'Profile not found', status: 401 }, supabase }
  }

  if (!['admin', 'sales'].includes(profile.role)) {
    return { profile, error: { message: 'Forbidden: CRM access requires admin or sales role', status: 403 }, supabase }
  }

  return { profile, error: null, supabase }
}
