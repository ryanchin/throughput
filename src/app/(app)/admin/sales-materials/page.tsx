import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/admin/StatusBadge'
import type { ContentStatus } from '@/lib/admin/content-validation'
import { MATERIAL_TYPE_LABELS, type MaterialType } from '@/lib/sales/validation'
import { MaterialActions } from './MaterialActions'

export default async function AdminSalesMaterialsPage() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/training')

  const { data: materials, error } = await supabase
    .from('sales_materials')
    .select('id, title, slug, material_type, category, status, shareable, file_name, updated_at')
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-foreground-muted">Failed to load materials. Please try again.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sales Materials</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Manage prospect-facing collateral and resources.
          </p>
        </div>
        <Link
          href="/admin/sales-materials/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
          data-testid="new-material-button"
        >
          New Material
        </Link>
      </div>

      {/* Materials list */}
      <div className="mt-8">
        {(materials ?? []).length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-card" data-testid="materials-empty-state">
            <h3 className="mt-4 text-lg font-semibold text-foreground">No materials yet</h3>
            <p className="mt-1 text-sm text-foreground-muted">
              Create your first sales material to get started.
            </p>
            <div className="mt-6">
              <Link
                href="/admin/sales-materials/new"
                className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
              >
                Create Material
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
                <table className="w-full" data-testid="materials-table">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Title</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Type</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Category</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Status</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-foreground-muted">Shareable</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">Updated</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-foreground-muted">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(materials ?? []).map((m) => (
                      <tr key={m.id} className="transition-colors hover:bg-raised" data-testid={`material-row-${m.slug}`}>
                        <td className="px-5 py-4">
                          <Link
                            href={`/admin/sales-materials/${m.id}/edit`}
                            className="text-sm font-medium text-foreground hover:text-accent transition-colors"
                          >
                            {m.title}
                          </Link>
                          {m.file_name && (
                            <p className="mt-0.5 text-xs text-foreground-muted">{m.file_name}</p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center rounded-full bg-secondary-muted px-2.5 py-0.5 text-xs font-medium text-secondary">
                            {MATERIAL_TYPE_LABELS[m.material_type as MaterialType] ?? m.material_type}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-foreground-muted">
                          {m.category ?? '—'}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={m.status as ContentStatus} />
                        </td>
                        <td className="px-5 py-4 text-center text-sm text-foreground-muted">
                          {m.shareable ? '✓' : '—'}
                        </td>
                        <td className="px-5 py-4 text-sm text-foreground-muted">
                          {new Date(m.updated_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <MaterialActions materialId={m.id} materialTitle={m.title} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile card list */}
            <div className="space-y-3 md:hidden">
              {(materials ?? []).map((m) => (
                <div key={m.id} className="rounded-xl border border-border bg-surface p-4 shadow-card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Link
                        href={`/admin/sales-materials/${m.id}/edit`}
                        className="text-sm font-medium text-foreground hover:text-accent transition-colors"
                      >
                        {m.title}
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-secondary-muted px-2.5 py-0.5 text-xs font-medium text-secondary">
                          {MATERIAL_TYPE_LABELS[m.material_type as MaterialType] ?? m.material_type}
                        </span>
                        <StatusBadge status={m.status as ContentStatus} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-foreground-muted">
                    {m.category && <span>{m.category}</span>}
                    <span>Updated {new Date(m.updated_at).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-3 border-t border-border pt-3">
                    <MaterialActions materialId={m.id} materialTitle={m.title} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
