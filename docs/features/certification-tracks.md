# Feature: Certification Tracks

**Status:** Complete
**Zone:** certification (public) + admin
**Last Updated:** 2026-03-12

## Purpose
Public certification track system where anyone can browse, enroll, and earn AAVA certifications. Includes a public signup flow (role = 'public'), tiered certification cards with prerequisite checking, track overview pages with exam details, and an admin CMS for managing tracks and question pools.

## User Stories
- As a visitor, I can browse all certification tracks without logging in
- As a visitor, I can sign up for a free public account to take exams
- As a public user, I can see my prerequisite status on each track
- As a public user, I can view track details including lesson list and exam info
- As an admin, I can create/edit/delete certification tracks
- As an admin, I can manage the question pool for each track

## Acceptance Criteria
- [x] /certifications page: hero, tier cards, domain certs grid
- [x] Tier badge colors: Foundations=Silver, Practitioner=Cyan, Specialist=Gold
- [x] Prerequisite indicator: locked/unlocked based on auth + earned certs
- [x] /certifications/signup: public account creation with role='public'
- [x] /certifications/[trackSlug]: track overview with exam details
- [x] "Create Free Account" (public) / "Take Exam" (auth + prereqs) buttons
- [x] GET /api/certifications: published tracks with optional prereq status
- [x] GET /api/certifications/[slug]: track detail with questions count
- [x] POST /api/certifications/signup: creates auth user + public profile
- [x] Admin CRUD: /api/admin/certifications routes
- [x] Admin question pool: /api/admin/certifications/[trackId]/questions routes
- [x] Admin CMS pages at /admin/certifications
- [x] RLS policies for public read access on cert tables
- [x] Unit tests for prerequisite checking logic
- [x] Integration tests for all API routes
- [x] E2E tests for public browsing, signup, and track overview

## Technical Notes
- Reuses existing `certification_tracks`, `cert_questions`, `cert_attempts`, `certificates` tables from CLAUDE.md
- Public signup creates profile with `role = 'public'` — no org affiliation
- RLS: certification_tracks and cert_questions are publicly readable when `status = 'published'`
- Question pool: admin manages MC + open_ended questions with difficulty tags
- Prerequisite checking is a pure function in `lib/certifications/prerequisites.ts`
- Public pages live in `(public)` route group (no auth layout)
- Admin pages live in `(app)/admin/certifications` (auth + admin required)
- Belt-and-suspenders: `status = 'published'` filter in both RLS policies AND API query logic

## Test Coverage

### Unit Tests (14 tests)
- `tests/unit/lib/certifications/prerequisites.test.ts` — 14 tests: checkPrerequisite (5), getTierBadgeColor (4), getTierName (5)

### Integration Tests (14 tests)
- `tests/integration/certifications/certifications-api.test.ts` — 8 tests: GET /api/certifications (4), GET /api/certifications/[slug] (4)
- `tests/integration/certifications/signup.test.ts` — 6 tests: POST /api/certifications/signup (auth, validation, conflict, error)

### E2E Tests (26 tests)
- `tests/e2e/certification/public-browse.spec.ts` — 16 tests: tier cards, earned badge, badges, exam info, prerequisites, domain certs, links
- `tests/e2e/certification/signup-flow.spec.ts` — 10 tests: form rendering, fields, validation, input types

**Total: 54 new tests, all passing**

## Known Limitations / Future Work
- Exam taking flow is a separate feature (timed exam, question randomization)
- Certificate generation and verification is a separate feature
- LinkedIn Open Badges integration is a separate feature
- Track overview page does not yet show lesson list (lessons are part of the exam flow feature)
