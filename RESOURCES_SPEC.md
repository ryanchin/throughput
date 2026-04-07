# Resources Feature Specification

> **Purpose:** Add a Resource Management module to the existing CRM. This is a new sidebar section called "Resources" that lets the team manage their consultant inventory, track placements and rolloffs, and manage a candidate hiring pipeline. This spec assumes Accounts, Deals, Roles, Actions, and Users tables already exist in the Postgres database.

---

## 1. Overview

The firm places consultants (program managers, product managers, engineers) at client companies. Today the team tracks headcount in a spreadsheet and has no system-level view of who is placed where, when they roll off, who's on the bench, or which candidates are in the hiring pipeline.

The Resources module adds three new database entities (Consultants, Candidates, Assignments), extends the existing Users table, and provides a dedicated sidebar section with views for the team to manage supply (resources) against demand (open roles and deals).

---

## 2. New Database Entities

### 2.1 Consultants

A consultant is a billable resource who can be placed at a client. Every consultant has a corresponding User record (1:1). The User record holds identity (name, email, login). The Consultant record holds resource-management fields.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID / Serial PK | auto | |
| `user_id` | FK → users (unique) | yes | The associated user record. One consultant = one user. |
| `function` | Enum: `Program`, `Product`, `Engineering` | yes | Primary skill area |
| `seniority` | Enum: `Junior`, `Mid`, `Senior`, `Principal`, `Director` | no | Level |
| `skills` | text[] | no | Array of skill tags for search/matching, e.g. `{"Agile","Salesforce","AI/ML"}` |
| `status` | Enum: `Active - Placed`, `Active - Bench`, `On Leave`, `Offboarded` | yes | Current state |
| `current_account_id` | FK → accounts (nullable) | no | Account currently placed at. Null if bench/offboarded. |
| `current_deal_id` | FK → deals (nullable) | no | Deal/engagement currently working under. |
| `start_date` | date | no | Start of current placement |
| `expected_end_date` | date | no | **Critical field.** When current placement ends. Drives rolloff alerts. |
| `bill_rate` | numeric(10,2) | no | Hourly bill rate for current engagement |
| `cost_rate` | numeric(10,2) | no | Internal cost rate |
| `hire_date` | date | no | When they joined the firm |
| `location` | varchar | no | City, "Remote", "Offshore - India", etc. |
| `notes` | text | no | |
| `promoted_from_candidate_id` | FK → candidates (nullable) | no | If hired through the candidate pipeline, links back |
| `created_at` | timestamp | auto | |
| `updated_at` | timestamp | auto | |

### 2.2 Candidates

A potential hire being evaluated. Not a system user until promoted. When hired, a User + Consultant record are created.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID / Serial PK | auto | |
| `first_name` | varchar | yes | |
| `last_name` | varchar | yes | |
| `email` | varchar | no | Contact email |
| `phone` | varchar | no | |
| `function` | Enum: `Program`, `Product`, `Engineering` | yes | What they'd do |
| `seniority` | Enum: `Junior`, `Mid`, `Senior`, `Principal`, `Director` | no | Assessed level |
| `skills` | text[] | no | Skill tags for matching against open roles |
| `status` | Enum (see §3.2) | yes | Pipeline stage |
| `source` | varchar | no | `Referral`, `LinkedIn`, `Agency - Sankalp`, `Inbound`, `Recruiter`, etc. |
| `target_role_id` | FK → roles (nullable) | no | The open role they're being considered for |
| `target_account_id` | FK → accounts (nullable) | no | Account they'd be placed at |
| `resume_url` | varchar | no | Link to resume |
| `interview_notes` | text | no | Accumulated feedback |
| `date_added` | date | yes | When they entered the pipeline |
| `promoted_to_consultant_id` | FK → consultants (nullable) | no | Set when promoted. Null while still a candidate. |
| `notes` | text | no | |
| `created_at` | timestamp | auto | |
| `updated_at` | timestamp | auto | |

