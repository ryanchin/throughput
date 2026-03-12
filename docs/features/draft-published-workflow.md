# Feature: Draft/Published Workflow

**Status:** Complete
**Zone:** admin / shared
**Last Updated:** 2026-03-12

## Overview
A content status system that controls visibility of all content types (courses, lessons, certification tracks, docs pages). All content defaults to "draft" and must be explicitly published to become visible to learners. Admins see all content in both states.

## Business Logic
- All content starts as "draft" — invisible to learners
- Admins can toggle status between draft and published
- Publishing a course requires at least one published lesson (validated server-side)
- Publishing a certification track requires at least `questions_per_exam` questions (validated server-side)
- Unpublishing is always allowed, no confirmation needed
- Learner API routes filter `status = 'published'` in queries (belt-and-suspenders with RLS)
- Draft content returns 404 for learner API requests

## Technical Details
- RLS policies already enforce `status = 'published'` for learner-facing SELECT
- New API route: `PATCH /api/admin/content/status` for toggling status
- New API route: `GET /api/admin/content/preflight` for publish preflight checks
- New API route: `GET /api/admin/courses` lists all courses (draft + published) for admin
- Validation functions in `src/lib/admin/content-validation.ts`
- Learner routes (`GET /api/training/courses`, `GET /api/certifications`) updated with belt-and-suspenders `status = 'published'` filtering
- Admin UI components: StatusBadge, PublishPreflightModal, StatusToggle, CourseCard, LessonRow

## Task Checklist
- [x] Create feature doc
- [x] Build validation functions (validateCoursePublish, validateCertTrackPublish, getUnpublishedLessons)
- [x] Build PATCH /api/admin/content/status route with Zod validation
- [x] Build GET /api/admin/content/preflight route for publish preflight checks
- [x] Build GET /api/admin/courses route (admin sees all statuses)
- [x] Implement learner API routes with belt-and-suspenders status filtering
- [x] Build StatusBadge component
- [x] Build StatusToggle component
- [x] Build PublishPreflightModal component
- [x] Build CourseCard component
- [x] Build LessonRow component
- [x] Unit tests for validation functions (14 tests)
- [x] Integration tests for status API route (13 tests)
- [x] E2E tests for publish/unpublish workflow (6 tests)

## Test Coverage
- Unit: `tests/unit/admin/content-validation.test.ts` — 14 tests
- Integration: `tests/integration/admin/content-status.test.ts` — 13 tests
- E2E: `tests/e2e/admin/draft-published.spec.ts` — 6 tests
- Total: 33 tests, all passing

## Known Limitations / Future Work
- Bulk publish/unpublish not yet supported
- Scheduled publishing (publish at future date) not in scope
- Admin courses page at `/admin/courses` needs full server component implementation (currently uses test page)
