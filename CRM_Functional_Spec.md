# CRM Functional Specification — LT Dashboard Migration

> **Purpose:** This document describes every data entity, field, enumeration, relationship, and reporting requirement extracted from the `LT_Dashboard_-_New.xlsx` workbook. Use it to validate that the CRM schema captures all necessary data and that reporting features reproduce every view from the original spreadsheet.

---

## 1. System Overview

The spreadsheet is a **Revenue & Account Health Operating Dashboard** for a professional-services / consulting firm. It tracks five core entities — Accounts, Deals, Roles (hiring pipeline), Actions (follow-up tasks), and a weekly Consultant Headcount Plan — plus a real-time dashboard of KPIs and pipeline views. The business runs a weekly operating cadence where leadership reviews exceptions (at-risk accounts, stalled deals, overdue actions) and logs commitments.

---

## 2. Data Entities & Field Definitions

### 2.1 Accounts

Represents a client company. This is the parent entity that Deals, Roles, and Actions reference.

| Field | Type | Description | Example Values |
|---|---|---|---|
| **Account ID** | Auto / UUID | Unique identifier (was blank in spreadsheet — CRM should generate) | — |
| **Account Name** | String (required) | Company name | `Premera`, `T-Mobile`, `MSFT` |
| **Segment** | Enum | Tiering of the account by size/strategic value. See §3.1 for allowed values. | `Flagship`, `Existing`, `Small`, `Nitor`, `Large`, `International` |
| **Parent Customer?** | Boolean (Y/N) | Whether this account is a parent entity (i.e., the deals under it may come through sub-entities or partners like Nitor). Nearly all are `Y`. | `Y`, `N` |
| **ARR / Revenue** | Currency (nullable) | Current annualized recurring revenue from this account. May be `0`, a dollar amount, or `TBD` (treat TBD as null). | `6156000`, `288000`, `TBD`, `0` |
| **Health (G/Y/R)** | Enum (nullable) | Red / Yellow / Green health score. Null means not yet assessed. | `G`, `Y`, `R` |
| **Renewal Date** | Date (nullable) | Next contract renewal date. Sparse in current data. | — |
| **Champion** | String (nullable) | Internal owner(s) and/or champion contact info. Format is freetext, often `Name,#email` or just names. | `Zach Usher,#zachu@moodysnwc.com`, `Ameet, Marley` |
| **Expansion Potential ($)** | Currency (nullable) | Estimated upsell / expansion dollar value. Currently unpopulated for most rows. | — |
| **Next Exec Touch Date** | Date (nullable) | Date of next planned executive-level interaction. | — |
| **Last Meaningful Touch** | Date (nullable) | Date of last significant client engagement. | — |
| **Top Risk** | String (nullable) | Freetext describing the primary risk to the account relationship. | `CPO to CIO Reorg` |
| **Next Action** | String (nullable) | Freetext next step for this account. | `Confirm end` |
| **Owners** | Many-to-many → Users | One or more internal account owners. Stored as a join table (e.g., `account_owners`). In the spreadsheet these appeared as comma- or ampersand-separated names like `Zach & Marley`. | `[Ameet]`, `[Zach, Joanne]` |

**Notes for CRM mapping:** The `Champion` field mixes internal owners with contact info — consider splitting into an `Owners` join table (FK to Users) and `Client Champion` (FK to Contacts). The `Segment` definitions are documented in a sidebar legend in the spreadsheet (see §3.1).

---

### 2.2 Deals (Pipeline)

Represents a sales opportunity tied to an Account. This is the most field-rich entity.

