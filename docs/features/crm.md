# Feature: AI-First CRM

**Status:** Complete
**Zone:** admin
**Last Updated:** 2026-04-06

## Overview

An AI-first, company-first CRM built into the Throughput admin section. The team uses it to track business relationships, sales opportunities, and interaction history. Unlike traditional CRMs that require manual data entry, this CRM uses four AI features to keep data fresh: auto-enrichment on company creation, natural language deal updates with a confirmation UI, AI-suggested next actions after logging activity, and smart reminders that flag stale deals. Every record anchors to a **company** -- contacts are optional because early-stage opportunities often exist before any individual contact is identified.

The CRM lives at `/admin/crm` and is accessible to both **admin** and **sales** roles via a `requireCrmAccess()` auth helper. Salespeople are the primary users. The kanban pipeline board is the hero feature -- the thing that gets shown in leadership meetings. The AI features are what make salespeople actually keep it updated.

Six scope expansions have been accepted beyond the core CRUD: deal scoring, AI weekly digest, deal velocity indicators, CSV import, drag-to-close with win/loss reason, and pipeline snapshot history.

## Business Logic

### Entity Hierarchy

```
Company (required, top-level)
  |- Contacts (0..n, optional)
  |- Opportunities (0..n, each belongs to exactly one company)
  |     |- optionally linked to a Contact
  |     |- ai_score (AI-predicted close probability)
  |     |- close_reason (captured on drag-to-close)
  |- Activities (0..n, linked to company; optionally to a contact or opportunity)
```

### Company Rules

- **Status lifecycle:** prospect -> active -> churned (or partner at any point)
- Status values: `prospect`, `active`, `churned`, `partner`
- Company names must be unique (case-insensitive)
- Deleting a company cascades to all contacts, opportunities, and activities
- Tags are freeform text arrays for flexible categorization (no predefined tag list)
- Company size is a predefined range enum: `1-10`, `11-50`, `51-200`, `201-500`, `501-1000`, `1000+`
- `ai_enriched` boolean flag tracks whether enrichment has been applied

### Contact Rules

- A contact must belong to exactly one company
- `is_primary` flag: at most one primary contact per company; setting a new primary automatically unsets the previous one
- Email is optional but must be valid format if provided
- LinkedIn URL is optional but must be a valid `linkedin.com` URL if provided
- Deleting a contact sets `contact_id = null` on linked opportunities and activities (ON DELETE SET NULL)

### Opportunity Rules

- An opportunity must belong to exactly one company
- Contact linkage is optional (supports the "company known, contact unknown" pattern)
- **Pipeline stages (ordered):** lead -> qualified -> proposal -> negotiation -> closed_won -> closed_lost
- Stage changes are tracked implicitly via `updated_at`; no separate stage history table in v1
- `probability` is an integer 0-100; defaults by stage:
  - lead: 10, qualified: 25, proposal: 50, negotiation: 75, closed_won: 100, closed_lost: 0
- Stage change auto-sets probability to `STAGE_PROBABILITIES[newStage]` unless user explicitly provides a probability value
- `value` is in USD, stored as numeric(12,2); nullable (not all opportunities have a known value)
- `expected_close_date` is optional
- Closed opportunities (closed_won or closed_lost) are excluded from pipeline totals by default
- Moving to closed_won or closed_lost is a terminal action; can be reopened by changing stage back
- `ai_score` is an AI-predicted close probability (0-100), separate from the manual `probability` field
- `close_reason` is captured when dragging to closed_won or closed_lost via a modal

### Activity Rules

- Must be linked to a company; contact and opportunity linkages are optional
- Types: `call`, `email`, `meeting`, `note`, `task`
- `completed` flag applies only to `task` type; defaults to `false` for tasks, `true` for all other types
- `activity_date` defaults to now but can be backdated for logging past interactions
- Activities are append-only in v1 (no edit/delete)

### Dashboard Metrics

The CRM dashboard (`/admin/crm`) displays:

- **Pipeline value:** sum of `value` for all open opportunities (not closed_won/closed_lost)
- **Pipeline count:** number of open opportunities
- **Weighted pipeline:** sum of `value * probability / 100` for open opportunities
- **Won this month:** count and total value of opportunities moved to closed_won in current calendar month
- **Lost this month:** count of opportunities moved to closed_lost in current calendar month
- **Recent activities:** last 10 activities across all companies
- **Pipeline by stage:** count and total value per stage (for the kanban/summary view)
- **Companies by status:** count per status category
- **Deal velocity indicators:** green/yellow/red on kanban cards based on days since last activity
- **AI weekly digest:** Monday pipeline summary generated by LLM, shown at top of dashboard
- **Pipeline snapshot history:** weekly trend chart showing pipeline value over time

### AI Features

#### 1. AI Company Enrichment

