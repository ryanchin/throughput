# Feature: Course Catalog & Enrollment

**Status:** Complete
**Zone:** training + sales (shared learner components)
**Last Updated:** 2026-03-12

## Purpose
Learner-facing course catalog with enrollment, lesson progression, and completion tracking. Employees and sales reps browse published courses, enroll, work through lessons sequentially or freely, complete quizzes, and track progress. The same components serve both `/training` and `/sales` zones with zone-based filtering.

## User Stories
- As an employee, I can browse published training courses in a grid catalog
- As a sales rep, I can see both training and sales courses
- As a learner, I can enroll in a course and see my progress
- As a learner, I can navigate through lessons with a sidebar showing completion status
- As a learner, I can mark lessons as complete and auto-advance to the next lesson
- As a learner, I see a progress ring showing X of Y lessons complete
- As an admin, I can set a course to sequential or free-navigation mode

## Acceptance Criteria
- [x] /training page: grid of CourseCard components with published courses
- [x] Zone filtering: employees see training only, sales+admin see all
- [x] CourseCard shows: cover image, title, description, lesson count, estimated time, zone badge
- [x] Enrolled courses show progress bar + "Continue" button
- [x] Non-enrolled courses show "Start Course" button
- [x] Empty state when no courses available
- [x] /training/[courseSlug] course overview page with hero + lesson list
- [x] Lesson list sidebar with lock icons (sequential mode) or open navigation
- [x] navigation_mode column on courses table (sequential vs free)
- [x] Enrollment created on first CTA click (POST /api/training/enroll)
- [x] Progress ring showing completion percentage
- [x] /training/[courseSlug]/[lessonSlug] lesson page
- [x] Left sidebar: LessonNav with completion checkmarks
- [x] Main content: LessonViewer + video blocks with signed URLs
- [x] "Mark as Complete" button at bottom
- [x] Quiz gate: quiz must be completed before marking lesson complete
- [x] Progress bar in top of lesson page
- [x] Mirror /sales zone with same components
- [x] GET /api/training/courses enhanced with lesson count, enrollment, progress
- [x] POST /api/training/enroll creates enrollment, returns existing if duplicate
- [x] PATCH /api/training/progress marks lesson complete
- [x] Integration tests for all API routes with role checks
- [x] E2E tests for catalog → enroll → complete lesson flow

## Technical Notes
- API routes: `app/api/training/courses`, `app/api/training/enroll`, `app/api/training/progress`, `app/api/training/courses/[slug]`
- Reuses existing `course_enrollments` and `lesson_progress` tables
- Adds `navigation_mode` column to `courses` table via migration `20260312000008`
- Shared data layer at `src/lib/training/data.ts` with `getCatalogData`, `getCourseData`, `getLessonData`
- Pure utility functions at `src/lib/training/progress.ts`: `calculateProgress`, `isLessonAccessible`, `getNextLessonSlug`, `formatDuration`
- LessonViewer component reused for read-only Tiptap rendering
- Video blocks use signed URLs from `/api/video/signed/[uid]`
- Zone filtering enforced in API routes AND server component data fetchers (belt-and-suspenders)
- Sales pages mirror training pages with `basePath="/sales"` and `zone="sales"`

## Test Coverage

### Unit Tests (53 tests)
- `tests/unit/lib/training/progress.test.ts` — 24 tests: calculateProgress, isLessonAccessible, getNextLessonSlug, formatDuration
- `tests/unit/components/training/CourseCard.test.tsx` — 11 tests: rendering, zone badges, enrollment states, links
- `tests/unit/components/training/ProgressRing.test.tsx` — 8 tests: SVG, aria, completion states
- `tests/unit/components/training/LessonNav.test.tsx` — 10 tests: navigation modes, completion, locking

### Integration Tests (30 tests)
- `tests/integration/training/courses.test.ts` — 10 tests: auth, role filtering, enrichment, zone scoping
- `tests/integration/training/enroll.test.ts` — 10 tests: auth, validation, zone access, duplicate handling
- `tests/integration/training/progress.test.ts` — 10 tests: auth, quiz gate, completion, course completion

### E2E Tests (24 tests)
- `tests/e2e/training/course-catalog.spec.ts` — 12 catalog + 12 navigation tests

**Total: 107 new tests, all passing**

## Known Limitations / Future Work
- No course search or filtering UI (catalog is a simple grid)
- No course ratings or reviews
- No certificates for internal courses (only certification tracks)
- ~~Quiz submission flow not built yet~~ — Done (quiz-player-and-grading feature)
- ~~CourseForm admin UI does not yet expose the navigation_mode setting~~ — Done (added dropdown)