| Field | Type | Description | Example Values |
|---|---|---|---|
| **Deal ID** | Auto / UUID | Unique identifier (blank in sheet — CRM should generate) | — |
| **Deal Name** | String (required) | Descriptive name of the opportunity. Often includes the role type or project scope. | `Microsoft - Product Launch PMO`, `Starbucks POC`, `PgM Staff Aug` |
| **Account** | FK → Accounts | The client this deal is for. | `Premera`, `MSFT`, `Amazon` |
| **Agentic Type** | Enum (nullable) | Classifies whether this is an AI/agentic engagement. See §3.2. | `AAVA`, `Non-Agentic`, `Agentic, Non-Aava` |
| **Segment** | Enum (nullable) | Mirrors account segment but can be set at deal level. Often blank (inherits from account). | — |
| **Deal Type** | Enum (nullable) | Size classification of the deal. | `Large` (only observed value; most are blank) |
| **Source** | Enum (nullable) | How the deal originated. See §3.3. | `Parent`, `Moodys New`, `Nitor` |
| **Est Value ($) — Annualized** | Currency (nullable) | Estimated annual value. Can be `TBD` (treat as null) or `0` for early-stage / exploratory deals. | `2000000`, `300000`, `TBD`, `0` |
| **Stage** | Enum (required) | Current pipeline stage. See §3.4 for the full ordered list. | `1. Inquiry`, `3. Qualification`, `7a. Closed Won` |
| **Probability** | Decimal 0–1 | Win probability. In the spreadsheet this was assigned per-stage but could be overridden per-deal. | `0`, `0.1`, `0.2`, `0.5`, `0.8`, `1` |
| **Weighted Value** | Currency (computed) | `Est Value × Probability`. | `400000` |
| **Target Close Date** | Date (nullable) | When the deal is expected to close. | `2026-02-27` |
| **Value Prorated by Date** | Currency (computed) | Prorates the annualized value based on how much of the fiscal year remains from the target close date. Formula: `Est Value × (days remaining in FY from close date / 365)`. | `1233315.07` |
| **Actual Close Date** | Date (nullable) | Populated only for closed deals (Won or Lost). | `2026-01-26` |
| **Last Activity Date** | Date (nullable) | Timestamp of the most recent action or update on this deal. | — |
| **Next Step** | Text (nullable) | Freetext description of the immediate next action. Can be quite long/detailed. | `SoW Routed, Awaiting Feedback, follow up` |
| **Next Step Date** | Date (nullable) | When the next step is due. | `2026-02-10` |
| **Owners** | Many-to-many → Users | Deal owner(s). Stored as a join table (e.g., `deal_owners`). Parse values like `Zach & Marley` into multiple user FKs. | `[Zach]`, `[Zach, Marley]` |
| **Stalled? (7d)** | Enum (nullable) | Flag for deals with no activity in 7+ days. | `Yes` (or blank) |
| **CEO Ask** | Text (nullable) | Escalation notes for CEO involvement. Mostly blank. | — |

**Additional columns observed (cols 20–22):** These appear to be a reference/lookup table embedded in the Deals sheet, mapping stages to default probabilities. They contain: `Stage name`, `Probability`, and possibly `Last Modified` timestamps. The CRM should store the stage→probability mapping as configuration (see §3.4) rather than inline data.

---

### 2.3 Roles (Hiring Pipeline)

Tracks open positions being recruited for, tied to client accounts.

| Field | Type | Description | Example Values |
|---|---|---|---|
| **Role ID** | Auto / UUID | Unique identifier (blank in sheet) | — |
| **Role Name** | String (required) | Title/description of the position | `DTV Marketing Analyst`, `Premera AI Architect` |
| **Function** | Enum | Department/discipline. See §3.5. | `Program`, `Product`, `Engineering` |
| **Priority** | Integer | 1 = highest priority, 2 = lower | `1`, `2` |
| **Status** | Enum | Current state of the role. See §3.6. | `Open`, `Filled`, `Cancelled`, `Fulfilled`, `Filled- External` |
| **Open Date** | Date (nullable) | When the role was opened | `2025-10-27` |
| **Target Fill Date** | Date (nullable) | Desired fill-by date | `2026-02-15` |
| **Owners** | Many-to-many → Users | Recruiter(s) or hiring manager(s) responsible. Stored as a join table (e.g., `role_owners`). | `[Zach]`, `[Joanne, Marley]` |
| **Role Stage** | Enum | Recruiting funnel stage. See §3.7. | `1. Sourcing`, `3. Client Interviews`, `7. Pending Start Date Confirm` |
| **Next Step** | Text (nullable) | Freetext next action | — |
| **Next Step Due** | Date (nullable) | Due date for next step | — |
| **Days Open** | Integer (computed) | `Today - Open Date`. Auto-calculated. | `161`, `83`, `52` |
| **Blocker** | Text (nullable) | Freetext describing what's blocking progress | `Confirming DTV marketing team is interested` |
| **Notes** | Text (nullable) | General notes | — |

