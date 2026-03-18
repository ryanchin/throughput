import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MaterialForm } from '@/components/admin/sales-materials/MaterialForm'

export default async function NewSalesMaterialPage() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/training')

  // Fetch existing categories for autocomplete
  const { data: materials } = await supabase
    .from('sales_materials')
    .select('category')
    .not('category', 'is', null)

  const categories = [...new Set((materials ?? []).map((m) => m.category).filter(Boolean))] as string[]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">New Material</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Create a new sales enablement resource.
        </p>
      </div>
      <MaterialForm categories={categories} />
    </div>
  )
}
