# Seed Data Instructions for Claude Code

## What This Data Is

This seed data (`seed_data.json`) represents the complete operating dataset from an Excel-based CRM dashboard used by a professional-services/consulting firm. It was the primary system of record before the CRM was built. **All of this data should be imported into the Postgres database so the CRM launches with real, production data rather than starting empty.**

The firm places consultants (program managers, product managers, engineers) at client companies. The data tracks the full business cycle: client accounts → sales pipeline deals → hiring/recruiting for roles → action items for follow-through → weekly headcount planning.

---

## File Structure

`seed_data.json` contains these top-level keys:

### `users` (array of strings)
The 6 team members who appear as owners across all entities: `Zach`, `Marley`, `Ameet`, `Joanne`, `Myra`, `Ryan`. Create user records for each. These are referenced by first name throughout all other entities.

### `config` (object)
Global planning parameters. Store in a settings/config table or equivalent:
- `target_date` — end of the current planning period (Q2 end)
- `current_consultant_count` — active consultants today
- `target_consultant_count` — hiring goal by target_date
- `monthly_attrition_pct` — expected monthly churn rate (0.02 = 2%)
- `avg_onboarding_ramp_weeks` — weeks for a new hire to become productive

### `accounts` (array of 35 objects)
Client companies. Each has:
- `name` — company name (unique, use as natural key for linking)
- `segment` — tier classification: `Flagship`, `Existing`, `Small`, `Nitor`, `Large`, `International`, or null
- `parent_customer` — boolean; true means this account is a parent entity with sub-deals
- `arr` — annual recurring revenue in dollars, null if unknown
- `health` — `G` (green/healthy), `Y` (yellow/at-risk), `R` (red/critical), or null
- `champion` — freetext with internal owner name and/or client contact email. Format varies: `"Zach Usher,#zachu@moodysnwc.com"` or just `"Ameet, Marley"`. **Consider splitting into an owners join table (FK to users) and client_champion_contact (string) during import.**
- `top_risk`, `next_action` — freetext fields for current status
- `owners` — array of user names for this account

### `deals` (array of 52 objects)
Sales pipeline opportunities. Each is tied to an account by `account` (matches `accounts[].name`). Key fields:
- `name` — deal description/title
- `account` — FK to accounts by name. **Resolve to account_id during import.**
- `agentic_type` — `AAVA`, `Non-Agentic`, `Agentic, Non-Aava`, or null. Classifies AI vs traditional work.
- `source` — `Parent` (expansion), `Moodys New` (new biz), `Nitor` (partner channel), or null
- `stage` — ordered pipeline stage (see spec §3.4 for full list). Values like `1. Inquiry`, `7a. Closed Won`, etc.
- `probability` — win probability 0.0–1.0. Should default from stage if not set.
- `est_value_annualized` — annual dollar value, null if TBD
- `weighted_value` — est_value × probability (precomputed, but CRM should derive it)
- `target_close_date`, `actual_close_date` — date strings YYYY-MM-DD or null
- `owners` — array of user names (already parsed from delimiters). **Create a join-table record for each user.** Example: `["Zach", "Marley"]`
- `stalled` — boolean flag for deals with no activity in 7+ days

### `roles` (array of 22 objects)
Open positions being recruited for. Implicitly tied to accounts via the role name (e.g., `"Premera AI Architect"` → Premera account). Key fields:
- `name` — role title, often prefixed with client name
- `function` — `Program`, `Product`, or `Engineering`
- `status` — `Open`, `Filled`, `Filled- External`, `Fulfilled`, `Cancelled`
- `role_stage` — recruiting funnel stage (see spec §3.7). Values like `1. Sourcing`, `3. Client Interviews`, etc.
- `days_open` — was computed as today minus open_date in the spreadsheet. **CRM should compute this dynamically, not store it.** The value here is a snapshot for reference only.

### `actions` (array of 37 objects)
Follow-up tasks and commitments. Each references a deal, account, or role via `related_item` (freetext match). Key fields:
- `related_item` — freetext like `"HP"`, `"Microsoft Product PMO"`, `"Starbucks POC"`. **During import, attempt to resolve to a deal_id, account_id, or role_id by matching against names. If ambiguous, link to the account.**
- `category` — `Follow-up`, `Meeting`, `Task`, or `Presentation`
- `status` — already normalized: `Completed`, `In Progress`, `Not Started`, `On Hold`
- `priority` — 1 (high) or 2 (medium), often null

### `consultant_plan` (array of 22 objects)
Weekly headcount tracking rows. Each represents one week:
- `week_start` — Monday date
- `starting_hc`, `hires`, `attrition`, `ending_hc` — headcount flow
- `notes` — freetext explaining who joined/left and from which client (e.g., `"MSFT Planned (+11)\nDTV Planned (+1)"`)

The `target_hc` and `gap` columns from the spreadsheet are **computed** from the config values and should not be stored — calculate them at query time using linear interpolation from current to target over the remaining weeks.

---

## Import Order (for FK integrity)

1. **Users** — create user records first
2. **Config** — insert global settings
3. **Accounts** — no dependencies
4. **Deals** — depends on Accounts (resolve `account` → `account_id`)
5. **Roles** — optionally link to Accounts by parsing client name from role name
6. **Actions** — depends on all above (resolve `related_item` to the best matching entity)
7. **Consultant Plan** — standalone time-series, no FKs

---

## Data Cleanup Applied

The following normalizations have already been applied in this seed file (vs the raw Excel):
- `Amy` → `Joanne` across all owner/champion fields
- Action statuses normalized (`Complete`/`Completed` → `Completed`, `HOLD` → `On Hold`)
- `TBD` currency values → `null`
- Garbage data in health field (e.g., `o0-;kl0-lo0`) → `null`
- Empty placeholder rows stripped
- Embedded reference-data columns (stage→probability lookup, segment legend) excluded — those are in the functional spec as configuration

## What Still Needs Cleanup During Import

- **Multi-owner fields** are already parsed into arrays in the seed data. During import, match each name to a user record and insert into the appropriate join table (`deal_owners`, `role_owners`, `action_owners`, `account_owners`)
- **Champion field** mixing internal names with email addresses — split if the schema has separate fields
- **Role→Account linking** — parse account name from role name prefix (e.g., `"DTV Marketing Analyst"` → DirecTV, `"MSFT MSP Pgm Role 1"` → MSFT)
- **Action→entity linking** — fuzzy-match `related_item` against deal names, account names, and role names