**Note:** Column 15 in the sheet contains stage labels that appear to be a reference list for the Role Stage dropdown (see §3.7). This should be configuration in the CRM, not a data column.

---

### 2.4 Actions (Task Tracker)

A centralized follow-up log. Each action can reference a Deal, Account, or Role.

| Field | Type | Description | Example Values |
|---|---|---|---|
| **Action ID** | Auto / UUID | Unique identifier | — |
| **Date Added** | Date | When the action was created | `2026-02-04` |
| **Category** | Enum | Type of action. See §3.8. | `Follow-up`, `Meeting`, `Task`, `Presentation`, `Follow-Up` (note inconsistent casing) |
| **Related Item** | String / FK | Freetext reference to a Deal, Account, or Role name. In CRM this should be a polymorphic FK or multiple nullable FKs (to Deal, Account, Role). | `HP`, `Microsoft Product PMO`, `Starbucks POC`, `Recruiting Sync` |
| **Description** | Text | What needs to be done | `Follow-up with Akash on HP next steps` |
| **Owners** | Many-to-many → Users | Person(s) responsible. Stored as a join table (e.g., `action_owners`). Parse values like `Zach & Myra` or `Marley/Ryan` into multiple user FKs. | `[Marley]`, `[Marley, Ryan]`, `[Zach, Myra]` |
| **Due Date** | Date (nullable) | When it's due | `2026-02-05` |
| **Status** | Enum | See §3.9. Note: the spreadsheet uses inconsistent casing (`Complete` vs `Completed`, `HOLD`). CRM should normalize. | `Complete`, `Completed`, `In Progress`, `Not Started`, `HOLD` |
| **Priority** | Integer (nullable) | 1 = high, 2 = medium. Often blank. | `1`, `2` |
| **Notes** | Text (nullable) | Additional context, outcomes, follow-up details | `Feedback provided to Yair, closed w/ Somyo` |

---

### 2.5 Consultant Growth Plan (Weekly Headcount Tracker)

A time-series planning table tracking weekly consultant headcount against targets. This is more of a planning/forecasting tool than a transactional entity.

| Field | Type | Description | Example Values |
|---|---|---|---|
| **Week Start** | Date (PK) | Monday of each tracking week | `2026-02-02` |
| **Starting HC** | Integer | Headcount at start of week | `47`, `59` |
| **Hires** | Integer (nullable) | New hires that week. Null = 0 (no planned hires). | `3`, `12`, `17` |
| **Attrition** | Integer | Departures that week | `0`, `1`, `2`, `16` |
| **Ending HC** | Integer (computed) | `Starting HC + Hires - Attrition` | `45`, `59`, `62` |
| **Target HC** | Decimal (computed) | Linear interpolation from current HC to target HC over the remaining weeks. | `48.41`, `100.33` |
| **Gap** | Decimal (computed) | `Target HC - Ending HC` | `3.41`, `41.33` |
| **Notes** | Text (nullable) | Freetext explaining who joined/left and from which account | `MSFT Planned (+11)\nDTV Planned (+1)`, `TMO lost (-17)\nPremera (17)` |

---

### 2.6 Setup / Configuration

