# Feature: Resources Module

**Status:** Complete
**Zone:** admin (CRM)
**Last Updated:** 2026-04-07

## Overview

Resource Management module for the CRM that lets the team manage their consultant inventory, track placements and rolloffs, and manage a candidate hiring pipeline. Consultants are billable resources placed at client companies. The module provides operational visibility into who is placed where, when they roll off, who's on the bench, and which candidates are in the hiring pipeline.

The Resources section is a dedicated sidebar group visible to admin and sales roles, with sub-pages for Roster, Rolloffs, Bench, Candidates, and Capacity.

## Business Logic

### Entity Model

```
Consultant (1:1 with User/Profile)
  |- function: Program | Product | Engineering
  |- seniority: Junior | Mid | Senior | Principal | Director
  |- status: Active - Placed | Active - Bench | On Leave | Offboarded
  |- current_account_id → crm_companies
  |- current_deal_id → crm_opportunities
  |- Assignments (0..n, placement history)

Candidate (potential hire, not a system user)
  |- status: New | Screening | Interviewing | Offer Extended | Hired | Rejected | Withdrawn
  |- target_role_id → crm_roles
  |- target_account_id → crm_companies
  |- Can be promoted to Consultant (creates User + Consultant + bidirectional FKs)

Assignment (placement record linking consultant to account/deal)
  |- status: Planned | Active | Completed | Cancelled
  |- Tracks start_date, expected_end_date, actual_end_date, bill_rate
```

### Promotion Workflow

When a candidate with status 'Hired' is promoted:
1. Create an auth user + profile with `user_role = 'consultant'`
2. Create a consultant record (copies function, seniority, skills from candidate)
3. Set `candidate.promoted_to_consultant_id` → new consultant
4. Set `consultant.promoted_from_candidate_id` → candidate
5. If target_account exists, set as `current_account_id`

### Auto-Role Creation on Deal Close

When a deal moves to "7a. Closed Won" in the pipeline, a modal prompts the user to create roles for the Resources team. Roles are bulk-created as `crm_roles` records linked to the deal's account with status 'Open'. These immediately appear in the Capacity dashboard and Role Matching view.

### Capacity Metrics

| Metric | Definition |
|--------|-----------|
| Total Active | Consultants where status starts with 'Active' |
| Currently Placed | status = 'Active - Placed' |
| On Bench | status = 'Active - Bench' |
| Rolling Off 30d | Active assignments ending within 30 days |
| Rolling Off 60d | Active assignments ending within 60 days |
| Open Roles | crm_roles where status = 'Open' |
| Overdue Roles | Open roles past target_fill_date |
| Active Candidates | Candidates in Screening, Interviewing, or Offer Extended |

## Technical Details

### Database Tables

Three new tables added via migration `20260407000002_resources_tables.sql`:

- **crm_consultants** — user_id (unique FK → profiles), function, seniority, skills, status, current_account_id, current_deal_id, start_date, expected_end_date, bill_rate, cost_rate, hire_date, location, promoted_from_candidate_id
- **crm_candidates** — first_name, last_name, email, phone, function, seniority, skills, status, source, target_role_id, target_account_id, resume_url, interview_notes, date_added, promoted_to_consultant_id
- **crm_assignments** — consultant_id, account_id, deal_id, role_id, start_date, expected_end_date, actual_end_date, bill_rate, status, end_reason

Also added `user_role` column to profiles (admin/staff/consultant, default 'staff').

All tables use CHECK constraints (not Postgres enums), RLS (admin+sales read/write, admin-only delete), updated_at triggers, and appropriate indexes.

### API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/admin/crm/consultants` | List with filters (status, function, account) |
| GET | `/api/admin/crm/consultants/:id` | Detail with assignments history |
| POST | `/api/admin/crm/consultants` | Create (also creates auth user) |
| PATCH | `/api/admin/crm/consultants/:id` | Update |
| GET | `/api/admin/crm/consultants/rolloffs` | Active assignments ending within N days |
| GET | `/api/admin/crm/consultants/bench` | Bench consultants with days_on_bench |
| GET | `/api/admin/crm/consultants/capacity` | Capacity summary metrics |
| GET/POST | `/api/admin/crm/candidates` | List + Create |
| GET/PATCH | `/api/admin/crm/candidates/:id` | Detail + Update |
| POST | `/api/admin/crm/candidates/:id/promote` | Promote to consultant |
| GET/POST | `/api/admin/crm/assignments` | List + Create |
| GET/PATCH | `/api/admin/crm/assignments/:id` | Detail + Update |
| GET | `/api/admin/crm/roles/matching` | Open roles with matching bench consultants |
| GET/POST | `/api/admin/crm/roles` | List + Bulk create roles |

### Frontend Pages

| Path | Description |
|------|-------------|
| `/admin/crm/resources` | Roster — all consultants with filters, status-colored rows |
| `/admin/crm/resources/rolloffs` | Upcoming rolloffs within 60 days |
| `/admin/crm/resources/bench` | Bench consultants with days on bench, skills chips |
| `/admin/crm/resources/candidates` | Candidate pipeline grouped by status, promote button |
| `/admin/crm/resources/capacity` | 8 capacity metric cards |
| `/admin/crm/resources/:id` | Consultant detail with placement card + assignment history |

### Key Components

- `RosterTable.tsx` — 3 filter dropdowns, client-side sort, status-colored rows
- `RolloffTable.tsx` — 60-day window, amber highlight for <30d
- `BenchTable.tsx` — skills chips, days on bench, last account
- `CandidatesList.tsx` — grouped sections, promote button
- `CapacityDashboard.tsx` — 8 stat cards with conditional warning borders
- `ConsultantDetail.tsx` — header, current placement, assignment history table
- `CreateRolesModal.tsx` — bulk role creation on deal close

## Task Checklist

- [x] Database migration (consultants, candidates, assignments tables)
- [x] Seed script + data (13 consultants, 3 candidates, 11 assignments)
- [x] Consultant API (CRUD + rolloffs + bench + capacity)
- [x] Candidate API (CRUD + promote workflow)
- [x] Assignment API (CRUD)
- [x] Role matching API
- [x] Roles API (list + bulk create)
- [x] Roster page + RosterTable component
- [x] Rolloffs page + RolloffTable component
- [x] Bench page + BenchTable component
- [x] Candidates page + CandidatesList component
- [x] Capacity page + CapacityDashboard component
- [x] Consultant detail page + ConsultantDetail component
- [x] Sidebar: Resources section with 5 sub-pages
- [x] Auto-role creation on deal close (CreateRolesModal)
- [x] TypeScript types + Zod schemas + constants

## Test Coverage

- Integration tests via API endpoint verification (all endpoints tested via node scripts with authenticated sessions)
- Schema validation tested as part of task-management test suite

## Known Limitations / Future Work

- Rolloff auto-tasks deferred (auto-create "Plan backfill" when consultant within 30d of rolloff)
- No consultant utilization rate tracking
- No bill rate history (only current rate stored)
- No interview scheduling integration
- No resume parsing/AI screening for candidates
- Role matching is function-based only (no skill-level matching beyond count)