When creating a company, the user provides a name (and optionally a URL). An LLM call to OpenRouter fills in industry, size, description, and website. The user reviews the enriched data and saves. No manual data entry for the boring parts. Uses LLM knowledge only (no web scraping). The `ai_enriched` flag on the company tracks whether enrichment was applied.

#### 2. Natural Language Deal Updates

A text input bar at the top of the CRM dashboard. Salesperson types a natural language update (e.g., "Had a call with Acme, they want a proposal by next Friday"). AI parses this into structured actions: activity logged, opportunity stage updated, task created. The user confirms the parsed actions via a confirmation panel before they're applied. Parsed input and user modifications are logged to `crm_nl_parse_log` for accuracy tracking.

The API route performs fuzzy entity resolution after parsing. Company names from the LLM output are matched to DB records using case-insensitive ILIKE with trigram similarity fallback (e.g., "Acme" matches "Acme Corp"). Unresolved entities are flagged in the confirmation UI for the user to select or create.

#### 3. AI-Suggested Next Actions

After logging an activity, the LLM suggests 2-3 concrete next steps based on the deal stage, activity type, and context (e.g., "Send follow-up email with proposal", "Schedule technical demo", "Loop in VP for executive alignment"). The user can dismiss suggestions or convert them to tasks with one click.

#### 4. Smart Reminders

Computed on-demand via the `GET /api/admin/crm/reminders` endpoint. Flags:
- Deals sitting in the same stage for >14 days with no activity
- Companies with no activity in >30 days
- Upcoming expected close dates (7 days out, 1 day out)
- Overdue tasks (activities with type='task' and completed=false past their activity_date)

Reminders are shown as a badge/panel in the CRM dashboard. No cron job needed for v1.

#### 5. Deal Scoring (Expansion)

AI-powered close probability (0-100) on each opportunity card. Stored in `ai_score` column on `crm_opportunities`, separate from the manual `probability` field. Read-only overlay that makes the pipeline board more useful.

#### 6. AI Weekly Digest (Expansion)

Monday pipeline briefing generated by LLM. Summarizes pipeline changes, highlights deals needing attention, and provides a brief for leadership meetings. Shown on the dashboard.

### Drag-to-Close with Reason (Expansion)

When a user drags an opportunity to closed_won or closed_lost on the kanban board, a modal appears asking for a close reason. This captures high-value win/loss data over time. The reason is stored in the `close_reason` column on `crm_opportunities`.

### Deal Velocity Indicators (Expansion)

Green/yellow/red indicators on kanban cards based on days since last activity:
- Green: activity within 7 days
- Yellow: 7-14 days since last activity
- Red: >14 days since last activity

Makes stale deals visible at a glance without clicking into each card.

### CSV Import (Expansion)

Bulk import companies and deals from spreadsheets. Removes the biggest adoption barrier for initial migration from the existing spreadsheet workflow.

### Pipeline Snapshot History (Expansion)

Weekly snapshots of pipeline state stored in `crm_pipeline_snapshots`. Dashboard shows a trend chart so the pipeline tells a story over time, not just a point-in-time number.

### NL Parse Confirmation UX

When a salesperson types a natural language update, the system shows a confirmation panel:

```
+--------------------------------------------------------------+
| "Had a call with Acme, they want a proposal by next Friday"  |
+--------------------------------------------------------------+
| AI parsed 3 actions:                                          |
|                                                               |
| [x] Log activity: Call with Acme Corp                         |
|     Subject: "Discovery call"                                 |
|     > Edit                                                    |
|                                                               |
| [x] Update deal: "Acme Enterprise Plan"                       |
|     Stage: qualified -> proposal                              |
|     > Edit                                                    |
|                                                               |
| [x] Create task: "Send proposal to Acme"                      |
|     Due: April 11, 2026                                       |
|     > Edit                                                    |
|                                                               |
| [Apply All]  [Apply Selected]  [Cancel]                       |
+--------------------------------------------------------------+
```

Each parsed action has a checkbox (pre-checked) and an "Edit" link to modify before applying. The user can uncheck actions they don't want, edit details inline, or cancel entirely. Parsed input and user modifications are logged to `crm_nl_parse_log` for accuracy tracking.

### AI Error Handling

| AI Feature | Failure Mode | Fallback |
|-----------|-------------|----------|
| Company enrichment | OpenRouter down or malformed response | Show toast: "AI enrichment unavailable. Fill in manually." Pre-fill only the company name. |
| NL parse | OpenRouter down | Show toast: "Couldn't parse that. Try the manual form." Link to the activity/opportunity form. |
| NL parse | Parse returns invalid JSON | Same as above. Log the raw response for debugging. |
| NL parse | Parse misidentifies entities | User corrects via the confirmation panel. Modification logged. |
| Next action suggestions | OpenRouter down or empty response | Section simply doesn't render. No error shown (it's optional). |
| Reminders | Query fails | Reminders badge shows "?" instead of count. Log error. |
| Deal scoring | OpenRouter down | Show last known `ai_score`. If none, field is blank. |
| Weekly digest | OpenRouter down | Dashboard shows "Digest unavailable" placeholder. |