Global parameters that drive dashboard calculations.

| Field | Type | Description | Current Value |
|---|---|---|---|
| **Today** | Date | Current date (auto or manual) | `2026-04-06` |
| **Target Date** | Date | End of planning period | `2026-06-30` |
| **Current Consultant Count** | Integer | Active consultants today | `45` |
| **Target Consultant Count** | Integer | Goal by target date | `120` |
| **Monthly Attrition Assumption** | Decimal (%) | Expected monthly attrition rate | `2%` |
| **Avg Onboarding Ramp (weeks)** | Integer | Weeks to full productivity | `4` |

**Derived Metrics (computed from above):**
- `Weeks Remaining` = `(Target Date - Today) / 7`
- `Consultant Gap` = `Target - Current`
- `Net Adds Needed / Week` = `Gap / Weeks Remaining`
- `Gross Hires Needed / Week` = `Net Adds / (1 - weekly attrition)`

---

## 3. Enumerations & Reference Data

### 3.1 Account Segments
Per the legend in the Accounts sheet:

| Value | Description |
|---|---|
| `Flagship` | Large accounts with strong current momentum |
| `Existing` | Current active accounts |
| `Nitor` | Accounts sourced through Nitor partnership |
| `Small` | Smaller-scale engagements |
| `Large` | Large potential but not yet flagship |
| `International` | Non-US accounts |

### 3.2 Agentic Type (Deal)
| Value | Description |
|---|---|
| `AAVA` | AI / Agentic (AAVA product line) |
| `Non-Agentic` | Traditional consulting engagement |
| `Agentic, Non-Aava` | AI/agentic work but not using AAVA product |

### 3.3 Deal Source
| Value | Description |
|---|---|
| `Parent` | Expansion from existing parent customer relationship |
| `Moodys New` | New business originated by Moodys team |
| `Nitor` | Deal sourced through Nitor partner channel |

### 3.4 Deal Stages (Ordered Pipeline)

These follow a numbered sales process. The spreadsheet also embeds a default probability per stage (found in cols 20–22 of the Deals sheet):

| Stage | Default Probability | Description |
|---|---|---|
| `1. Inquiry` | 0 | Initial interest, no qualification yet |
| `2. Investigation & Analysis` | 0.1 | Actively exploring the opportunity |
| `3. Qualification` | 0.2 | Confirmed fit, scoping underway |
| `4. Proposal Creation` | 0.3 | Writing the proposal |
| `5. Proposal Presentation` | 0.5 | Proposal delivered to client |
| `6. Negotiation/ Review` | 0.8 | Terms being negotiated |
| `7a. Closed Won` | 1 | Deal won |
| `7b. Closed Lost` | 0 | Deal lost |
| `7c. Shelf` | 0 | Deferred / on hold indefinitely |

### 3.5 Role Function
| Value |
|---|
| `Program` |
| `Product` |
| `Engineering` |

### 3.6 Role Status
| Value | Description |
|---|---|
| `Open` | Actively recruiting |
| `Filled` | Filled with internal candidate |
| `Filled- External` | Filled with external candidate |
| `Fulfilled` | Role need met (may differ from Filled) |
| `Cancelled` | Role no longer needed |

### 3.7 Role Stages (Recruiting Funnel)
| Stage |
|---|
| `1. Sourcing` |
| `2. Internal Interview` |
| `3. Client Interviews` |
| `4. Final Interview` |
| `5. Offer Extended` |
| `6a. Offer Accepted` |
| `6b. Offer Rejected` |
| `7. Pending Start Date Confirm` |
| `8. Start Date Confirmed` |
| `9. Active, Billing` |

### 3.8 Action Categories
| Value |
|---|
| `Follow-up` |
| `Meeting` |
| `Task` |
| `Presentation` |

**Note:** The spreadsheet has inconsistent casing (`Follow-up` vs `Follow-Up`). Normalize in the CRM.

