'use client'

/**
 * Client component for CSV export buttons.
 * Triggers downloads via the admin analytics export API routes.
 */
export function ExportButtons() {
  function handleExport(endpoint: string, filename: string) {
    const link = document.createElement('a')
    link.href = endpoint
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleExport('/api/admin/analytics/export-users', 'users-export.csv')}
        className="rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-raised"
        data-testid="export-users-btn"
      >
        Export Users CSV
      </button>
      <button
        onClick={() => handleExport('/api/admin/analytics/export-completions', 'completions-export.csv')}
        className="rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-raised"
        data-testid="export-completions-btn"
      >
        Export Completions CSV
      </button>
    </div>
  )
}
