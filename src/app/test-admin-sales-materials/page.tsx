'use client'

import { useState } from 'react'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { MATERIAL_TYPE_LABELS, type MaterialType } from '@/lib/sales/validation'
import { MaterialForm } from '@/components/admin/sales-materials/MaterialForm'
import type { ContentStatus } from '@/lib/admin/content-validation'

/**
 * Test page for admin sales materials E2E tests.
 * Renders the admin materials list and new material form with mock data,
 * bypassing auth and DB calls.
 */

interface MockMaterial {
  id: string
  title: string
  slug: string
  material_type: string
  category: string | null
  status: string
  shareable: boolean
  file_name: string | null
  updated_at: string
}

const mockMaterials: MockMaterial[] = [
  {
    id: 'mat-1',
    title: 'Enterprise Battle Card',
    slug: 'enterprise-battle-card',
    material_type: 'battle_card',
    category: 'Enterprise',
    status: 'published',
    shareable: true,
    file_name: 'enterprise-battle-card.pdf',
    updated_at: '2026-03-15T10:00:00Z',
  },
  {
    id: 'mat-2',
    title: 'Healthcare Case Study',
    slug: 'healthcare-case-study',
    material_type: 'case_study',
    category: 'Healthcare',
    status: 'draft',
    shareable: false,
    file_name: 'healthcare-case-study.pdf',
    updated_at: '2026-03-12T14:00:00Z',
  },
  {
    id: 'mat-3',
    title: 'Product Overview Deck',
    slug: 'product-overview-deck',
    material_type: 'slide_deck',
    category: null,
    status: 'published',
    shareable: true,
    file_name: null,
    updated_at: '2026-03-10T09:00:00Z',
  },
]

type View = 'list' | 'new' | 'empty'

export default function TestAdminSalesMaterialsPage() {
  const [view, setView] = useState<View>('list')

  return (
    <div className="mx-auto max-w-6xl px-4 py-8" data-testid="test-admin-sales-materials">
      {/* View switcher for E2E test navigation */}
      <div className="mb-4 flex gap-2" data-testid="view-switcher">
        <button
          onClick={() => setView('list')}
          data-testid="view-list"
          className="rounded border border-border px-3 py-1 text-xs text-foreground-muted hover:bg-raised"
        >
          List
        </button>
        <button
          onClick={() => setView('new')}
          data-testid="view-new"
          className="rounded border border-border px-3 py-1 text-xs text-foreground-muted hover:bg-raised"
        >
          New Material
        </button>
        <button
          onClick={() => setView('empty')}
          data-testid="view-empty"
          className="rounded border border-border px-3 py-1 text-xs text-foreground-muted hover:bg-raised"
        >
          Empty State
        </button>
      </div>

      {view === 'list' && <MaterialsList materials={mockMaterials} />}
      {view === 'new' && <NewMaterialView />}
      {view === 'empty' && <MaterialsList materials={[]} />}
    </div>
  )
}

function MaterialsList({ materials }: { materials: MockMaterial[] }) {
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
        <a
          href="/admin/sales-materials/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
          data-testid="new-material-button"
        >
          New Material
        </a>
      </div>

      {/* Materials table or empty state */}
      <div className="mt-8">
        {materials.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-card" data-testid="materials-empty-state">
            <h3 className="mt-4 text-lg font-semibold text-foreground">No materials yet</h3>
            <p className="mt-1 text-sm text-foreground-muted">
              Create your first sales material to get started.
            </p>
            <div className="mt-6">
              <a
                href="/admin/sales-materials/new"
                className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
                data-testid="empty-create-button"
              >
                Create Material
              </a>
            </div>
          </div>
        ) : (
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
                {materials.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-raised" data-testid={`material-row-${m.slug}`}>
                    <td className="px-5 py-4">
                      <span className="text-sm font-medium text-foreground">{m.title}</span>
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
                      {m.category ?? '\u2014'}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={m.status as ContentStatus} />
                    </td>
                    <td className="px-5 py-4 text-center text-sm text-foreground-muted">
                      {m.shareable ? '\u2713' : '\u2014'}
                    </td>
                    <td className="px-5 py-4 text-sm text-foreground-muted">
                      {new Date(m.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/admin/sales-materials/${m.id}/edit`}
                          className="text-sm text-foreground-muted hover:text-accent transition-colors"
                          data-testid={`edit-material-${m.slug}`}
                        >
                          Edit
                        </a>
                        <button
                          className="text-sm text-foreground-muted hover:text-destructive transition-colors"
                          data-testid={`archive-material-${m.slug}`}
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function NewMaterialView() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">New Material</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Create a new sales enablement resource.
        </p>
      </div>
      <MaterialForm categories={['Enterprise', 'Healthcare', 'General']} />
    </div>
  )
}
