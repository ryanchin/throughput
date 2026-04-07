#!/usr/bin/env node
/**
 * Seed script for Resources module.
 * Creates consultant users + consultant records, candidates, and assignments.
 * Resolves FKs by name matching against existing accounts/deals/roles.
 *
 * Usage: node scripts/seed-resources.mjs
 * Requires: .env with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const seedData = JSON.parse(readFileSync(resolve(__dirname, '..', 'resources_seed_data.json'), 'utf-8'))

// Load env
const envPath = resolve(__dirname, '..', '.env')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
  if (line.startsWith('#') || !line.includes('=')) continue
  const eqIdx = line.indexOf('=')
  env[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim()
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ── Counters & logs ──
const stats = { users: 0, consultants: 0, candidates: 0, assignments: 0 }
const warnings = []

// ── Lookup caches (loaded once) ──
let accountsByName = {}   // lowercase name → id
let dealsByTitle = {}     // lowercase title → { id, company_id }
let consultantsByName = {} // "first last" lowercase → consultant id

async function loadLookups() {
  const { data: accounts } = await sb.from('crm_companies').select('id, name')
  for (const a of accounts) {
    accountsByName[a.name.toLowerCase()] = a.id
  }

  const { data: deals } = await sb.from('crm_opportunities').select('id, title, company_id')
  for (const d of deals) {
    dealsByTitle[d.title.toLowerCase()] = { id: d.id, company_id: d.company_id }
  }
}

function resolveAccountId(accountName) {
  if (!accountName) return null
  const lower = accountName.toLowerCase()

  // Exact match first
  if (accountsByName[lower]) return accountsByName[lower]

  // Handle "Gordian (Nitor)" → match "Gordian"
  // Try stripping parenthetical
  const stripped = lower.replace(/\s*\(.*?\)\s*/g, '').trim()
  if (accountsByName[stripped]) return accountsByName[stripped]

  // Substring match: check if any account name contains our search or vice versa
  for (const [name, id] of Object.entries(accountsByName)) {
    if (name.includes(stripped) || stripped.includes(name)) return id
  }

  warnings.push(`Account not found: "${accountName}"`)
  return null
}

function resolveDealId(dealName) {
  if (!dealName) return null
  const lower = dealName.toLowerCase()

  // Exact match
  if (dealsByTitle[lower]) return dealsByTitle[lower].id

  // ILIKE-style: check if any deal title contains the search string or vice versa
  for (const [title, deal] of Object.entries(dealsByTitle)) {
    if (title.includes(lower) || lower.includes(title)) return deal.id
  }

  warnings.push(`Deal not found: "${dealName}"`)
  return null
}

// ── Step 1: Create consultant users + consultant records ──
async function seedConsultants() {
  console.log('\n── Seeding consultants ──')

  for (const c of seedData.consultants) {
    const email = `${c.first_name.toLowerCase()}.${c.last_name.toLowerCase()}@consultant.throughput.local`
    const fullName = `${c.first_name} ${c.last_name}`

    // 1a. Create auth user
    const { data: authData, error: authErr } = await sb.auth.admin.createUser({
      email,
      password: 'seed-password-change-me',
      email_confirm: true,
      user_metadata: { full_name: fullName }
    })

    if (authErr) {
      warnings.push(`Auth user create failed for ${fullName}: ${authErr.message}`)
      continue
    }

    const userId = authData.user.id
    stats.users++

    // 1b. Update profile: set full_name, user_role, role='employee'
    const { error: profileErr } = await sb.from('profiles').update({
      full_name: fullName,
      user_role: 'consultant',
      role: 'employee'
    }).eq('id', userId)

    if (profileErr) {
      warnings.push(`Profile update failed for ${fullName}: ${profileErr.message}`)
    }

    // 1c. Resolve account FK
    const accountId = resolveAccountId(c.current_account)

    // 1d. Resolve deal FK (use account to narrow if needed — for now just null, assignments handle this)
    const currentDealId = null // Will be set via assignments

    // 1e. Create consultant record
    const { data: consultant, error: consultErr } = await sb.from('crm_consultants').insert({
      user_id: userId,
      function: c.function,
      seniority: c.seniority || null,
      skills: c.skills || [],
      status: c.status,
      current_account_id: accountId,
      current_deal_id: currentDealId,
      start_date: c.start_date || null,
      expected_end_date: c.expected_end_date || null,
      hire_date: null,
      location: c.location || null,
      notes: c.notes || null,
    }).select('id').single()

    if (consultErr) {
      warnings.push(`Consultant insert failed for ${fullName}: ${consultErr.message}`)
      continue
    }

    consultantsByName[fullName.toLowerCase()] = consultant.id
    stats.consultants++
    console.log(`  ✓ ${fullName} (${c.status})${accountId ? '' : c.current_account ? ' ⚠ no account match' : ''}`)
  }
}

