/**
 * CRM Seed Script
 *
 * Reads seed_data.json and inserts all CRM data into the Supabase database.
 * Uses the service role key to bypass RLS.
 * Idempotent: skips existing records (ON CONFLICT DO NOTHING).
 *
 * Usage: npx tsx scripts/seed-crm.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// --- Config ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// --- Load seed data ---
const seedPath = resolve(__dirname, '..', 'seed_data.json')
const seed = JSON.parse(readFileSync(seedPath, 'utf-8'))

// --- Counters ---
const counts: Record<string, number> = {}
const warnings: string[] = []

function inc(table: string, n = 1) {
  counts[table] = (counts[table] ?? 0) + n
}

// ============================================================
// 1. Users — create profiles for the 6 team members
// ============================================================

// Map of first name → full name for the team
const USER_FULL_NAMES: Record<string, string> = {
  Zach: 'Zach Usher',
  Marley: 'Marley Harrison',
  Ameet: 'Ameet Patel',
  Joanne: 'Joanne Bickler',
  Myra: 'Myra Chen',
  Ryan: 'Ryan Chin',
}

// Normalize data values from the spreadsheet
function normalizeStage(stage: string): string {
  // Fix "7a. Closed WON" → "7a. Closed Won"
  return stage.replace(/Closed WON/i, 'Closed Won').replace(/Closed LOST/i, 'Closed Lost')
}

function normalizeCategory(cat: string): string {
  // Fix "Follow-Up" → "Follow-up"
  const map: Record<string, string> = {
    'Follow-Up': 'Follow-up',
    'Follow-up': 'Follow-up',
    'follow-up': 'Follow-up',
    Meeting: 'Meeting',
    Task: 'Task',
    Presentation: 'Presentation',
  }
  return map[cat] ?? cat
}

async function seedUsers(): Promise<Map<string, string>> {
  const nameToId = new Map<string, string>()

  // Check for existing profiles
  const { data: existing } = await supabase.from('profiles').select('id, full_name, email')
  const existingByName = new Map<string, string>()
  const existingByEmail = new Map<string, string>()
  for (const p of existing ?? []) {
    if (p.full_name) existingByName.set(p.full_name.toLowerCase(), p.id)
    if (p.email) existingByEmail.set(p.email.toLowerCase(), p.id)
  }

  // Ryan Chin already exists (ryanachin@gmail.com) — update full_name if missing, map him
  const ryanId = existingByEmail.get('ryanachin@gmail.com')
  if (ryanId) {
    const ryanProfile = (existing ?? []).find((p) => p.id === ryanId)
    if (!ryanProfile?.full_name) {
      await supabase.from('profiles').update({ full_name: 'Ryan Chin' }).eq('id', ryanId)
      console.log('  Updated Ryan Chin profile with full_name')
    }
    nameToId.set('Ryan', ryanId)
  }

  for (const firstName of seed.users as string[]) {
    if (nameToId.has(firstName)) continue // Already mapped (e.g., Ryan)

    const fullName = USER_FULL_NAMES[firstName] ?? firstName
    const existId = existingByName.get(fullName.toLowerCase())
    if (existId) {
      nameToId.set(firstName, existId)
      console.log(`  User "${fullName}" already exists (${existId})`)
      continue
    }

    // Create a new profile. Since profiles.id is FK to auth.users, we need to create
    // an auth user first. Use admin API to create with a placeholder email.
    const email = `${firstName.toLowerCase()}@throughput.local`

    // Check if auth user already exists
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const existingAuth = authUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    )

    let userId: string
    if (existingAuth) {
      userId = existingAuth.id
      console.log(`  Auth user for ${email} already exists (${userId})`)
    } else {
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password: `Throughput2026!${firstName}`,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (authErr) {
        console.error(`  FAILED to create auth user for ${firstName}:`, authErr.message)
        warnings.push(`User ${firstName}: auth creation failed — ${authErr.message}`)
        continue
      }
      userId = authData.user.id
      console.log(`  Created auth user for ${fullName} (${userId})`)
    }

    // Upsert profile
    const { error: profErr } = await supabase.from('profiles').upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        role: 'sales', // Team members get sales access
      },
      { onConflict: 'id' }
    )
    if (profErr) {
      console.error(`  FAILED to upsert profile for ${firstName}:`, profErr.message)
      warnings.push(`User ${firstName}: profile upsert failed — ${profErr.message}`)
      continue
    }

    nameToId.set(firstName, userId)
    inc('profiles')
  }

  return nameToId
}

// ============================================================
// 2. Config — insert/update settings
// ============================================================

async function seedConfig() {
  const config = seed.config as Record<string, unknown>
  for (const [key, value] of Object.entries(config)) {
    const { error } = await supabase
      .from('crm_config')
      .upsert(
        { key, value: String(value), description: `Seeded from spreadsheet` },
        { onConflict: 'key' }
      )
    if (error) {
      warnings.push(`Config ${key}: ${error.message}`)
    } else {
      inc('crm_config')
    }
  }
}

// ============================================================
// 3. Accounts — insert all 35 + auto-create missing ones referenced by deals
// ============================================================

async function seedAccounts(): Promise<Map<string, string>> {
  const nameToId = new Map<string, string>()

  // Collect all account names needed (from accounts array + deal references)
  const allAccountNames = new Set<string>()
  for (const a of seed.accounts) allAccountNames.add(a.name)

  // Deal account references that need accounts created
  const dealAccountRefs = [...new Set(seed.deals.map((d: { account: string }) => d.account))]

  // Build a mapping for fuzzy deal→account resolution
  // e.g., "Gordian (Nitor)" → "Gordian", "API Solutions (Nitor)" → "API"
  const ACCOUNT_ALIASES: Record<string, string> = {
    'Gordian (Nitor)': 'Gordian',
    'Ziosk (Nitor)': 'Ziosk',
    'API Solutions (Nitor)': 'API',
    'ToolsGroup (Nitor)': 'ToolsGroup', // new account
    J: 'Johnson & Johnson', // J&J
  }

  // Accounts from the seed array
  for (const acct of seed.accounts) {
    // Check if already exists (case-insensitive)
    const { data: existing } = await supabase
      .from('crm_companies')
      .select('id')
      .ilike('name', acct.name)
      .single()

    if (existing) {
      nameToId.set(acct.name, existing.id)
      continue
    }

    const { data, error } = await supabase
      .from('crm_companies')
      .insert({
        name: acct.name,
        segment: acct.segment,
        parent_customer: acct.parent_customer,
        arr: acct.arr,
        health: acct.health,
        renewal_date: acct.renewal_date,
        champion: acct.champion,
        top_risk: acct.top_risk,
        next_action: acct.next_action,
        status: 'active',
      })
      .select('id')
      .single()

    if (error) {
      warnings.push(`Account "${acct.name}": ${error.message}`)
      continue
    }

    nameToId.set(acct.name, data.id)
    inc('crm_companies')
  }

  // Auto-create accounts referenced by deals but not in the accounts array
  for (const dealAcct of dealAccountRefs) {
    // Check alias first
    const alias = ACCOUNT_ALIASES[dealAcct]
    if (alias && nameToId.has(alias)) {
      nameToId.set(dealAcct, nameToId.get(alias)!)
      continue
    }

    // Check if already mapped
    if (nameToId.has(dealAcct)) continue

    // Try partial match against existing accounts
    const lowerDeal = dealAcct.toLowerCase().replace(/\s*\(.*\)/, '') // strip (Nitor) etc
    let matched = false
    for (const [name, id] of nameToId) {
      if (name.toLowerCase() === lowerDeal || lowerDeal.includes(name.toLowerCase())) {
        nameToId.set(dealAcct, id)
        matched = true
        break
      }
    }
    if (matched) continue

    // Special case: "J&J" → "Johnson & Johnson"
    if (dealAcct === 'J&J' && nameToId.has('Johnson & Johnson')) {
      nameToId.set(dealAcct, nameToId.get('Johnson & Johnson')!)
      continue
    }

    // Auto-create as a new account
    console.log(`  Auto-creating account: "${dealAcct}" (referenced by deal but not in accounts array)`)
    const { data, error } = await supabase
      .from('crm_companies')
      .insert({ name: dealAcct, status: 'prospect' })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        // Already exists (race or duplicate)
        const { data: ex } = await supabase
          .from('crm_companies')
          .select('id')
          .ilike('name', dealAcct)
          .single()
        if (ex) nameToId.set(dealAcct, ex.id)
      } else {
        warnings.push(`Auto-create account "${dealAcct}": ${error.message}`)
      }
    } else if (data) {
      nameToId.set(dealAcct, data.id)
      inc('crm_companies')
    }
  }

  return nameToId
}

// ============================================================
// 4. Account Owners
// ============================================================

async function seedAccountOwners(
  accountMap: Map<string, string>,
  userMap: Map<string, string>
) {
  for (const acct of seed.accounts) {
    const accountId = accountMap.get(acct.name)
    if (!accountId || !acct.owners?.length) continue

    for (const ownerName of acct.owners) {
      const userId = userMap.get(ownerName)
      if (!userId) {
        warnings.push(`Account owner "${ownerName}" on "${acct.name}": user not found`)
        continue
      }
      const { error } = await supabase
        .from('crm_account_owners')
        .upsert({ account_id: accountId, user_id: userId }, { onConflict: 'account_id,user_id', ignoreDuplicates: true })
      if (error && error.code !== '23505') {
        warnings.push(`Account owner ${ownerName}→${acct.name}: ${error.message}`)
      } else {
        inc('crm_account_owners')
      }
    }
  }
}

// ============================================================
// 5. Deals — insert all 52, resolving account FKs
// ============================================================

interface SeedDeal {
  name: string
  account: string
  agentic_type: string | null
  deal_type: string | null
  source: string | null
  est_value_annualized: number | null
  stage: string
  probability: number
  weighted_value: number | null
  target_close_date: string | null
  actual_close_date: string | null
  next_step: string | null
  next_step_date: string | null
  stalled: boolean
  owners: string[]
}

async function seedDeals(
  accountMap: Map<string, string>,
  userMap: Map<string, string>
): Promise<Map<number, string>> {
  const indexToId = new Map<number, string>() // deal index → id for action resolution

  for (let i = 0; i < seed.deals.length; i++) {
    const deal = seed.deals[i] as SeedDeal
    const companyId = accountMap.get(deal.account)

    if (!companyId) {
      warnings.push(`Deal "${deal.name}": account "${deal.account}" not resolved`)
      continue
    }

    const { data, error } = await supabase
      .from('crm_opportunities')
      .insert({
        company_id: companyId,
        title: deal.name,
        value: deal.est_value_annualized,
        stage: normalizeStage(deal.stage),
        probability: deal.probability,
        agentic_type: deal.agentic_type,
        deal_type: deal.deal_type,
        source: deal.source,
        target_close_date: deal.target_close_date,
        expected_close_date: deal.target_close_date, // populate both
        actual_close_date: deal.actual_close_date,
        next_step: deal.next_step,
        next_step_date: deal.next_step_date,
        stalled: deal.stalled,
      })
      .select('id')
      .single()

    if (error) {
      warnings.push(`Deal "${deal.name}": ${error.message}`)
      continue
    }

    indexToId.set(i, data.id)
    inc('crm_opportunities')

    // Insert deal owners
    for (const ownerName of deal.owners) {
      const userId = userMap.get(ownerName)
      if (!userId) {
        warnings.push(`Deal owner "${ownerName}" on "${deal.name}": user not found`)
        continue
      }
      const { error: owErr } = await supabase
        .from('crm_deal_owners')
        .insert({ opportunity_id: data.id, user_id: userId })
      if (owErr && owErr.code !== '23505') {
        warnings.push(`Deal owner ${ownerName}→"${deal.name}": ${owErr.message}`)
      } else {
        inc('crm_deal_owners')
      }
    }
  }

  return indexToId
}

// ============================================================
// 6. Roles — insert all 22, link to accounts by parsing name prefix
// ============================================================

// Role name prefix → account name mapping
const ROLE_ACCOUNT_PREFIXES: [string, string][] = [
  ['DTV', 'DirecTV'],
  ['United Airlines', 'United Airlines'],
  ['Premera', 'Premera'],
  ['ScanHealth', 'ScanHealth'],
  ['Scan Health', 'ScanHealth'],
  ['MSFT', 'MSFT'],
  ['Amazon', 'Amazon'],
  ['Grammarly', 'Grammarly'],  // Will be auto-created if not in accounts
  ['DePuy', 'Johnson & Johnson'],  // DePuy is a J&J subsidiary
  ['J&J', 'Johnson & Johnson'],
]

async function seedRoles(
  accountMap: Map<string, string>,
  userMap: Map<string, string>
): Promise<Map<string, string>> {
  const roleNameToId = new Map<string, string>()

  for (const role of seed.roles) {
    // Try to resolve account from role name prefix
    // Normalize double spaces in role names
    const roleName = (role.name as string).replace(/\s+/g, ' ')
    let accountId: string | null = null
    for (const [prefix, accountName] of ROLE_ACCOUNT_PREFIXES) {
      if (roleName.startsWith(prefix) || roleName.toLowerCase().startsWith(prefix.toLowerCase())) {
        accountId = accountMap.get(accountName) ?? null
        if (!accountId) {
          for (const [key, id] of accountMap) {
            if (key.toLowerCase() === accountName.toLowerCase()) {
              accountId = id
              break
            }
          }
        }
        if (!accountId) {
          // Auto-create account for this prefix (e.g., Grammarly)
          console.log(`  Auto-creating account "${accountName}" for role "${roleName}"`)
          const { data: newAcct } = await supabase
            .from('crm_companies')
            .insert({ name: accountName, status: 'prospect' })
            .select('id')
            .single()
          if (newAcct) {
            accountId = newAcct.id
            accountMap.set(accountName, newAcct.id)
            inc('crm_companies')
          }
        }
        break
      }
    }

    if (!accountId) {
      warnings.push(`Role "${role.name}": could not resolve account from name prefix`)
    }

    const { data, error } = await supabase
      .from('crm_roles')
      .insert({
        name: roleName,
        account_id: accountId,
        function: role.function,
        priority: role.priority,
        status: role.status,
        open_date: role.open_date ?? null,
        target_fill_date: role.target_fill_date ?? null,
        role_stage: role.role_stage ?? null,
        blocker: role.blocker ?? null,
        notes: role.notes ?? null,
      })
      .select('id')
      .single()

    if (error) {
      warnings.push(`Role "${role.name}": ${error.message}`)
      continue
    }

    roleNameToId.set(role.name, data.id)
    inc('crm_roles')

    // Insert role owners
    for (const ownerName of role.owners ?? []) {
      const userId = userMap.get(ownerName)
      if (!userId) {
        warnings.push(`Role owner "${ownerName}" on "${role.name}": user not found`)
        continue
      }
      const { error: owErr } = await supabase
        .from('crm_role_owners')
        .insert({ role_id: data.id, user_id: userId })
      if (owErr && owErr.code !== '23505') {
        warnings.push(`Role owner ${ownerName}→"${role.name}": ${owErr.message}`)
      } else {
        inc('crm_role_owners')
      }
    }
  }

  return roleNameToId
}

// ============================================================
// 7. Actions — insert all 37, resolve related_item to deal/account/role
// ============================================================

interface SeedAction {
  date_added: string
  category: string
  related_item: string | null
  description: string
  due_date: string | null
  status: string
  priority: number | null
  notes: string | null
  owners: string[]
}

async function seedActions(
  accountMap: Map<string, string>,
  userMap: Map<string, string>,
  roleNameToId: Map<string, string>
) {
  // Build lookup structures for fuzzy matching
  // Fetch all opportunities with their titles and company_ids
  const { data: allOpps } = await supabase
    .from('crm_opportunities')
    .select('id, title, company_id')
  const oppsByTitle = new Map<string, { id: string; company_id: string }>()
  for (const opp of allOpps ?? []) {
    oppsByTitle.set(opp.title.toLowerCase(), { id: opp.id, company_id: opp.company_id })
  }

  for (const action of seed.actions as SeedAction[]) {
    let companyId: string | null = null
    let opportunityId: string | null = null
    let roleId: string | null = null
    const related = action.related_item

    if (related) {
      const relLower = related.toLowerCase()

      // Priority 1: exact deal title match
      const exactDeal = oppsByTitle.get(relLower)
      if (exactDeal) {
        opportunityId = exactDeal.id
        companyId = exactDeal.company_id
      }

      // Priority 2: partial deal title match (deal title contains related_item or vice versa)
      if (!opportunityId) {
        for (const [title, opp] of oppsByTitle) {
          if (title.includes(relLower) || relLower.includes(title)) {
            opportunityId = opp.id
            companyId = opp.company_id
            break
          }
        }
      }

      // Priority 3: match against account names
      if (!companyId) {
        // Exact match
        for (const [name, id] of accountMap) {
          if (name.toLowerCase() === relLower) {
            companyId = id
            break
          }
        }
      }
      if (!companyId) {
        // Partial match: account name contained in related_item or vice versa
        for (const [name, id] of accountMap) {
          const nameLower = name.toLowerCase()
          if (relLower.includes(nameLower) || nameLower.includes(relLower)) {
            companyId = id
            break
          }
        }
      }

      // Special cases for action related_items
      if (!companyId) {
        const SPECIAL: Record<string, string> = {
          'starbucks poc': 'Starbucks',
          'microsoft product pmo': 'Microsoft',
          'msft': 'MSFT',
          't-mobile product': 'T-Mobile',
          'dsg partner portal rfp': 'DSG',
          'dsg': 'DSG',
          'fis escalation': 'FIS',
          'fis': 'FIS',
          'fiserv': 'Fiserv',
          'premera lead': 'Premera',
          'meta proposal': 'Meta',
          'meta & apple': 'Meta',
          'scanhealth': 'ScanHealth',
          'hp': 'HP',
          'uk/boa': 'Bank of America',
          'api international': 'API Global Solutions',
          'london stock exchange': 'London Stock Exchange',
          'healthcare clients': '_INTERNAL_',
          'recruiting sync': '_INTERNAL_',
          'product studio': '_INTERNAL_',
          'aava demo': '_INTERNAL_',
          "satyam's team": '_INTERNAL_',
          'charter comm': '_INTERNAL_',
        }
        const specialAcct = SPECIAL[relLower]
        if (specialAcct && specialAcct !== '_INTERNAL_') {
          for (const [name, id] of accountMap) {
            if (name.toLowerCase() === specialAcct.toLowerCase()) {
              companyId = id
              break
            }
          }
        }
        // Mark as needing internal fallback
        if (specialAcct === '_INTERNAL_') {
          // Will be handled below by the Internal company fallback
        }
      }

      // Priority 4: match against role names
      if (!roleId && !opportunityId) {
        for (const [roleName, id] of roleNameToId) {
          if (roleName.toLowerCase().includes(relLower) || relLower.includes(roleName.toLowerCase())) {
            roleId = id
            break
          }
        }
      }

      if (!companyId && !opportunityId && !roleId) {
        warnings.push(`Action "${action.description?.slice(0, 50)}": related_item "${related}" could not be resolved`)
      }
    }

    // If we have an opportunity but no company, get company from opportunity
    if (opportunityId && !companyId) {
      const opp = (allOpps ?? []).find((o) => o.id === opportunityId)
      if (opp) companyId = opp.company_id
    }

    // Activities require company_id (NOT NULL). If we couldn't resolve, use Internal fallback.
    if (!companyId) {
      // Get or create "Internal" company for unresolvable items
      let internalId = accountMap.get('Internal')
      if (!internalId) {
        let { data: internal } = await supabase
          .from('crm_companies')
          .select('id')
          .ilike('name', 'Internal')
          .single()
        if (!internal) {
          const { data: created } = await supabase
            .from('crm_companies')
            .insert({ name: 'Internal', status: 'partner', notes: 'Internal/non-client actions' })
            .select('id')
            .single()
          if (created) {
            internal = created
            inc('crm_companies')
          }
        }
        if (internal) {
          internalId = internal.id
          accountMap.set('Internal', internalId)
        }
      }
      companyId = internalId ?? null

      if (!companyId) {
        warnings.push(`Action "${action.description?.slice(0, 60)}": no company_id resolved, skipping`)
        continue
      }
      if (related) {
        warnings.push(`Action related_item "${related}" → mapped to Internal (no match found)`)
      }
    }

    const { data, error } = await supabase
      .from('crm_activities')
      .insert({
        company_id: companyId,
        opportunity_id: opportunityId,
        role_id: roleId,
        type: 'task', // Default type from old schema; category carries spec semantics
        category: normalizeCategory(action.category),
        subject: action.description?.slice(0, 200) ?? action.related_item ?? 'Action',
        description: action.description,
        activity_date: action.date_added ? `${action.date_added}T00:00:00Z` : undefined,
        due_date: action.due_date,
        status: action.status,
        priority: action.priority,
        notes: action.notes,
        completed: action.status === 'Completed',
      })
      .select('id')
      .single()

    if (error) {
      warnings.push(`Action "${action.description?.slice(0, 50)}": ${error.message}`)
      continue
    }

    inc('crm_activities')

    // Insert action owners
    for (const ownerName of action.owners ?? []) {
      const userId = userMap.get(ownerName)
      if (!userId) {
        warnings.push(`Action owner "${ownerName}": user not found`)
        continue
      }
      const { error: owErr } = await supabase
        .from('crm_action_owners')
        .insert({ activity_id: data.id, user_id: userId })
      if (owErr && owErr.code !== '23505') {
        warnings.push(`Action owner ${ownerName}: ${owErr.message}`)
      } else {
        inc('crm_action_owners')
      }
    }
  }
}

// ============================================================
// 8. Consultant Plan — insert all 22 weeks
// ============================================================

async function seedConsultantPlan() {
  for (const week of seed.consultant_plan) {
    const { error } = await supabase.from('crm_consultant_plan').upsert(
      {
        week_start: week.week_start,
        starting_hc: week.starting_hc,
        hires: week.hires ?? 0,
        attrition: week.attrition ?? 0,
        notes: week.notes,
      },
      { onConflict: 'week_start', ignoreDuplicates: true }
    )
    if (error && error.code !== '23505') {
      warnings.push(`Consultant plan ${week.week_start}: ${error.message}`)
    } else {
      inc('crm_consultant_plan')
    }
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('=== CRM Seed Script ===\n')

  console.log('1. Seeding users...')
  const userMap = await seedUsers()
  console.log(`   Mapped ${userMap.size} users\n`)

  console.log('2. Seeding config...')
  await seedConfig()
  console.log(`   Done\n`)

  console.log('3. Seeding accounts...')
  const accountMap = await seedAccounts()
  console.log(`   Mapped ${accountMap.size} accounts\n`)

  console.log('4. Seeding account owners...')
  await seedAccountOwners(accountMap, userMap)
  console.log(`   Done\n`)

  console.log('5. Seeding deals + deal owners...')
  const dealIndexMap = await seedDeals(accountMap, userMap)
  console.log(`   Inserted ${dealIndexMap.size} deals\n`)

  console.log('6. Seeding roles + role owners...')
  const roleNameToId = await seedRoles(accountMap, userMap)
  console.log(`   Inserted ${roleNameToId.size} roles\n`)

  console.log('7. Seeding actions + action owners...')
  await seedActions(accountMap, userMap, roleNameToId)
  console.log(`   Done\n`)

  console.log('8. Seeding consultant plan...')
  await seedConsultantPlan()
  console.log(`   Done\n`)

  // --- Report ---
  console.log('=== INSERTION REPORT ===')
  const tableOrder = [
    'profiles',
    'crm_config',
    'crm_companies',
    'crm_account_owners',
    'crm_opportunities',
    'crm_deal_owners',
    'crm_roles',
    'crm_role_owners',
    'crm_activities',
    'crm_action_owners',
    'crm_consultant_plan',
  ]
  for (const t of tableOrder) {
    console.log(`  ${t.padEnd(24)} ${counts[t] ?? 0}`)
  }

  if (warnings.length > 0) {
    console.log(`\n=== WARNINGS (${warnings.length}) ===`)
    for (const w of warnings) {
      console.log(`  ⚠ ${w}`)
    }
  } else {
    console.log('\n  No warnings!')
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
