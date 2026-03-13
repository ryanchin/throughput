# Feature: Landing Page

**Status:** Complete
**Zone:** public
**Last Updated:** 2026-03-13

## Purpose
Public landing page at `/` targeting the certification audience. Showcases AAVA certifications, methodology preview, and team training. Fully static with ISR for trust strip stat counts. Uses the dark electric-cyan design system.

## User Stories
- As a prospective certification candidate, I can understand what AAVA certifications are and start the process
- As a visitor, I can explore the methodology and certification tiers
- As a team lead, I can learn about internal training capabilities and request access

## Acceptance Criteria
- [x] Hero section with gradient headline, two CTAs, animated SVG background
- [x] Trust strip with AAVA branding and stat pills (ISR from DB)
- [x] What You Learn — 3 certification tier cards
- [x] How It Works — 3-step flow with connecting lines
- [x] Methodology Preview — horizontal scrollable card strip
- [x] For Teams — two-column layout with bullet points
- [x] Footer with nav links and copyright
- [x] Landing nav (logo + Login + Get Certified)
- [x] Mobile responsive
- [x] E2E tests for all sections and navigation

## Technical Notes
- Root page at `src/app/page.tsx` — no auth required
- ISR with `revalidate: 3600` for trust strip stat counts
- Animated SVG background uses CSS-only animation (no JS library)
- No layout wrapper from `(app)` group — uses root layout directly
- Landing nav component separate from authenticated TopNav

## Test Coverage
- E2E: `tests/e2e/landing/landing-page.spec.ts` (13 tests — all sections render, navigation links, mobile responsive, course progress mockup)

## Known Limitations / Future Work
- Stat counts fall back to hardcoded values until DB data exists
- "Request access" links to mailto rather than a form
- No A/B testing on CTA copy
