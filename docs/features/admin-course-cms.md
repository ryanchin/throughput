# Feature: Admin Course CMS

**Status:** Complete
**Zone:** admin
**Last Updated:** 2026-03-12

## Purpose
Full admin CMS for creating and managing courses and lessons. Admins can create courses, add and reorder lessons, edit content with the block editor, and manage draft/published status — all from a centralized admin interface.

## User Stories
- As an admin, I can view all courses with their status, zone, lesson count, and enrollment count
- As an admin, I can create a new course with title, description, zone, and cover image
- As an admin, I can edit a course's metadata and manage its lessons
- As an admin, I can add, reorder, and delete lessons within a course
- As an admin, I can edit lesson content using the block editor with auto-save
- As an admin, I can publish/unpublish courses and lessons from the CMS

## Acceptance Criteria
- [x] Course list page at /admin/courses with title, zone badge, status badge, lesson count, enrollment count, last updated, Edit/Delete actions
- [x] "New Course" button and create form
- [x] Course edit form with: title, slug (auto-generated, editable), description, cover image upload, zone dropdown, passing score
- [x] Slug uniqueness validation on blur
- [x] Lesson management: ordered list with drag-to-reorder (dnd-kit)
- [x] Lesson rows with title, status toggle, Edit/Delete
- [x] "Add Lesson" button
- [x] Lesson editor with split-pane: left = metadata + BlockEditor, right = placeholder for Quiz Builder
- [x] Auto-save wired to lessons.content (jsonb)
- [x] All CRUD via API routes with Zod validation
- [x] Unit tests for slug generation
- [x] Integration tests for course/lesson CRUD + RLS
- [x] E2E tests for full admin workflow

## Technical Notes
- API routes in `app/api/admin/courses/` and `app/api/admin/courses/[courseId]/lessons/`
- Uses `requireAdmin()` helper for auth in all routes
- Cover image upload to Supabase Storage `course-covers` bucket
- Drag-to-reorder uses `@dnd-kit/core` + `@dnd-kit/sortable`
- BlockEditor from existing `src/components/editor/BlockEditor.tsx` wired to auto-save
- Slug generation: `lib/utils/slug.ts` — title → kebab-case with collision handling

## Test Coverage
- Unit: `tests/unit/utils/slug.test.ts` (24 tests)
- Unit: `tests/unit/components/admin/CourseActions.test.tsx` (8 tests)
- Unit: `tests/unit/admin/CourseForm.test.tsx` (25 tests)
- Unit: `tests/unit/components/admin/LessonList.test.tsx` (22 tests)
- Unit: `tests/unit/components/admin/LessonEditor.test.tsx` (18 tests)
- Integration: `tests/integration/admin/courses-crud.test.ts` (37 tests)
- Integration: `tests/integration/admin/courses-list.test.ts` (6 tests)
- E2E: `tests/e2e/admin/course-cms.spec.ts` (41 tests)
- **Total: 181 tests (all passing)**

## Known Limitations / Future Work
- Cover image upload requires Supabase Storage bucket setup (manual step)
- Quiz Builder placeholder in lesson editor — built in next feature
- Bulk operations (delete multiple courses) not included
