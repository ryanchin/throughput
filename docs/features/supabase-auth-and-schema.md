# Feature: Supabase Auth & Database Schema

**Status:** Complete
**Zone:** shared
**Last Updated:** 2026-03-12 13:53 by senior-software-engineer

## Overview
Complete database schema and authentication system for the Throughput training platform. Implements all core tables (profiles, courses, lessons, quizzes, progress tracking, docs, certifications, user groups), Row Level Security policies, Supabase auth integration with auto-profile creation, role-based middleware route protection, and client/server Supabase utilities.

## Business Logic

### Authentication
- Users authenticate via email/password or magic link through Supabase Auth
- On signup, a profile is auto-created via a database trigger on `auth.users`
- Public certification signups get role `public`; all other signups default to `employee`
- Sessions are refreshed via middleware on every request

### Role-Based Access Control
- Four roles: `employee`, `sales`, `admin`, `public`
- Zone access matrix:
  - `/training` -- employee, sales, admin
  - `/sales` -- sales, admin
  - `/admin` -- admin only
  - `/knowledge` -- employee, sales, admin
  - `/certifications` -- all roles (including public)
- Enforced at two layers: Next.js middleware (route-level) and Supabase RLS (data-level)

### Content Visibility
- All content has `status` field: `draft` or `published`
- Draft content is only visible to admins
- Published training content visible to employees+; published sales content visible to sales+
- Certification tracks are publicly visible when published
- Docs pages have additional `visibility` field: `public` or `internal`

### Certifications
- Public users can view published certification tracks and attempt exams
- Exam questions are never directly exposed (admin-only RLS)
- Certificates are publicly viewable for verification
- 80% passing score, 24h cooldown, max 3 attempts per 30 days

## Technical Details

### Files Created/Modified
- `supabase/migrations/20260312000001_profiles.sql` -- profiles table, trigger, RLS
- `supabase/migrations/20260312000002_courses_and_lessons.sql` -- courses, lessons, RLS
- `supabase/migrations/20260312000003_quizzes.sql` -- quizzes, questions, RLS
- `supabase/migrations/20260312000004_progress_tracking.sql` -- enrollments, progress, attempts, responses
- `supabase/migrations/20260312000005_docs_pages.sql` -- docs pages with full-text search
- `supabase/migrations/20260312000006_certifications.sql` -- cert tracks, questions, attempts, certificates
- `supabase/migrations/20260312000007_user_groups.sql` -- user groups for knowledge access
- `src/lib/supabase/client.ts` -- browser Supabase client
- `src/lib/supabase/server.ts` -- server Supabase client + service role client
- `src/lib/supabase/middleware.ts` -- session refresh utility
- `src/lib/supabase/database.types.ts` -- full TypeScript types for all tables
- `src/lib/auth/getProfile.ts` -- server-side profile fetcher
- `src/lib/auth/useProfile.ts` -- client-side profile hook
- `src/lib/auth/route-helpers.ts` -- extracted route matching helpers (testable)
- `src/middleware.ts` -- role-based route protection
- `src/app/(auth)/login/page.tsx` -- styled login page (password + magic link)
- `src/app/(auth)/logout/route.ts` -- logout route
- `src/app/api/auth/callback/route.ts` -- magic link callback handler
- `src/app/(app)/layout.tsx` -- authenticated app layout with TopNav
- `src/components/nav/TopNav.tsx` -- zone-aware navigation component

### Database Tables
- `profiles` -- extends auth.users with role, full_name, avatar
- `courses` -- training/sales courses with zone scoping
- `lessons` -- course content with Tiptap JSON and video support
- `quizzes` -- per-lesson quizzes
- `questions` -- MC, T/F, open-ended quiz questions
- `course_enrollments` -- user-course enrollment tracking
- `lesson_progress` -- per-lesson completion tracking
- `quiz_attempts` -- quiz attempt history with scoring
- `question_responses` -- individual question answers with LLM feedback
- `docs_pages` -- nested knowledge base with full-text search
- `certification_tracks` -- public certification programs
- `cert_questions` -- certification exam question pools
- `cert_attempts` -- certification exam attempts
- `certificates` -- earned certificates with verification hashes
- `user_groups` -- group membership for knowledge access control

## Task Checklist
- [x] Create feature doc
- [x] Migration 1: profiles table + trigger + RLS
- [x] Migration 2: courses + lessons + RLS
- [x] Migration 3: quizzes + questions + RLS
- [x] Migration 4: progress tracking tables + RLS
- [x] Migration 5: docs_pages + full-text search + RLS
- [x] Migration 6: certification tables + RLS
- [x] Migration 7: user_groups + RLS
- [x] Supabase client utility (browser)
- [x] Supabase server utility + service role client
- [x] Supabase middleware utility (session refresh)
- [x] Database TypeScript types
- [x] Auth getProfile (server-side)
- [x] Auth useProfile (client-side hook)
- [x] Route helpers (extracted, testable)
- [x] Middleware (role-based route protection)
- [x] Login page (password + magic link)
- [x] Logout route
- [x] Auth callback route
- [x] App layout with TopNav
- [x] TopNav component (zone-aware)
- [x] Unit tests: getProfile (4 tests passing)
- [x] Unit tests: route helpers (16 tests passing)
- [x] E2E tests: login flow (6 tests)
- [x] Update feature doc status

## Test Coverage
- Unit: `tests/unit/auth/getProfile.test.ts`
- Unit: `tests/unit/auth/middleware-helpers.test.ts`
- E2E: `tests/e2e/auth/login.spec.ts`

## Known Limitations / Future Work
- Database types are hand-written; should be regenerated from Supabase CLI (`npx supabase gen types typescript`) once migrations are applied
- Group-based visibility for docs_pages (`group:[name]`) is defined in schema but RLS policies for group filtering are not yet implemented
- LinkedIn organizationId for cert deeplinks needs to be added once AAVA LinkedIn Company Page is created
- E2E tests for login with valid credentials require a seeded test Supabase instance