**Promotion workflow** — when a candidate is hired:
1. Create a User record (`first_name`, `last_name`, `email` from candidate; `user_role = 'consultant'`)
2. Create a Consultant record linked to that user (copy `function`, `seniority`, `skills` from candidate)
3. Set `candidate.promoted_to_consultant_id` → new consultant
4. Set `consultant.promoted_from_candidate_id` → candidate
5. If the candidate had a `target_role_id` and `target_account_id`, optionally create a Planned assignment

### 2.3 Assignments

Placement history — every time a consultant is placed at a client, an assignment record is created. Past, current, and planned placements all live here. The consultant's `current_account_id` and `expected_end_date` are denormalized snapshots of the active assignment.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID / Serial PK | auto | |
| `consultant_id` | FK → consultants | yes | The placed resource |
| `account_id` | FK → accounts | yes | Client |
| `deal_id` | FK → deals (nullable) | no | The deal/engagement this falls under |
| `role_id` | FK → roles (nullable) | no | The role this fills |
| `start_date` | date | yes | Placement start |
| `expected_end_date` | date | no | Planned rolloff — **key for capacity planning** |
| `actual_end_date` | date | no | When they actually left. Null if still active. |
| `bill_rate` | numeric(10,2) | no | Rate for this specific assignment |
| `status` | Enum: `Planned`, `Active`, `Completed`, `Cancelled` | yes | |
| `end_reason` | Enum (see §3.4) | no | Only for completed/cancelled |
| `notes` | text | no | |
| `created_at` | timestamp | auto | |
| `updated_at` | timestamp | auto | |

---

## 3. Enumerations

### 3.1 Consultant Status
| Value | Description |
|---|---|
| `Active - Placed` | Currently on a client engagement |
| `Active - Bench` | Available, waiting for placement |
| `On Leave` | Temporarily unavailable |
| `Offboarded` | No longer with the firm |

### 3.2 Candidate Status
| Value | Description |
|---|---|
| `New` | Just entered the pipeline |
| `Screening` | Being reviewed / phone screen |
| `Interviewing` | In active interviews |
| `Offer Extended` | Offer made, awaiting response |
| `Hired` | Accepted — promote to consultant |
| `Rejected` | Did not pass |
| `Withdrawn` | Candidate pulled out |

### 3.3 Assignment Status
| Value |
|---|
| `Planned` |
| `Active` |
| `Completed` |
| `Cancelled` |

### 3.4 Assignment End Reason
| Value |
|---|
| `Contract End` |
| `Client Request` |
| `Consultant Resignation` |
| `Replaced` |
| `Project Cancelled` |
| `Mutual Agreement` |

### 3.5 Consultant Seniority
| Value |
|---|
| `Junior` |
| `Mid` |
| `Senior` |
| `Principal` |
| `Director` |

### 3.6 Consultant / Candidate Function
Reuse the existing Role function values:
| Value |
|---|
| `Program` |
| `Product` |
| `Engineering` |

---

## 4. Changes to Existing Tables

### 4.1 Users Table
Add a `user_role` column if it doesn't exist:

| Value | Description |
|---|---|
| `admin` | System admin |
| `staff` | Internal team (Zach, Marley, etc.) |
| `consultant` | Billable resource — has a linked Consultant record |

If the users table doesn't have a `user_role` column, add it with a default of `'staff'` and backfill existing users as `'staff'`.

### 4.2 Roles Table
No schema change, but the Roles entity is now linked FROM candidates (`candidate.target_role_id → roles.id`) and assignments (`assignment.role_id → roles.id`). These are new FK references pointing at the existing roles table.

### 4.3 Existing KPIs
The dashboard should add these KPIs (alongside the existing ones):

| KPI | Query |
|---|---|
| **On Bench** | `COUNT(*) FROM consultants WHERE status = 'Active - Bench'` |
| **Rolling Off (30d)** | `COUNT(*) FROM assignments WHERE status = 'Active' AND expected_end_date BETWEEN now() AND now() + interval '30 days'` |
| **Rolling Off (60d)** | Same but 60 days |
| **Unfilled Roles** | `COUNT(*) FROM roles WHERE status = 'Open' AND target_fill_date < now()` |
| **Active Candidates** | `COUNT(*) FROM candidates WHERE status IN ('Screening','Interviewing','Offer Extended')` |