### 3.9 Action Statuses
| Value | Normalized Form |
|---|---|
| `Complete` | `Completed` |
| `Completed` | `Completed` |
| `In Progress` | `In Progress` |
| `Not Started` | `Not Started` |
| `HOLD` | `On Hold` |

---

## 4. Relationships

```
Account  1 ←——→ N  Deal        (Account.name = Deal.account)
Account  1 ←——→ N  Role        (implicit via Role.role_name containing account name)
Account  1 ←——→ N  Action      (via Action.related_item matching account name)
Deal     1 ←——→ N  Action      (via Action.related_item matching deal name)
Role     1 ←——→ N  Action      (via Action.related_item matching role name)
```

**Important:** In the spreadsheet, relationships are maintained by freetext name matching. The CRM must use proper foreign keys. The `Action.related_item` is polymorphic — it can reference a Deal, Account, or Role. Consider either a polymorphic association pattern or three nullable FK columns (`deal_id`, `account_id`, `role_id`).

---

## 5. Dashboard KPIs & Reporting Requirements

The Dashboard sheet is a **read-only computed view**. The CRM must be able to produce all of these metrics.

### 5.1 Top-Level KPIs

| KPI | Source / Formula |
|---|---|
| **Current Consultants** | From Setup: `current_consultant_count` |
| **Target (by date)** | From Setup: `target_consultant_count` |
| **Gap** | `Target - Current` |
| **Weeks Remaining** | `(target_date - today) / 7` |
| **Net Adds Needed / Week** | `Gap / Weeks Remaining` |
| **Open Roles** | `COUNT(Roles WHERE status = 'Open')` |
| **At-Risk Accounts (R/Y)** | `COUNT(Accounts WHERE health IN ('R', 'Y'))` |
| **At-Risk $ (R/Y)** | `SUM(Accounts.ARR WHERE health IN ('R', 'Y'))` |
| **Pipeline $ (next 90d)** | `SUM(Deals.weighted_value WHERE target_close_date <= today + 90 AND stage NOT IN ('7a','7b','7c'))` |
| **Stalled Deals** | `COUNT(Deals WHERE stalled = 'Yes')` or `COUNT(Deals WHERE last_activity_date < today - 7 AND stage NOT IN ('7a','7b','7c'))` |
| **Parent Customer Deals** | `COUNT(DISTINCT Accounts WHERE parent_customer = 'Y' AND has active deals)` — the sheet shows `33` which is total deal count for parent customers |
| **Actions Due Next 7d** | `COUNT(Actions WHERE due_date BETWEEN today AND today+7 AND status NOT IN ('Completed','Complete'))` |

### 5.2 Exception Lists (Daily Review)

These are filtered lists shown on the dashboard for the daily operating call:

**At-Risk Accounts Table:**
- Filter: `Accounts WHERE health IN ('R', 'Y')`
- Columns: Account, Segment, ARR, Health, Top Risk, Next Action, Owner

**Deals Closing (next 60 days):**
- Filter: `Deals WHERE target_close_date <= today + 60 AND stage NOT IN ('7a','7b','7c')`
- Columns: Account (deal name), Value, Stage, Close Date, Next Step, Owner, CEO Ask

**Actions Due (next 7 days, not Done):**
- Filter: `Actions WHERE due_date <= today + 7 AND status NOT IN ('Completed','Complete')`
- Columns: Due, Category, Description, Owner, Status, Priority, Related Item

### 5.3 Pipeline by Stage (Value)

A summary report grouping active deals by stage:

- Filter: Exclude `7a. Closed Won`, `7b. Closed Lost`, `7c. Shelf`
- Group by: `Stage`
- Metric: `SUM(weighted_value)` per stage
- Used for a bar/funnel chart on the dashboard

### 5.4 Account Health Mix

Simple count of accounts by health status:

- Group by: `Health (G/Y/R)`
- Metric: `COUNT(*)` per health value

### 5.5 Consultant Growth vs Target (Chart)

