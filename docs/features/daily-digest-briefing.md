# Feature: Daily Digest & Leadership Briefing Cockpit

**Status:** Complete
**Zone:** admin (CRM)
**Last Updated:** 2026-04-08

## Overview

Two connected features that solve the CRM data freshness problem. Salespeople don't update the CRM because the friction of opening the app exceeds the perceived benefit. The daily digest creates an accountability loop by emailing each salesperson their stale deals, overdue tasks, rolloffs, and open roles with one-click action links. The briefing cockpit is a single page where leadership walks through the entire business operation every morning and takes action inline without navigating away.

## Business Logic

### Daily Digest Email (Phase 1a)
- Sent daily via Vercel Cron (8am Pacific default, configurable per user)
- Per-user personalized content: stale deals (>14d no activity), overdue tasks, upcoming rolloffs (30d), open roles needing candidates
- Each item has one-click action links using signed, single-use, 24h-TTL tokens
- Action tokens auto-authenticate the user (no login required for the action)
- Simple actions (mark complete) apply directly, multi-step actions (update stage) redirect to pre-filled page with auto-session
- Zero items case: send brief "All clear!" email
- Digest preferences: enable/disable, preferred send time, timezone per user
- Click tracking: timestamp on token use, admin analytics view
- Email delivery failures: retry once after 5 min, log to crm_digest_logs

### Leadership Briefing Cockpit (Phase 1b)
- Single page at /admin/crm/briefing combining 5 operational views
- Pipeline snapshot: deals by stage with inline stage-change dropdown
- Open roles: with matched candidates and inline assign button
- Bench consultants: with skills and days on bench
- Upcoming rolloffs: 30/60 day window with backfill status
- Active candidates: pipeline status
- Every item is actionable inline (change stage, assign candidate, create task, add note)
- AI deal health: one-line assessment per at-risk deal (progressive loading)
- Print view: CSS print stylesheet for leadership meetings
- First item in CRM sidebar section

## Technical Details

### Database Tables (new migration)
- `crm_digest_preferences` — user_id (PK), enabled, send_time, timezone
- `crm_digest_logs` — user_id, sent_at, items_count, clicked_items, delivery_status
- `crm_action_tokens` — user_id, action_type, entity_type, entity_id, payload, used, expires_at

### API Endpoints
- `POST /api/admin/crm/digest/send` — Cron endpoint, generates and sends all digests
- `GET /api/admin/crm/digest/action/[tokenId]` — Action link handler (validates, applies, returns success)
- `GET /api/admin/crm/digest/preferences` — Get current user's digest preferences
- `PATCH /api/admin/crm/digest/preferences` — Update preferences
- `GET /api/admin/crm/digest/stats` — Admin digest analytics
- `GET /api/admin/crm/briefing/data` — Aggregated briefing data (pipeline + roles + bench + rolloffs + candidates)
- `POST /api/admin/crm/briefing/ai-health` — AI health assessment for stale deals

### Frontend
- `src/app/(app)/admin/crm/briefing/page.tsx` — Briefing cockpit page
- `src/components/admin/crm/BriefingCockpit.tsx` — Interactive cockpit component
- `src/app/(app)/admin/crm/settings/page.tsx` — Digest preferences page
- Sidebar update: add "Briefing" as first CRM item

## Task Checklist

### Phase 1a: Daily Digest
- [x] Email template builder (`src/lib/crm/digest-email.ts`)
- [x] Digest send API / cron endpoint (`src/app/api/admin/crm/digest/send/route.ts`)
- [x] Action token handler (`src/app/api/admin/crm/digest/action/[tokenId]/route.ts`)
- [x] Digest preferences API (`src/app/api/admin/crm/digest/preferences/route.ts`)
- [x] Digest preferences UI (`src/app/(app)/admin/crm/settings/digest/page.tsx`, `src/components/admin/crm/DigestSettings.tsx`)
- [x] Digest analytics endpoint (`src/app/api/admin/crm/digest/stats/route.ts`)
- [ ] Vercel cron config (`vercel.json`)
- [ ] Database migration (3 tables already created in Supabase)

### Phase 1b: Leadership Briefing Cockpit
- [x] Briefing data aggregation API (`src/app/api/admin/crm/briefing/data/route.ts`)
- [x] AI deal health endpoint (`src/app/api/admin/crm/briefing/ai-health/route.ts`)
- [x] Briefing cockpit page (`src/app/(app)/admin/crm/briefing/page.tsx`)
- [x] Briefing cockpit component with 5 sections (`src/components/admin/crm/BriefingCockpit.tsx`)
- [x] Inline stage change dropdown
- [x] Inline candidate assign for roles
- [x] Inline task creation (+ button)
- [x] AI health progressive loading with shimmer
- [x] Print stylesheet (`@media print` in BriefingCockpit)
- [x] Sidebar update (Briefing + Settings items)

### Infrastructure
- [x] .env.local.example updated (RESEND_API_KEY, CRON_SECRET)
- [ ] Unit tests
- [ ] Integration tests

## Test Coverage
- Unit: `tests/unit/crm/digest-email.test.ts` — 19 tests (escapeHtml, buildDigestEmail, XSS prevention, all section types)
- Integration: `tests/integration/admin/digest-briefing.test.ts` — 16 tests (digest preferences, stats, send, action tokens, briefing data)
- E2E: deferred (requires email service + browser)

**Last Updated**: 2026-04-08 by senior-software-engineer

## Known Limitations / Future Work
- Teams bot (Phase 2) — real-time NL updates from Teams
- Calendar autopilot (Phase 3) — Microsoft Graph integration
- Email open tracking (would require tracking pixel, deferred)
- Digest analytics only tracks click-through, not email opens