---

## 5. Resources Sidebar Section — UI Views

The Resources section is a **separate top-level sidebar item** with its own icon (people/team icon). It contains these sub-pages:

### 5.1 Roster (default view)
- All consultants with: name, function, seniority, status, current account, expected end date, location
- Filterable by: status, function, account, seniority
- Sortable by: expected end date, name, account
- Row color-coding: green = placed, yellow = bench, gray = offboarded
- Click name → consultant detail page (profile + placement history)

### 5.2 Rolloffs
- Active assignments ending within 60 days, sorted soonest first
- Columns: consultant name, account, deal, expected end date, days until rolloff
- Rows < 30 days highlighted amber
- This is the **most critical operational view** — used to plan backfills

### 5.3 Bench
- Consultants with status `Active - Bench`
- Columns: name, function, seniority, skills, days on bench (from last assignment actual_end_date), last account
- Sorted by days on bench descending

### 5.4 Role Matching
- Left: open roles (from existing Roles table, `status = 'Open'`) with role name, function, account, target fill date, days overdue
- Right: bench consultants whose function matches, sorted by skill tag overlap
- Purpose: quickly match available resources to open client needs

### 5.5 Candidates
- All candidates, grouped by status with active statuses at top (Screening → Interviewing → Offer Extended), then Hired/Rejected/Withdrawn
- Columns: name, function, target role, target account, source, date added, days in pipeline
- **"Promote to Consultant" button** on rows with `status = 'Hired'` — triggers the promotion workflow from §2.2

### 5.6 Capacity Summary (dashboard-style cards)

| Metric | Query |
|---|---|
| Total Active | `COUNT(*) FROM consultants WHERE status LIKE 'Active%'` |
| Currently Placed | `COUNT(*) WHERE status = 'Active - Placed'` |
| On Bench | `COUNT(*) WHERE status = 'Active - Bench'` |
| Rolling Off 30d | `COUNT(*) FROM assignments WHERE status='Active' AND expected_end_date <= now()+30d` |
| Rolling Off 60d | Same, 60d |
| Open Roles | `COUNT(*) FROM roles WHERE status = 'Open'` |
| Overdue Roles | `COUNT(*) FROM roles WHERE status = 'Open' AND target_fill_date < now()` |
| Active Candidates | `COUNT(*) FROM candidates WHERE status IN ('Screening','Interviewing','Offer Extended')` |

---

## 6. API Endpoints Needed

These are the backend endpoints the UI views require. Adapt to whatever framework the CRM uses (REST, tRPC, etc.):

| Method | Path | Description |
|---|---|---|
| GET | `/api/consultants` | List all, with filters (status, function, account) |
| GET | `/api/consultants/:id` | Detail with current assignment + history |
| POST | `/api/consultants` | Create (also creates User with `user_role='consultant'`) |
| PUT | `/api/consultants/:id` | Update |
| GET | `/api/consultants/rolloffs` | Active assignments ending within N days (query param) |
| GET | `/api/consultants/bench` | Bench consultants with days-on-bench computed |
| GET | `/api/consultants/capacity` | Capacity summary metrics |
| GET | `/api/candidates` | List all, with filters (status) |
| GET | `/api/candidates/:id` | Detail |
| POST | `/api/candidates` | Create |
| PUT | `/api/candidates/:id` | Update |
| POST | `/api/candidates/:id/promote` | Promote to consultant (creates User + Consultant, sets FKs) |
| GET | `/api/assignments` | List, filterable by consultant, account, status |
| POST | `/api/assignments` | Create |
| PUT | `/api/assignments/:id` | Update (e.g., set actual_end_date) |
| GET | `/api/roles/matching` | Open roles with matching bench consultants |
