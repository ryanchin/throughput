# Feature: Microsoft Teams Bot for CRM Updates

**Status:** Complete
**Zone:** admin (CRM integration)
**Last Updated:** 2026-04-07 by senior-software-engineer

## Overview

A Microsoft Teams bot that accepts natural language CRM updates from salespeople. Instead of opening the Throughput app, a salesperson types a message to the bot in Teams: "Had a call with Premera, moving to proposal stage." The bot parses this using the existing NL parse engine, shows a confirmation card, and applies the updates on confirm. Also sends proactive stale-deal notifications via Teams DM.

This is Phase 2 of the "Zero-Friction CRM Updates" initiative. Phase 1 (daily digest email) creates the accountability habit. Phase 2 enables real-time updates from where salespeople already live.

## Business Logic

### Inbound: NL Deal Updates
1. Salesperson messages the bot (DM or @mention in a channel)
2. Bot sends the text to the existing NL parse engine (`POST /api/admin/crm/ai/parse`)
3. NL engine returns structured actions (log activity, update stage, create task, etc.)
4. Bot renders an Adaptive Card showing the parsed actions with checkboxes
5. User confirms or edits, then clicks "Apply"
6. Bot applies the confirmed actions via CRM API calls
7. Bot responds with confirmation: "Done! Updated Premera deal to Proposal stage."

### Outbound: Proactive Notifications
1. Cron or manual trigger calls the proactive messaging endpoint
2. For each user with stale deals or overdue tasks, send a Teams DM
3. Message includes: "You have 3 stale deals that need attention" with action links
4. Action links open the Throughput CRM in the browser

### User Matching
- Bot identifies the Teams user by their email address
- Matches to the `profiles` table email to find the CRM user
- If no match: responds with "I don't recognize your account. Contact your admin."

## Technical Details

### Architecture

```
Teams User Message
       │
       ▼
Azure Bot Service (webhook relay)
       │
       ▼
POST /api/teams/messages (Vercel)
       │
       ├─► Identify user (Teams email → profiles.email)
       ├─► Parse NL text (→ /api/admin/crm/ai/parse)
       ├─► Build Adaptive Card (confirmation UI)
       └─► Send card back via Bot Framework REST API
                │
                ▼
User clicks "Apply" on card
       │
       ▼
POST /api/teams/messages (card action callback)
       │
       ├─► Apply confirmed actions (PATCH opportunities, POST activities, etc.)
       └─► Send confirmation message
```

### Azure Requirements (manual setup, not code)
- Azure Bot Service registration
- Azure AD app registration (client ID + secret)
- Bot Framework messaging endpoint: `https://throughput.vercel.app/api/teams/messages`
- Teams app manifest (JSON) uploaded to Teams admin center

### Environment Variables
- `TEAMS_BOT_APP_ID` — Azure AD app (client) ID
- `TEAMS_BOT_APP_SECRET` — Azure AD app secret
- `TEAMS_BOT_TENANT_ID` — Azure AD tenant ID (for single-tenant apps)

### API Endpoints
- `POST /api/teams/messages` — Bot Framework webhook (receives all messages + card actions)
- `POST /api/admin/crm/teams/proactive` — Trigger proactive notifications (cron or manual)

### Key Files
- `src/app/api/teams/messages/route.ts` — Bot Framework webhook endpoint
- `src/lib/teams/bot-handler.ts` — Core message + card action handling logic
- `src/lib/teams/adaptive-cards.ts` — Adaptive Card JSON builders (confirmation, success, error, welcome)
- `src/lib/teams/auth.ts` — Bot Framework token acquisition + validation
- `src/lib/teams/reply.ts` — Helper to send replies via Bot Framework REST API
- `docs/guides/teams-bot-setup.md` — Step-by-step Azure + Teams setup guide

## Task Checklist

### Phase 1: Core Bot (v1 — inbound NL updates)
- [x] Bot Framework webhook endpoint (`src/app/api/teams/messages/route.ts`)
- [x] Teams auth — token validation for incoming messages (`src/lib/teams/auth.ts`)
- [x] NL parse integration — reuses existing `buildNLParsePrompt` + `callOpenRouter` (`src/lib/teams/bot-handler.ts`)
- [x] Adaptive Card builder — confirmation, success, error, welcome cards (`src/lib/teams/adaptive-cards.ts`)
- [x] Card action handler — apply confirmed actions to CRM (`src/lib/teams/bot-handler.ts`)
- [x] Reply helper — sends messages/cards via Bot Framework REST API (`src/lib/teams/reply.ts`)
- [x] User matching — Teams display name to CRM profile (v1: name-based, TODO: email via Graph API)
- [x] Error handling — unrecognized user, parse failure, apply failure, empty message
- [x] Azure setup guide (`docs/guides/teams-bot-setup.md`)
- [ ] Unit tests
- [ ] Integration tests

### Phase 2: Proactive Notifications (v2 — deferred)
- [ ] Store conversation references when users first message the bot
- [ ] Proactive messaging endpoint for stale deals / overdue tasks
- [ ] Full JWT signature verification against Microsoft OpenID keys
- [ ] Email-based user matching via Microsoft Graph API

## Test Coverage
- Unit: `tests/unit/teams/adaptive-cards.test.ts` — 9 tests (card builders, schema validation)
- Integration: `tests/integration/teams/webhook.test.ts` — 8 tests (webhook routing, auth, error handling)
- E2E: manual (requires Teams environment)

## Known Limitations / Future Work
- Single-tenant only (Ascendion's Azure AD tenant)
- No channel-level bot (DM only in v1)
- No rich entity resolution in Adaptive Cards (uses text confirmation, not dropdowns)
- Calendar autopilot (Phase 3) would enhance this with post-meeting prompts