// ── Step 2: Seed candidates ──
async function seedCandidates() {
  console.log('\n── Seeding candidates ──')

  for (const c of seedData.candidates) {
    const fullName = `${c.first_name} ${c.last_name}`
    const accountId = resolveAccountId(c.target_account)

    const { data: candidate, error } = await sb.from('crm_candidates').insert({
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email || null,
      phone: c.phone || null,
      function: c.function,
      seniority: c.seniority || null,
      skills: c.skills || [],
      status: c.status,
      source: c.source || null,
      target_role_id: null, // No role_id in seed data
      target_account_id: accountId,
      resume_url: c.resume_url || null,
      interview_notes: c.interview_notes || null,
      date_added: c.date_added,
      notes: c.notes || null,
    }).select('id').single()

    if (error) {
      warnings.push(`Candidate insert failed for ${fullName}: ${error.message}`)
      continue
    }

    stats.candidates++
    console.log(`  ✓ ${fullName} (${c.status})${accountId ? '' : ' ⚠ no account match'}`)

    // Step 4 preview: if Tunde is Hired, set bidirectional FKs
    if (c.status === 'Hired' && c.first_name === 'Tunde') {
      // Check if a matching consultant exists (won't for Tunde since he's not in consultants array)
      // The spec says "if a matching consultant exists" — Tunde is not in the consultants seed data
      // So we just note this
      console.log(`    ℹ ${fullName} is Hired — no matching consultant in seed data (promotion not linked)`)
    }
  }
}

// ── Step 3: Seed assignments ──
async function seedAssignments() {
  console.log('\n── Seeding assignments ──')

  for (const a of seedData.assignments) {
    const nameLower = a.consultant_name.toLowerCase()
    const consultantId = consultantsByName[nameLower]

    if (!consultantId) {
      warnings.push(`Assignment skipped — consultant not found: "${a.consultant_name}"`)
      continue
    }

    const accountId = resolveAccountId(a.account)
    const dealId = resolveDealId(a.deal_name)

    const { error } = await sb.from('crm_assignments').insert({
      consultant_id: consultantId,
      account_id: accountId,
      deal_id: dealId,
      role_id: null,
      start_date: a.start_date,
      expected_end_date: a.expected_end_date || null,
      actual_end_date: a.actual_end_date || null,
      bill_rate: a.bill_rate || null,
      status: a.status,
      end_reason: a.end_reason || null,
      notes: a.notes || null,
    })

    if (error) {
      warnings.push(`Assignment insert failed for ${a.consultant_name} @ ${a.account}: ${error.message}`)
      continue
    }

    // If this is an active assignment, also set the consultant's current_deal_id
    if (a.status === 'Active' && dealId) {
      await sb.from('crm_consultants').update({ current_deal_id: dealId }).eq('id', consultantId)
    }

    stats.assignments++
    const dealNote = dealId ? '' : ` ⚠ deal not matched: "${a.deal_name}"`
    const acctNote = accountId ? '' : ` ⚠ account not matched: "${a.account}"`
    console.log(`  ✓ ${a.consultant_name} → ${a.account} (${a.status})${dealNote}${acctNote}`)
  }
}

// ── Main ──
async function main() {
  console.log('Loading lookup tables...')
  await loadLookups()
  console.log(`  ${Object.keys(accountsByName).length} accounts, ${Object.keys(dealsByTitle).length} deals`)

  await seedConsultants()
  await seedCandidates()
  await seedAssignments()

  console.log('\n══════════════════════════════════')
  console.log('  SEED RESULTS')
  console.log('══════════════════════════════════')
  console.log(`  Users created:       ${stats.users}`)
  console.log(`  Consultants created: ${stats.consultants}`)
  console.log(`  Candidates created:  ${stats.candidates}`)
  console.log(`  Assignments created: ${stats.assignments}`)

  if (warnings.length > 0) {
    console.log(`\n  ⚠ WARNINGS (${warnings.length}):`)
    for (const w of warnings) {
      console.log(`    - ${w}`)
    }
  } else {
    console.log('\n  ✅ No warnings — all FK resolutions succeeded')
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
