# Resources Seed Data Instructions

## What This Data Is

`resources_seed_data.json` contains seed data for the new Resources module being added to the existing CRM. It has three collections that map to three new database tables. **The CRM's accounts, deals, roles, and users tables must already be populated before seeding this data** — the resource records reference them by name and need FK resolution.

---

## Data Collections

### `consultants` (13 records)

These are the firm's billable resources, extracted from the spreadsheet's consultant plan notes and closed-won deal references. Each consultant needs TWO records created:
1. A **User** record with `user_role = 'consultant'` (for identity/login)
2. A **Consultant** record linked to that user (for resource-management fields)

Fields:
- `first_name`, `last_name` — use to create the User record
- `function` — `Program`, `Product`, or `Engineering`
- `seniority` — `Junior`, `Mid`, `Senior`, `Principal`, `Director`
- `status` — current state:
  - `Active - Placed` (9 consultants) — currently at a client
  - `Active - Bench` (2) — available, not placed (Simran Kaur, Salil Patel — both rolled off T-Mobile)
  - `Offboarded` (2) — departed the firm (Peter Schenk, Ricardo Lo)
- `current_account` — account name string. **Resolve to `account_id`** by matching against the existing accounts table. Null for bench/offboarded.
- `start_date`, `expected_end_date` — current placement dates. Null for bench/offboarded.
- `skills` — array of strings, store as Postgres text[]
- `location` — freetext
- `notes` — optional context

### `candidates` (3 records)

Potential hires at various stages:
- **Tunde Olanrewaju** — `Hired`, referred for Premera. Should be promoted to consultant if you want to demonstrate the promotion workflow.
- **Callum Ross** — `Screening`, inbound interest for London Stock Exchange Product Team
- **Ana Reyes** — `Rejected`, was being considered for a DirecTV role that closed lost

Fields:
- `target_account` — account name. **Resolve to `account_id`.**
- `skills` — array of strings
- All other fields are straightforward strings/dates

### `assignments` (11 records)

Placement history tying consultants to accounts and deals:
- 9 **Active** assignments (one per placed consultant)
- 2 **Completed** assignments (Simran and Salil's T-Mobile placements that ended 3/30)

Fields:
- `consultant_name` — full name like `"Naveen Kumar"`. **Resolve to `consultant_id`** by matching first+last name against the consultant records you just inserted.
- `account` — account name. **Resolve to `account_id`.**
- `deal_name` — deal name. **Resolve to `deal_id`** by fuzzy matching against the existing deals table (use ILIKE / contains since deal names may not match exactly).
- `actual_end_date` — only set on the 2 completed assignments
- `end_reason` — only set on completed (`Contract End`)
- `bill_rate` — hourly rate as a number

---

## Import Order

1. **Create consultant User records** — for each consultant, insert into users with `user_role = 'consultant'`, capture the user IDs
2. **Insert consultants** — linked to users by `user_id`, resolve `current_account` → `account_id`
3. **Insert candidates** — resolve `target_account` → `account_id`
4. **Insert assignments** — resolve `consultant_name` → `consultant_id`, `account` → `account_id`, `deal_name` → `deal_id`
5. **Set promotion links** — for Tunde (status=Hired), if you created a matching consultant, set the bidirectional FKs

---

## FK Resolution Guide

| Seed field | Target table | Match strategy |
|---|---|---|
| `consultant.current_account` | accounts | Exact match on `accounts.name` |
| `candidate.target_account` | accounts | Exact match on `accounts.name` |
| `assignment.account` | accounts | Exact match on `accounts.name` |
| `assignment.consultant_name` | consultants → users | Match `first_name + ' ' + last_name` against users |
| `assignment.deal_name` | deals | ILIKE / contains match on `deals.name` — deal names in the seed may be substrings of the full deal name in the DB |
