# Feature: Admin Analytics Dashboard

**Status:** Complete
**Zone:** admin
**Last Updated:** 2026-03-13

## Purpose
The admin home page at `/admin` displays key platform metrics at a glance: user counts, activity, course performance, most-missed questions, and recent certifications. All data is fetched server-side via Supabase aggregate queries. Includes CSV export functionality for users and completions.

## User Stories
- As an admin, I can see total user counts by role so I know who is on the platform
- As an admin, I can see monthly active users so I understand engagement
- As an admin, I can see published course counts so I know the content catalog size
- As an admin, I can see certifications issued to track credentialing output
- As an admin, I can see course performance metrics (enrollment, completion, pass rate, avg score)
- As an admin, I can see the most missed questions to identify content gaps
- As an admin, I can see recent certifications to monitor certification activity
- As an admin, I can export user and completion data as CSV for reporting

## Acceptance Criteria
- [x] Stat cards: Total users (with role breakdown), Active this month, Courses published, Certifications issued (total + this month)
- [x] Course performance table: Course | Enrolled | Completed | Pass Rate | Avg Score, sorted by enrollment desc
- [x] Most missed questions: top 10 by incorrect rate, shows question text, course, quiz, % incorrect
- [x] Recent certifications: last 20, shows recipient, certification name, date, score
- [x] All data fetched server-side (Server Component)
- [x] Export Users CSV button
- [x] Export Completions CSV button
- [x] Non-admin gets 403 on API routes
- [x] Integration tests for analytics queries and access control
- [x] E2E tests for dashboard rendering and export

## Technical Notes
- Admin dashboard at `src/app/(app)/admin/page.tsx` — Server Component, no client-side data fetching
- Analytics data helper at `src/lib/admin/analytics.ts` — 8 exported functions for stats, performance, missed questions, certs, and CSV exports
- API routes for CSV export at `src/app/api/admin/analytics/export-users/route.ts` and `export-completions/route.ts`
- Export buttons in client component `src/components/admin/ExportButtons.tsx`
- Dashboard link added to admin sidebar in `src/app/(app)/admin/layout.tsx`
- Uses existing tables: profiles, course_enrollments, quiz_attempts, question_responses, questions, quizzes, lessons, courses, certificates, certification_tracks, lesson_progress
- All queries use the service role client (admin-only, needs cross-user data)
- Most missed questions filters to questions with >= 3 attempts for statistical significance
- Course performance sorts by enrollment count descending
- CSV export uses csvEscape() helper to properly handle commas and quotes in field values

## Test Coverage

### Integration Tests (11 tests)
- `tests/integration/admin/analytics.test.ts` — 11 tests:
  - Export Users: 401 unauthenticated, 403 non-admin, returns CSV with correct headers and data, empty CSV for no profiles
  - Export Completions: 401 unauthenticated, 403 non-admin, returns CSV with enrollment data
  - Analytics data: getUserStats role breakdown, getCourseStats published count, getCoursePerformance sorted rows, csvEscape handles commas

### E2E Tests (10 tests)
- `tests/e2e/admin/analytics-dashboard.spec.ts` — 10 tests:
  - Dashboard heading renders
  - All four stat cards visible with numeric values
  - Stat card labels (Total Users, Active This Month, Courses Published, Certifications Issued)
  - Role breakdown in subtitle
  - Course performance table with headers and data
  - Most missed questions section
  - Recent certifications section
  - Export Users CSV button visible
  - Export Completions CSV button visible
  - High incorrect rate highlighted in red

**Total: 21 new tests (665 unit/integration + 10 E2E), all passing**

## Known Limitations / Future Work
- No date range filtering (always shows all-time + last 30 days)
- No real-time updates — data is fetched once on page load
- Export CSVs include all records (no pagination/streaming for very large datasets)
- Could add charts/visualizations (trend lines, bar charts) in future iteration
