import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CompanyForm } from '@/components/admin/crm/CompanyForm'

export default async function NewCompanyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'sales'].includes(profile.role)) {
    redirect('/training')
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground">New Company</h1>
      <p className="mt-1 text-sm text-foreground-muted mb-8">
        Add a new company to the CRM.
      </p>
      <CompanyForm />
    </div>
  )
}
