import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAccess } from '@/lib/auth/requireCrmAccess'
import { csvImportSchema } from '@/lib/crm/schemas'
import { COMPANY_SIZES, COMPANY_STATUSES } from '@/lib/crm/constants'

interface ImportError {
  row: number
  message: string
}

/**
 * POST /api/admin/crm/import
 * CSV import for companies. Accepts a JSON body with an array of company objects.
 * Skips companies whose name already exists (case-insensitive).
 * Returns counts of imported, skipped, and per-row errors.
 */
export async function POST(request: NextRequest) {
  const { error: authError, supabase, profile } = await requireCrmAccess()
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: authError.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = csvImportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { companies: inputCompanies } = parsed.data

  // Fetch existing company names for deduplication (case-insensitive)
  const { data: existingCompanies, error: fetchError } = await supabase
    .from('crm_companies')
    .select('name')

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to check existing companies' }, { status: 500 })
  }

  const existingNamesSet = new Set(
    (existingCompanies ?? []).map((c) => c.name.toLowerCase())
  )

  const companySizesSet = new Set<string>(COMPANY_SIZES)
  const companyStatusesSet = new Set<string>(COMPANY_STATUSES)

  const toInsert: {
    name: string
    website: string | null
    industry: string | null
    company_size: string | null
    status: string
    notes: string | null
    created_by: string
  }[] = []
  const errors: ImportError[] = []
  let skipped = 0

  for (let i = 0; i < inputCompanies.length; i++) {
    const row = inputCompanies[i]
    const rowNum = i + 1

    // Skip if name already exists
    if (existingNamesSet.has(row.name.toLowerCase())) {
      skipped++
      continue
    }

    // Also skip duplicates within the import batch
    if (existingNamesSet.has(row.name.toLowerCase())) {
      skipped++
      continue
    }

    // Validate company_size if provided
    if (row.company_size && !companySizesSet.has(row.company_size)) {
      errors.push({ row: rowNum, message: `Invalid company_size: "${row.company_size}"` })
      continue
    }

    // Validate status if provided
    if (row.status && !companyStatusesSet.has(row.status)) {
      errors.push({ row: rowNum, message: `Invalid status: "${row.status}"` })
      continue
    }

    // Track name to prevent duplicates within batch
    existingNamesSet.add(row.name.toLowerCase())

    toInsert.push({
      name: row.name,
      website: row.website || null,
      industry: row.industry || null,
      company_size: row.company_size || null,
      status: row.status || 'prospect',
      notes: row.notes || null,
      created_by: profile!.id,
    })
  }

  let imported = 0

  if (toInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('crm_companies')
      .insert(toInsert)
      .select('id')

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to import companies', details: insertError.message },
        { status: 500 }
      )
    }

    imported = (inserted ?? []).length
  }

  return NextResponse.json({ imported, skipped, errors })
}