All AI calls use a 15-second timeout. All failures are non-blocking (the CRM works without AI, it's just less magical).

### Access Control: requireCrmAccess()

A new auth helper that allows both `admin` and `sales` roles to access CRM routes. Replaces the `requireAdmin()` pattern used elsewhere.

```typescript
// lib/auth/requireCrmAccess.ts
export async function requireCrmAccess() {
  const session = await getSession()
  if (!session) return unauthorized()
  const profile = await getProfile(session.user.id)
  if (!profile || !['admin', 'sales'].includes(profile.role)) return forbidden()
  return { session, profile }
}
```

Delete operations on companies may be restricted to admin-only as a safety measure.

## Technical Details

### Database Tables

All tables live in the public schema alongside existing Throughput tables. RLS allows both admin and sales roles.

```sql
-- Migration: YYYYMMDD000001_crm_tables.sql

create table crm_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  industry text,
  company_size text check (company_size in ('1-10','11-50','51-200','201-500','501-1000','1000+')),
  status text not null default 'prospect' check (status in ('prospect','active','churned','partner')),
  notes text,
  tags text[] default '{}',
  ai_enriched boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index crm_companies_name_lower_idx on crm_companies (lower(name));

create table crm_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references crm_companies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  title text,
  linkedin_url text,
  is_primary boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index crm_contacts_company_id_idx on crm_contacts (company_id);

create table crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references crm_companies(id) on delete cascade,
  contact_id uuid references crm_contacts(id) on delete set null,
  title text not null,
  value numeric(12,2),
  stage text not null default 'lead' check (stage in ('lead','qualified','proposal','negotiation','closed_won','closed_lost')),
  probability integer default 10 check (probability >= 0 and probability <= 100),
  expected_close_date date,
  close_reason text,
  ai_score integer check (ai_score >= 0 and ai_score <= 100),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index crm_opportunities_company_id_idx on crm_opportunities (company_id);
create index crm_opportunities_stage_idx on crm_opportunities (stage);

create table crm_activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references crm_companies(id) on delete cascade,
  contact_id uuid references crm_contacts(id) on delete set null,
  opportunity_id uuid references crm_opportunities(id) on delete set null,
  type text not null check (type in ('call','email','meeting','note','task')),
  subject text not null,
  description text,
  activity_date timestamptz default now(),
  completed boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create index crm_activities_company_id_idx on crm_activities (company_id);
create index crm_activities_activity_date_idx on crm_activities (activity_date desc);

-- NL parse log for measuring accuracy and creating training data
create table crm_nl_parse_log (
  id uuid primary key default gen_random_uuid(),
  raw_input text not null,
  parsed_actions jsonb not null,
  accepted boolean,           -- null = pending, true = accepted, false = rejected/modified
  modified_actions jsonb,     -- what the user changed it to (if modified)
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Pipeline snapshot history for trend tracking
create table crm_pipeline_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  total_pipeline_value numeric(14,2),
  weighted_pipeline_value numeric(14,2),
  deal_count integer,
  stage_breakdown jsonb,        -- { "lead": { count: N, value: N }, ... }
  won_count integer default 0,
  won_value numeric(14,2) default 0,
  lost_count integer default 0,
  created_at timestamptz default now()
);

create unique index crm_pipeline_snapshots_date_idx on crm_pipeline_snapshots (snapshot_date);

-- RLS: CRM access for admin and sales roles
alter table crm_companies enable row level security;
alter table crm_contacts enable row level security;
alter table crm_opportunities enable row level security;
alter table crm_activities enable row level security;
alter table crm_nl_parse_log enable row level security;
alter table crm_pipeline_snapshots enable row level security;

create policy "crm_access_companies" on crm_companies for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);
create policy "crm_access_contacts" on crm_contacts for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);
create policy "crm_access_opportunities" on crm_opportunities for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);
create policy "crm_access_activities" on crm_activities for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);
create policy "crm_access_nl_log" on crm_nl_parse_log for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);
create policy "crm_access_snapshots" on crm_pipeline_snapshots for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);

-- Updated_at triggers
create trigger crm_companies_updated_at before update on crm_companies
  for each row execute function update_updated_at();
create trigger crm_contacts_updated_at before update on crm_contacts
  for each row execute function update_updated_at();
create trigger crm_opportunities_updated_at before update on crm_opportunities
  for each row execute function update_updated_at();
```

### Constants

```typescript
// src/lib/crm/constants.ts
export const STAGES = ['lead','qualified','proposal','negotiation','closed_won','closed_lost'] as const
export const STAGE_PROBABILITIES = { lead: 10, qualified: 25, proposal: 50, negotiation: 75, closed_won: 100, closed_lost: 0 }
export const COMPANY_SIZES = ['1-10','11-50','51-200','201-500','501-1000','1000+'] as const
export const COMPANY_STATUSES = ['prospect','active','churned','partner'] as const
export const ACTIVITY_TYPES = ['call','email','meeting','note','task'] as const
```

### API Routes

All routes use `requireCrmAccess()` (allows admin + sales roles). Zod validation on all inputs.

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/admin/crm/companies` | List companies (search, filter by status/industry, pagination) |
| POST | `/api/admin/crm/companies` | Create company |
| GET | `/api/admin/crm/companies/[companyId]` | Get company with contact count, opportunity summary |
| PATCH | `/api/admin/crm/companies/[companyId]` | Update company |
| DELETE | `/api/admin/crm/companies/[companyId]` | Delete company (cascades, admin-only) |
| GET | `/api/admin/crm/companies/[companyId]/contacts` | List contacts for company |
| POST | `/api/admin/crm/companies/[companyId]/contacts` | Create contact |
| PATCH | `/api/admin/crm/companies/[companyId]/contacts/[contactId]` | Update contact |
| DELETE | `/api/admin/crm/companies/[companyId]/contacts/[contactId]` | Delete contact |
| GET | `/api/admin/crm/opportunities` | List opportunities (filter by stage, company) |
| POST | `/api/admin/crm/opportunities` | Create opportunity |
| PATCH | `/api/admin/crm/opportunities/[opportunityId]` | Update (stage change auto-sets probability) |
| DELETE | `/api/admin/crm/opportunities/[opportunityId]` | Delete opportunity |
| GET | `/api/admin/crm/activities` | List activities (filter by company, type, date range) |
| POST | `/api/admin/crm/activities` | Log activity (append-only; no edit/delete in v1) |
| GET | `/api/admin/crm/stats` | Dashboard metrics (pipeline value, stage counts) |
| GET | `/api/admin/crm/reminders` | Get current stale deals, overdue tasks, upcoming closes |
| POST | `/api/admin/crm/import` | CSV import for companies and deals |
| GET | `/api/admin/crm/snapshots` | Pipeline snapshot history for trend chart |
| POST | `/api/admin/crm/ai/enrich` | AI company enrichment (name/URL -> structured data) |
| POST | `/api/admin/crm/ai/parse` | NL parse (text -> structured actions with confirmation) |
| POST | `/api/admin/crm/ai/suggest-actions` | AI next action suggestions after logging activity |
| POST | `/api/admin/crm/ai/score` | AI deal scoring (predict close probability) |
| POST | `/api/admin/crm/ai/digest` | Generate AI weekly pipeline digest |

### AI Prompt Design

**Company Enrichment Prompt:**
```
Given a company name (and optionally a URL), return a JSON object with:
- industry (string)
- company_size (one of: 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+)
- description (1-2 sentences about what they do)
- website (URL if not provided)

Company: {name}
URL: {url or "not provided"}

Return ONLY valid JSON.
```

**Natural Language Parse Prompt:**
```
Parse this sales update into structured actions. Return JSON array of actions.

Action types:
- create_activity: {type, subject, description, company_name}
- update_stage: {company_name, opportunity_title, new_stage}
- create_task: {subject, due_date, company_name}
- create_company: {name, ...fields}
- create_contact: {name, company_name, title, email}

Stages: lead, qualified, proposal, negotiation, closed_won, closed_lost

Input: "{user_text}"

Return ONLY a valid JSON array of actions. If company or opportunity doesn't exist, note it.

Note: The API route performs fuzzy entity resolution after parsing. Company names
from the LLM output are matched to DB records using case-insensitive ILIKE with
trigram similarity fallback (e.g., "Acme" matches "Acme Corp"). Unresolved entities
are flagged in the confirmation UI for the user to select or create.
```

**Next Action Suggestion Prompt:**
```
Given this sales activity and deal context, suggest 2-3 concrete next actions.

Activity just logged: {type} - {subject} - {description}
Company: {name}
Deal stage: {stage}
Deal value: {value}
Days in current stage: {days}

Return JSON array of {action: string, priority: "high"|"medium"|"low"}.
```

### Admin Pages

All pages are server components (data fetching) with client component islands (forms, filters, kanban drag).

| Path | Component | Description |
|------|-----------|-------------|
| `/admin/crm` | `CRMDashboard` | Pipeline summary cards, stage breakdown, recent activity feed, NL input bar, reminders badge, weekly digest, snapshot trend chart |
| `/admin/crm/companies` | `CompanyList` | Searchable, filterable table of all companies |
| `/admin/crm/companies/new` | `CompanyForm` | Create company form with AI enrichment |
| `/admin/crm/companies/[companyId]` | `CompanyDetail` | Tabbed detail view: Overview, Contacts, Opportunities, Activities |
| `/admin/crm/opportunities` | `OpportunityPipeline` | Kanban board (drag between stages, velocity indicators) + list view toggle |
| `/admin/crm/activities` | `ActivityFeed` | Chronological activity feed with filters |
| `/admin/crm/import` | `CSVImport` | CSV import wizard for companies and deals |

### Key Components

```
src/components/admin/crm/
  CompanyForm.tsx          -- Create/edit company with AI enrichment (client component)
  CompanyTable.tsx         -- Company list with search/filter (client component)
  ContactForm.tsx          -- Create/edit contact modal (client component)
  ContactList.tsx          -- Contact cards within company detail
  OpportunityForm.tsx      -- Create/edit opportunity (client component)
  OpportunityKanban.tsx    -- Drag-and-drop pipeline board with velocity indicators (client component)
  OpportunityTable.tsx     -- List view alternative to kanban
  ActivityForm.tsx         -- Log activity modal (client component)
  ActivityTimeline.tsx     -- Chronological activity feed
  PipelineStats.tsx        -- Dashboard stat cards
  StageBreakdown.tsx       -- Pipeline by stage summary
  NLInputBar.tsx           -- Natural language input bar (client component)
  NLConfirmation.tsx       -- NL parse confirmation panel with checkboxes + edit (client component)
  AINextActions.tsx        -- AI-suggested next actions panel (client component)
  RemindersBadge.tsx       -- Stale deal / overdue task notification badge
  CloseReasonModal.tsx     -- Modal for win/loss reason on drag-to-close
  DealScoreBadge.tsx       -- AI score indicator on opportunity cards
  WeeklyDigest.tsx         -- AI weekly pipeline digest panel
  PipelineTrendChart.tsx   -- Snapshot history trend chart
  CSVImportWizard.tsx      -- CSV upload, column mapping, preview, and import
```

### Files Created/Modified

**New files:**
- `supabase/migrations/YYYYMMDD000001_crm_tables.sql`
- `src/lib/auth/requireCrmAccess.ts` -- Auth helper for admin + sales roles
- `src/lib/crm/schemas.ts` -- Zod validation schemas
- `src/lib/crm/queries.ts` -- Reusable Supabase query helpers
- `src/lib/crm/constants.ts` -- Stage definitions, default probabilities, company sizes
- `src/lib/crm/ai-prompts.ts` -- AI prompt templates for enrichment, NL parse, suggestions, scoring, digest
- `src/app/api/admin/crm/companies/route.ts`
- `src/app/api/admin/crm/companies/[companyId]/route.ts`
- `src/app/api/admin/crm/companies/[companyId]/contacts/route.ts`
- `src/app/api/admin/crm/companies/[companyId]/contacts/[contactId]/route.ts`
- `src/app/api/admin/crm/opportunities/route.ts`
- `src/app/api/admin/crm/opportunities/[opportunityId]/route.ts`
- `src/app/api/admin/crm/activities/route.ts`
- `src/app/api/admin/crm/stats/route.ts`
- `src/app/api/admin/crm/reminders/route.ts`
- `src/app/api/admin/crm/import/route.ts`
- `src/app/api/admin/crm/snapshots/route.ts`
- `src/app/api/admin/crm/ai/enrich/route.ts`
- `src/app/api/admin/crm/ai/parse/route.ts`
- `src/app/api/admin/crm/ai/suggest-actions/route.ts`
- `src/app/api/admin/crm/ai/score/route.ts`
- `src/app/api/admin/crm/ai/digest/route.ts`
- `src/app/(app)/admin/crm/page.tsx`
- `src/app/(app)/admin/crm/companies/page.tsx`
- `src/app/(app)/admin/crm/companies/new/page.tsx`
- `src/app/(app)/admin/crm/companies/[companyId]/page.tsx`
- `src/app/(app)/admin/crm/opportunities/page.tsx`
- `src/app/(app)/admin/crm/activities/page.tsx`
- `src/app/(app)/admin/crm/import/page.tsx`
- `src/components/admin/crm/*.tsx` (all components listed above)
- `tests/unit/crm/schemas.test.ts`
- `tests/unit/crm/ai-prompts.test.ts`
- `tests/integration/crm/companies.test.ts`
- `tests/integration/crm/contacts.test.ts`
- `tests/integration/crm/opportunities.test.ts`
- `tests/integration/crm/activities.test.ts`
- `tests/integration/crm/stats.test.ts`
- `tests/integration/crm/ai-enrich.test.ts`
- `tests/integration/crm/ai-parse.test.ts`
- `tests/integration/crm/ai-suggest.test.ts`
- `tests/integration/crm/reminders.test.ts`
- `tests/integration/crm/import.test.ts`
- `tests/integration/crm/snapshots.test.ts`
- `tests/e2e/admin/crm.spec.ts`

**Modified files:**
- `src/app/(app)/admin/page.tsx` -- Add CRM stats card to admin dashboard
- Admin sidebar/navigation -- Add CRM nav item under admin section

## Task Checklist

### Phase 1: Schema + CRUD + Kanban Pipeline Board (Week 1)

Ship to a leadership meeting. "Look, it's better than the spreadsheet."

- [ ] Write Supabase migration for all CRM tables (crm_companies, crm_contacts, crm_opportunities, crm_activities, crm_nl_parse_log, crm_pipeline_snapshots) with RLS policies for admin + sales
- [ ] Run migration against local Supabase and verify schema
- [ ] Create `src/lib/auth/requireCrmAccess.ts` (admin + sales role check)
- [ ] Create `src/lib/crm/constants.ts` (stages, default probabilities, company sizes, activity types)
- [ ] Create `src/lib/crm/schemas.ts` (Zod schemas for all entities)
- [ ] Create `src/lib/crm/queries.ts` (reusable Supabase query helpers)
- [ ] Write unit tests for Zod schemas (`tests/unit/crm/schemas.test.ts`)
- [ ] `POST /api/admin/crm/companies` -- create company
- [ ] `GET /api/admin/crm/companies` -- list with search, status filter, pagination
- [ ] `GET /api/admin/crm/companies/[companyId]` -- detail with counts
- [ ] `PATCH /api/admin/crm/companies/[companyId]` -- update
- [ ] `DELETE /api/admin/crm/companies/[companyId]` -- delete with cascade (admin-only)
- [ ] Integration tests for company CRUD (`tests/integration/crm/companies.test.ts`)
- [ ] `POST /api/admin/crm/companies/[companyId]/contacts` -- create contact
- [ ] `GET /api/admin/crm/companies/[companyId]/contacts` -- list contacts for company
- [ ] `PATCH /api/admin/crm/companies/[companyId]/contacts/[contactId]` -- update
- [ ] `DELETE /api/admin/crm/companies/[companyId]/contacts/[contactId]` -- delete
- [ ] Enforce single `is_primary` constraint in POST/PATCH logic
- [ ] Integration tests for contact CRUD (`tests/integration/crm/contacts.test.ts`)
- [ ] `POST /api/admin/crm/opportunities` -- create opportunity
- [ ] `GET /api/admin/crm/opportunities` -- list with stage/company filters
- [ ] `PATCH /api/admin/crm/opportunities/[opportunityId]` -- update (stage change auto-sets probability)
- [ ] `DELETE /api/admin/crm/opportunities/[opportunityId]` -- delete
- [ ] Auto-set default probability when stage changes
- [ ] Integration tests for opportunity CRUD (`tests/integration/crm/opportunities.test.ts`)
- [ ] `POST /api/admin/crm/activities` -- log activity (append-only)
- [ ] `GET /api/admin/crm/activities` -- list with company/type/date filters
- [ ] Auto-set `completed` based on type (true for non-task, false for task)
- [ ] Integration tests for activity CRUD (`tests/integration/crm/activities.test.ts`)
- [x] `GET /api/admin/crm/stats` -- pipeline metrics endpoint
- [x] Integration tests for stats endpoint (`tests/integration/crm/stats.test.ts`)
- [ ] `CompanyTable.tsx` -- searchable, filterable list component
- [ ] `CompanyForm.tsx` -- create/edit form component
- [ ] `/admin/crm/companies` page (server component + CompanyTable)
- [ ] `/admin/crm/companies/new` page
- [ ] `/admin/crm/companies/[companyId]` page (tabbed detail view: Overview, Contacts, Opportunities, Activities)
- [ ] `ContactForm.tsx` -- modal form component
- [ ] `ContactList.tsx` -- contact cards within company detail tab
- [ ] `OpportunityForm.tsx` -- create/edit form
- [ ] `OpportunityKanban.tsx` -- drag-and-drop pipeline board
- [ ] `OpportunityTable.tsx` -- list view alternative
- [ ] `/admin/crm/opportunities` page with kanban/list toggle
- [ ] `ActivityForm.tsx` -- log activity modal
- [ ] `ActivityTimeline.tsx` -- chronological feed component
- [ ] `/admin/crm/activities` page
- [ ] Activity tab within company detail page
- [ ] `PipelineStats.tsx` -- summary stat cards
- [ ] `StageBreakdown.tsx` -- pipeline by stage visualization
- [ ] `/admin/crm` dashboard page
- [ ] Add CRM section to admin sidebar navigation
- [ ] Add breadcrumb navigation within CRM pages
- [ ] Empty states for all list views
- [ ] Confirmation dialogs for delete actions
- [ ] Loading states and error handling for all client components
- [ ] `CloseReasonModal.tsx` -- win/loss reason modal on drag-to-close
- [ ] Drag-to-close: capture close_reason when moving to closed_won/closed_lost
- [ ] `DealVelocityIndicator` -- green/yellow/red based on days since last activity on kanban cards
- [ ] Add CRM summary card to main admin dashboard (`/admin`)

### Phase 2: AI Enrichment + Activity Logging (Week 1-2)

Removes the data entry burden. Salespeople can create a company with AI enrichment in <30 seconds.

- [ ] Create `src/lib/crm/ai-prompts.ts` -- prompt templates for enrichment
- [x] `POST /api/admin/crm/ai/enrich` -- AI company enrichment (name/URL -> structured data)
- [ ] Wire enrichment into CompanyForm (optional "Enrich with AI" button)
- [ ] Set `ai_enriched = true` on company after successful enrichment
- [x] Integration tests for AI enrichment (`tests/integration/crm/ai-routes.test.ts`)
- [ ] Error handling: toast fallback when OpenRouter is down
- [ ] Unit tests for AI prompt templates (`tests/unit/crm/ai-prompts.test.ts`)

### Phase 3: NL Parse + Next Actions (Week 2)

The "10x" differentiator. Natural language as primary input.

- [ ] Add NL parse prompt template to `ai-prompts.ts`
- [x] `POST /api/admin/crm/ai/parse` -- NL parse (text -> structured actions)
- [x] Fuzzy entity resolution: ILIKE + trigram similarity matching for company names
- [ ] `NLInputBar.tsx` -- natural language input bar at top of dashboard
- [ ] `NLConfirmation.tsx` -- confirmation panel with checkboxes, inline edit, apply/cancel
- [x] Log parsed input and modifications to `crm_nl_parse_log`
- [x] Integration tests for NL parse (`tests/integration/crm/ai-routes.test.ts`)
- [ ] Add next action suggestion prompt template to `ai-prompts.ts`
- [x] `POST /api/admin/crm/ai/suggest-actions` -- AI next action suggestions
- [ ] `AINextActions.tsx` -- suggestion panel after logging activity with dismiss/convert-to-task
- [x] Integration tests for AI suggestions (`tests/integration/crm/ai-routes.test.ts`)
- [ ] Error handling: graceful fallback for all NL/suggestion failures

### Phase 4: Smart Reminders + Dashboard Metrics + Expansions (Week 2-3)

The system that nags so managers don't have to.

- [x] `GET /api/admin/crm/reminders` -- stale deals, overdue tasks, upcoming closes
- [ ] `RemindersBadge.tsx` -- notification badge on dashboard
- [x] Integration tests for reminders (`tests/integration/crm/reminders.test.ts`)
- [x] `POST /api/admin/crm/ai/score` -- AI deal scoring
- [ ] `DealScoreBadge.tsx` -- AI score indicator on opportunity cards
- [x] `POST /api/admin/crm/ai/digest` -- AI weekly pipeline digest
- [ ] `WeeklyDigest.tsx` -- digest panel on dashboard
- [x] `POST /api/admin/crm/import` -- CSV import for companies
- [ ] `CSVImportWizard.tsx` -- upload, column mapping, preview, import
- [ ] `/admin/crm/import` page
- [x] Integration tests for CSV import (`tests/integration/crm/import.test.ts`)
- [x] `GET /api/admin/crm/snapshots` -- pipeline snapshot history
- [x] `POST /api/admin/crm/snapshots` -- create/upsert pipeline snapshot
- [ ] `PipelineTrendChart.tsx` -- snapshot trend chart on dashboard
- [x] Integration tests for snapshots (`tests/integration/crm/snapshots.test.ts`)
- [ ] Responsive layout for all CRM pages
- [ ] E2E test: full company CRUD flow (`tests/e2e/admin/crm.spec.ts`)
- [ ] E2E test: create company -> add contact -> create opportunity -> log activity
- [ ] E2E test: kanban drag-and-drop stage change with velocity indicators
- [ ] E2E test: drag-to-close with reason modal
- [ ] E2E test: AI enrichment on company creation
- [ ] E2E test: NL parse input -> confirmation -> apply
- [ ] E2E test: dashboard stats and reminders display correctly
- [ ] E2E test: CSV import flow
- [ ] E2E test: non-admin/non-sales user gets 401/redirect on CRM routes
- [ ] `npm test` runs clean with no failures

## Test Coverage

### Unit Tests

- `tests/unit/crm/schemas.test.ts`
  - Company schema: valid creation, missing name rejects, invalid status rejects, empty tags default, company_size enum validation
  - Contact schema: valid creation, invalid email rejects, invalid linkedin_url rejects, is_primary defaults false
  - Opportunity schema: valid creation, value range validation, probability 0-100 bounds, stage enum validation, close_reason optional
  - Activity schema: valid creation, type enum validation, optional fields

- `tests/unit/crm/ai-prompts.test.ts`
  - Enrichment prompt generates valid prompt string from company name/URL
  - NL parse prompt properly injects user text
  - Next action prompt includes deal context fields
  - All prompts handle missing optional fields gracefully

### Integration Tests

- `tests/integration/crm/companies.test.ts`
  - CRUD operations (create, read, update, delete)
  - Unique name constraint (case-insensitive)
  - Search by name substring
  - Filter by status
  - Pagination (offset/limit)
  - Cascade delete removes contacts, opportunities, activities
  - Non-admin/non-sales user gets 401
  - Sales role user gets 200

- `tests/integration/crm/contacts.test.ts`
  - CRUD scoped to company
  - is_primary toggle (setting new primary unsets old)
  - Contact deletion sets null on linked opportunities
  - Contact for nonexistent company returns 404

- `tests/integration/crm/opportunities.test.ts`
  - CRUD operations
  - Stage transition updates probability default
  - Filter by stage
  - Filter by company
  - Opportunity with null contact_id is valid
  - close_reason stored on drag-to-close
  - ai_score column readable

- `tests/integration/crm/activities.test.ts`
  - Create activity linked to company only
  - Create activity linked to company + contact + opportunity
  - Filter by type, company, date range
  - Task type defaults completed=false; other types default completed=true

- `tests/integration/crm/stats.test.ts`
  - Pipeline value excludes closed deals
  - Weighted pipeline calculation
  - Won/lost this month counts
  - Stage breakdown counts and values

- `tests/integration/crm/ai-enrich.test.ts`
  - Successful enrichment returns structured company data
  - OpenRouter timeout returns fallback error
  - Malformed LLM response returns error
  - Non-CRM-role user gets 401

- `tests/integration/crm/ai-parse.test.ts`
  - Simple update parses to correct actions
  - Multi-action input returns multiple actions
  - Fuzzy company name matching works
  - Invalid JSON from LLM returns error
  - Parse log entry created with raw input and parsed output
  - Modified actions logged correctly

- `tests/integration/crm/ai-suggest.test.ts`
  - Returns 2-3 suggestions with priority
  - OpenRouter down returns empty (non-blocking)
  - Suggestions include deal context

- `tests/integration/crm/reminders.test.ts`
  - Stale deals (>14 days no activity) flagged
  - Stale companies (>30 days no activity) flagged
  - Upcoming close dates flagged
  - Overdue tasks flagged
  - Closed deals excluded from stale check

- `tests/integration/crm/import.test.ts`
  - Valid CSV imports companies successfully
  - Duplicate company names handled
  - Invalid rows reported with errors
  - Column mapping validated

- `tests/integration/crm/snapshots.test.ts`
  - Snapshot created with correct pipeline values
  - Historical snapshots returned in date order
  - Stage breakdown JSON structure valid

### E2E Tests

- `tests/e2e/admin/crm.spec.ts`
  - Full company lifecycle: create, view, edit, delete
  - Company detail tabs render correctly
  - Contact CRUD within company detail
  - Opportunity pipeline: create deal, drag to new stage, verify stage updates
  - Drag-to-close with reason modal
  - Deal velocity indicators visible on kanban cards
  - AI enrichment on company creation
  - NL parse: type update -> confirm actions -> apply
  - Activity logging from company detail with AI next action suggestions
  - Dashboard metrics display with seeded data
  - Reminders badge shows count
  - CSV import flow
  - Non-admin/non-sales redirect

## Known Limitations / Future Work

- **No stage history tracking (v1):** Stage changes update `updated_at` but there is no dedicated `opportunity_stage_history` table. Add in v2 if the team needs to analyze time-in-stage or conversion rates between stages.
- **No email/calendar integration:** Activities are manually logged, not auto-captured from Gmail or Google Calendar. Deferred to future phase.
- **No proposal generation:** Deferred. Could auto-generate proposals from company profile and deal stage.
- **No team leaderboard:** Deferred. Per-rep performance metrics for competitive motivation.
- **No company logo auto-fetch:** Deferred. Could pull from a logo API.
- **No quick-add (Cmd+K):** Deferred. Global keyboard shortcut to add deals from anywhere.
- **No win/loss analysis dashboard:** Deferred. Deeper analysis beyond close reasons.
- **No custom fields:** All fields are predefined. If the team needs custom attributes per company or opportunity, add a `custom_fields jsonb` column.
- **No multi-currency:** All values are assumed USD. Add currency field if international deals become relevant.
- **No file attachments:** No proposal PDFs or contract uploads attached to opportunities. Could use Supabase Storage if needed.
- **No duplicate detection:** No automatic detection of duplicate companies (beyond the unique name constraint). Could add fuzzy matching on name + website.
- **AI enrichment uses LLM knowledge only:** No web scraping. Pragmatic choice given the stack. Can add web enrichment later if data staleness is a problem.
- **Email digest for reminders:** In-app only for v1. Email digest requires SMTP setup; deferred.
- **Mobile kanban:** Kanban boards on mobile are tricky. Responsive list view on mobile, kanban on desktop only.
