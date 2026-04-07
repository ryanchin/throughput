import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getProfile } from '@/lib/auth/getProfile'
import { CsvImportWizard } from '@/components/admin/crm/CsvImportWizard'

export default async function CrmImportPage() {
  const profile = await getProfile()

  if (!profile || !['admin', 'sales'].includes(profile.role)) {
    redirect('/training')
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-foreground-muted">
        <Link href="/admin/crm" className="hover:text-accent transition-colors">
          CRM
        </Link>
        <span>/</span>
        <span className="text-foreground">Import</span>
      </nav>

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Import Companies</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Bulk import company data from a CSV file.
        </p>
      </div>

      {/* Instructions */}
      <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-card">
        <h2 className="text-lg font-semibold text-foreground mb-3">How it works</h2>
        <ol className="space-y-2 text-sm text-foreground-muted list-decimal list-inside">
          <li>Prepare a CSV file with your company data (name, website, industry, status, etc.)</li>
          <li>Upload the file and preview the first few rows to confirm the format</li>
          <li>Click "Import" to create company records in the CRM</li>
          <li>Duplicate companies (matching by name) will be skipped automatically</li>
        </ol>

        <div className="mt-4 rounded-lg bg-muted p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-2">
            Required Columns
          </h3>
          <p className="text-sm text-foreground-muted">
            <code className="rounded bg-raised px-1.5 py-0.5 text-xs text-foreground">name</code>{' '}
            (required)
          </p>
          <h3 className="mt-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-2">
            Optional Columns
          </h3>
          <p className="text-sm text-foreground-muted">
            <code className="rounded bg-raised px-1.5 py-0.5 text-xs text-foreground">website</code>,{' '}
            <code className="rounded bg-raised px-1.5 py-0.5 text-xs text-foreground">industry</code>,{' '}
            <code className="rounded bg-raised px-1.5 py-0.5 text-xs text-foreground">company_size</code>,{' '}
            <code className="rounded bg-raised px-1.5 py-0.5 text-xs text-foreground">status</code>,{' '}
            <code className="rounded bg-raised px-1.5 py-0.5 text-xs text-foreground">notes</code>,{' '}
            <code className="rounded bg-raised px-1.5 py-0.5 text-xs text-foreground">tags</code>
          </p>
        </div>
      </div>

      <CsvImportWizard />
    </div>
  )
}
