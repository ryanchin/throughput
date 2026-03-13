# Feature: Course Completion Scorecard

**Status:** Complete
**Zone:** training + sales (shared learner components) + admin
**Last Updated:** 2026-03-12

## Purpose
Provides the course completion flow and final score display. When a learner finishes all lessons and quizzes, the system calculates a final weighted score across all quizzes, updates enrollment status to passed/failed, and displays a detailed scorecard. Admins can track user completion across all courses from a dedicated dashboard.

## User Stories
- As a learner, I see a completion scorecard when I finish a course showing my final score and pass/fail status
- As a learner, I can view my course results at any time after completion
- As a learner, I can share my passed course to LinkedIn
- As an admin, I can see a table of all users with their enrollment/completion stats
- As an admin, I can drill into a user's per-course detail
- As an admin, I can export user completion data to CSV

## Acceptance Criteria
- [x] Database: add `status` (enrolled/passed/failed) and `final_score` to course_enrollments
- [x] Completion trigger: all published lessons completed + all quizzes attempted
- [x] On completion: calculate final_score from quiz scores, update enrollment status
- [x] `isCourseDone()` and `buildQuizBreakdown()` pure utility functions
- [x] GET /api/training/courses/[slug]/results — returns scorecard data
- [x] CourseScorecard component: animated progress ring, pass/fail badge, quiz breakdown table
- [x] Confetti animation on pass
- [x] LinkedIn share button for passed courses
- [x] "View Certificate" button (conditional on certification track)
- [x] "Browse More Courses" button
- [x] Results page at /training/[courseSlug]/results + /sales mirror
- [x] GET /api/admin/users — user tracking table with aggregates
- [x] GET /api/admin/users/[userId]/courses — per-user course detail
- [x] Admin /admin/users page with table and CSV export
- [x] Unit tests for completion logic
- [x] Integration tests for results API and admin users API
- [x] E2E tests for completion flow and admin tracking

## Technical Notes
- API routes: `GET /api/training/courses/[slug]/results`, `GET /api/admin/users`, `GET /api/admin/users/[userId]/courses`
- DB tables touched: `course_enrollments` (add status + final_score columns), `quiz_attempts`, `question_responses`, `profiles`
- Uses `createClient()` for learner reads, `requireAdmin()` for admin routes
- LinkedIn share uses simple post share URL (not the cert/badge system)
- Completion logic is a pure function in `lib/training/completion.ts`
- Progress API updated to trigger scoring on course completion

## Test Coverage

### Unit Tests (28 tests)
- `tests/unit/lib/training/completion.test.ts` — 14 tests: isCourseDone (7), buildQuizBreakdown (7)
- `tests/unit/components/training/CourseScorecard.test.tsx` — 14 tests: rendering, pass/fail states, buttons, breakdown

### Integration Tests (11 tests)
- `tests/integration/training/course-results.test.ts` — 6 tests: auth, 404, 403, scorecard data, no quizzes, no lessons
- `tests/integration/admin/users.test.ts` — 5 tests: auth, role check, aggregates, empty, no enrollments

### E2E Tests (33 tests)
- `tests/e2e/training/course-completion.spec.ts` — 17 tests: passed scenario (11) + failed scenario (6)
- `tests/e2e/admin/user-tracking.spec.ts` — 16 tests: table, search, sorting, export, role badges

**Total: 72 new tests, all passing**
**Full suite: 563 unit/integration + 33 E2E = 596 total**

## Known Limitations / Future Work
- No certificate tie-in yet (button shown but links to placeholder)
- LinkedIn share is a simple post share, not Open Badges
- Admin CSV export is client-side (no server-side streaming for large datasets)
- No per-question analytics in admin view