Time-series chart from the Consultant Growth Plan:
- X-axis: `Week Start`
- Y-axis lines: `Ending HC` (actual) vs `Target HC` (plan)

---

## 6. Pipeline View Reports

Two pivot-style views exist in the spreadsheet as separate sheets.

### 6.1 Pipeline View (Weighted Value by Stage & Account)

- Filter: Exclude `7b. Closed Lost` and `7c. Shelf`
- Rows: Stage → Account (nested)
- Value: `SUM(Weighted Value)`
- Includes subtotals per stage and grand total
- Note annotation: probability is assigned to the stage

### 6.2 Pipeline View 2 (Multi-Metric)

Same structure but shows three value columns side by side:
- `Sum of Est Value ($) — Annualized`
- `Sum of Weighted Value`
- `Sum of Value Prorated by Date`

Also includes a separate section for **Closed Won only** showing `Value Prorated by Date` broken out by account. This is essentially a "booked revenue" report.

---

## 7. Data Quality Issues to Address in Migration

1. **Inconsistent status values:** `Complete` vs `Completed`, `Follow-up` vs `Follow-Up`, `HOLD` vs other statuses. Normalize on import.
2. **Freetext relationships:** `Action.related_item` is freetext matching deal/account/role names. Must map to proper FKs during import.
3. **Multi-value owner fields:** Owners like `Zach & Marley`, `Marley/Ryan`, `Zach, Marley` should be parsed on delimiters (`&`, `/`, `,`) and stored as multiple records in a join table per entity (e.g., `deal_owners`, `action_owners`). Each entity supports many-to-many ownership.
4. **Champion field mixing concerns:** Contains both internal owner names and external contact emails in one cell. Split on import.
5. **TBD values in currency fields:** `Est Value` has `TBD` strings in what should be numeric columns. Treat as null.
6. **ARR inconsistency:** Some accounts have `TBD` or garbage data (`o0-;kl0-lo0` for Enlace Health) in the Health field. Clean on import.
7. **Embedded reference data:** Cols 15–16 of Accounts and cols 20–22 of Deals contain sidebar legends/lookups, not row-level data. Extract as configuration.
8. **Empty rows with formulas:** The Deals sheet has ~100 empty placeholder rows with formula scaffolding. Ignore on import.
9. **Meeting Format sheet:** Exists but is completely empty. May have been intended for meeting agenda templates — confirm if this is needed in the CRM.

---

## 8. Users / Team Members (Observed)

The following names appear as owners across Accounts, Deals, Roles, and Actions. Each should be a User in the CRM:

| Name | Observed Context |
|---|---|
| Zach | Deals, Roles, Actions, Accounts |
| Marley | Deals, Roles, Actions, Accounts |
| Ameet | Deals, Actions, Accounts |
| Joanne | Roles, Accounts |
| Myra | Deals, Actions |
| Ryan | Actions (often paired with Marley) |

---

## 9. Summary: What Claude Code Should Validate

When checking the CRM schema against this spec, confirm:

1. **All five entities exist** (Accounts, Deals, Roles, Actions, Consultant Plan) with all fields listed above.
2. **All enumerations** (§3) are configured as valid options in the relevant fields.
3. **Computed fields** (`Weighted Value`, `Value Prorated by Date`, `Days Open`, `Ending HC`, `Gap`) have correct formulas or are derived at query time.
4. **Foreign key relationships** are properly enforced (not freetext).
5. **Dashboard KPIs** (§5) can all be reproduced from queries against the schema.
6. **Pipeline reports** (§6) can be generated with proper grouping, subtotals, and multi-metric columns.
7. **The stage→probability mapping** (§3.4) exists as reference/config data and defaults are applied to new deals.
8. **Setup/config values** (§2.6) are stored and editable, driving the consultant growth calculations.
9. **Data normalization** has been applied per §7 (consistent statuses, split owners, clean currency fields).
