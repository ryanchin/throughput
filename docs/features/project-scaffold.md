# Feature: Project Scaffold

**Status:** Complete
**Zone:** shared
**Last Updated:** 2026-03-12 13:53 by senior-software-engineer

## Overview
Initial project scaffold for the Throughput training platform. Sets up Next.js 16 with App Router, TypeScript, Tailwind CSS, shadcn/ui, and the full AAVA design system. Creates the complete folder structure, configuration files, and testing infrastructure.

## Business Logic
N/A -- this is infrastructure setup.

## Technical Details
- Next.js 16 App Router with TypeScript
- Tailwind CSS v4 with custom AAVA design tokens (dark-by-default theme)
- shadcn/ui with dark mode default (base-nova style)
- Supabase client libraries (@supabase/supabase-js, @supabase/ssr)
- Tiptap editor (@tiptap/react, @tiptap/starter-kit, @tiptap/markdown)
- OpenAI SDK for OpenRouter-compatible LLM calls
- Vitest for unit/integration tests with jsdom + Testing Library
- Playwright for E2E tests (chromium)
- Full folder structure matching CLAUDE.md spec with placeholder files
- Route groups: (app) for authenticated, (auth) for login/logout, (public) for docs/verify

## Task Checklist
- [x] Scaffold Next.js project
- [x] Install all dependencies
- [x] Apply design system (globals.css with AAVA color tokens)
- [x] Create folder structure
- [x] Configure path aliases (@/* -> src/*)
- [x] Create .env.local.example
- [x] Build landing page with design system
- [x] Configure Vitest
- [x] Configure Playwright
- [x] Write smoke test
- [x] Verify dev server runs (200 on homepage)

## Test Coverage
- E2E: `tests/e2e/smoke.spec.ts`

## Known Limitations / Future Work
- Placeholder files need implementation in subsequent features
- shadcn components will be added as needed by features
- Next.js 16 deprecated `middleware.ts` in favor of `proxy.ts` -- will need migration when implementing auth
- The `(public)/certifications` route was removed to avoid conflict with `(app)/certifications` -- public cert access will be handled via conditional auth in the (app) group
