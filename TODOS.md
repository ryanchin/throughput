# TODOS

## P2: Office 365 Email/Calendar Auto-Capture
**What:** Automatically log CRM activities from Outlook emails and calendar events via Microsoft Graph API.
**Why:** Eliminates the last remaining manual data entry. Salespeople BCC or auto-forward, system creates activities.
**Pros:** True "CRM that updates itself" without manual activity logging.
**Cons:** Requires Azure AD app registration + admin consent. OAuth2 complexity.
**Context:** Ascendion uses Office 365. Two implementation levels: Level 1 (BCC/forward parsing, no OAuth) or Level 2 (full Graph API auto-capture). Level 1 is a good quick win. Level 2 requires IT involvement for Azure AD setup.
**Effort:** XL (human) -> L (CC+gstack)
**Depends on:** CRM v1 shipped, Azure AD app registration (IT team)

## P3: Win/Loss Analysis Dashboard
**What:** Dashboard that analyzes close_reason data across won and lost deals to surface patterns.
**Why:** After 3-6 months of close_reason data, you can see WHY deals close or die.
**Pros:** Strategic insight into sales effectiveness.
**Cons:** Needs enough data to be meaningful (50+ closed deals).
**Context:** The drag-to-close feature captures close_reason from day one. This dashboard consumes that data.
**Effort:** M (human) -> S (CC+gstack)
**Depends on:** CRM v1 shipped, 3-6 months of close_reason data

## P3: Company Logo Auto-Fetch
**What:** Fetch company logos from Clearbit/logo.dev API to display in company list and detail views.
**Why:** Visual polish that makes the CRM feel professional.
**Cons:** External API dependency, may have rate limits or costs.
**Effort:** S (human) -> S (CC+gstack)
**Depends on:** CRM v1 shipped
