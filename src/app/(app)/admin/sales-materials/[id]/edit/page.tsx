import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MaterialForm } from '@/components/admin/sales-materials/MaterialForm'

export default async function EditSalesMaterialPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/training')

  const { id } = await params

  const { data: material, error } = await supabase
    .from('sales_materials')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !material) notFound()

  // Generate signed URL if file exists
  let downloadUrl: string | null = null
  if (material.file_path) {
    const { data: signedUrl } = await supabase.storage
      .from('sales-materials')
      .createSignedUrl(material.file_path, 3600)
    downloadUrl = signedUrl?.signedUrl ?? null
  }

  // Fetch existing categories for autocomplete
  const { data: allMaterials } = await supabase
    .from('sales_materials')
    .select('category')
    .not('category', 'is', null)

  const categories = [...new Set((allMaterials ?? []).map((m) => m.category).filter(Boolean))] as string[]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Edit Material</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Update &ldquo;{material.title}&rdquo;
        </p>
      </div>
      <MaterialForm
        material={{ ...material, download_url: downloadUrl }}
        categories={categories}
      />
    </div>
  )
}
