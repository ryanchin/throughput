'use client'

import { useState, useRef } from 'react'

type ImportStep = 'upload' | 'preview' | 'importing' | 'done'

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export function CsvImportWizard() {
  const [step, setStep] = useState<ImportStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file.')
      return
    }

    setError(null)
    setFile(selectedFile)

    // Parse preview
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n').filter((l) => l.trim())
      if (lines.length === 0) {
        setError('CSV file is empty.')
        return
      }

      const parsedHeaders = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
      setHeaders(parsedHeaders)

      const rows = lines.slice(1, 6).map((line) =>
        line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''))
      )
      setPreviewRows(rows)
      setStep('preview')
    }
    reader.readAsText(selectedFile)
  }

  async function handleImport() {
    if (!file) return

    setStep('importing')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/admin/crm/import', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Import failed')
      }

      const data = await res.json()
      setResult(data)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
      setStep('preview')
    }
  }

  function handleReset() {
    setStep('upload')
    setFile(null)
    setPreviewRows([])
    setHeaders([])
    setResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div data-testid="csv-import-wizard">
      {error && (
        <div className="mb-6 rounded-lg border border-[var(--destructive)] bg-[var(--destructive-muted)] p-3 text-sm text-[var(--destructive)]" data-testid="import-error">
          {error}
        </div>
      )}

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="rounded-xl border border-border bg-surface p-8 shadow-card">
          <div className="mx-auto max-w-md text-center">
            <svg className="mx-auto size-12 text-foreground-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-foreground">Upload CSV File</h3>
            <p className="mt-2 text-sm text-foreground-muted">
              Upload a CSV file with company data. The file should include columns for
              name, website, industry, and status.
            </p>

            <div className="mt-6">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="csv-file-input"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
                data-testid="select-file-button"
              >
                Select CSV File
              </button>
            </div>

            <div className="mt-8 rounded-lg bg-muted p-4 text-left">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-2">
                Expected Format
              </h4>
              <code className="block text-xs text-foreground-muted whitespace-pre-wrap">
{`name,website,industry,company_size,status,notes,tags
"Acme Corp","https://acme.com","Technology","51-200","prospect","Big opportunity","enterprise,priority"`}
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && (
        <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">Preview Import</h3>
            <p className="mt-1 text-sm text-foreground-muted">
              {file?.name} - Showing first {previewRows.length} rows of data
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {headers.map((h, i) => (
                    <th key={i} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {previewRows.map((row, ri) => (
                  <tr key={ri} className="transition-colors hover:bg-raised">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-4 py-2 text-sm text-foreground">
                        {cell || <span className="text-foreground-muted">--</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-5 border-t border-border flex items-center justify-between">
            <button
              onClick={handleReset}
              className="rounded-lg bg-muted border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-raised transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              className="rounded-lg bg-accent px-6 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
              data-testid="confirm-import-button"
            >
              Import Companies
            </button>
          </div>
        </div>
      )}

      {/* Step: Importing */}
      {step === 'importing' && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-card">
          <div className="mx-auto size-12 animate-spin rounded-full border-4 border-muted border-t-accent" />
          <p className="mt-4 text-sm text-foreground-muted">Importing companies...</p>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && result && (
        <div className="rounded-xl border border-border bg-surface p-8 shadow-card" data-testid="import-result">
          <div className="mx-auto max-w-md text-center">
            <svg className="mx-auto size-12 text-[var(--success)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-foreground">Import Complete</h3>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-[var(--success-muted)] p-3">
                <p className="text-2xl font-bold text-[var(--success)]">{result.imported}</p>
                <p className="text-xs text-foreground-muted">Imported</p>
              </div>
              <div className="rounded-lg bg-[var(--warning-muted)] p-3">
                <p className="text-2xl font-bold text-[var(--warning)]">{result.skipped}</p>
                <p className="text-xs text-foreground-muted">Skipped</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="mt-4 rounded-lg bg-[var(--destructive-muted)] p-3 text-left">
                <p className="text-xs font-semibold text-[var(--destructive)] mb-1">Errors:</p>
                <ul className="text-xs text-[var(--destructive)] space-y-1">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={handleReset}
                className="rounded-lg bg-accent px-6 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors shadow-accent-glow"
              >
                Import More
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
