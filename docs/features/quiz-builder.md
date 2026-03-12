# Feature: Quiz Builder

**Status:** Complete
**Zone:** admin
**Last Updated:** 2026-03-12

## Purpose
Admin quiz builder attached to lessons. Each lesson can have one quiz with multiple question types (multiple choice, true/false, open-ended). Questions are drag-to-reorder, auto-save on change, and include a preview mode showing the learner view.

## User Stories
- As an admin, I can create a quiz for a lesson with a title and instructions
- As an admin, I can add multiple choice, true/false, and open-ended questions
- As an admin, I can set correct answers, point values, and AI grading rubrics
- As an admin, I can reorder questions via drag-and-drop
- As an admin, I can preview the quiz as learners will see it
- As an admin, quiz changes auto-save without manual save actions

## Acceptance Criteria
- [x] QuizBuilder renders in right pane of lesson editor (replacing placeholder)
- [x] One quiz per lesson (one-to-one)
- [x] Quiz metadata: title, passing score
- [x] Questions list with drag-to-reorder (dnd-kit)
- [x] Add Question type picker: Multiple Choice, True/False, Open Ended
- [x] Multiple Choice: question text, 2-6 options, radio for correct answer, point value
- [x] True/False: question text, toggle for correct answer, point value
- [x] Open Ended: question text, rubric textarea, point value
- [x] Preview mode: renders quiz as learners see it (non-submittable)
- [x] Auto-save with 2s debounce (same pattern as block editor)
- [x] Total points calculator
- [x] Unit tests for quiz utilities
- [x] Integration tests for quiz/question CRUD
- [x] E2E tests for full quiz builder workflow

## Technical Notes
- API routes: `app/api/admin/courses/[courseId]/lessons/[lessonId]/quiz/`
- Uses existing `quizzes` and `questions` tables (already in schema)
- QuizBuilder replaces the "Quiz Builder coming soon" placeholder in LessonEditor
- Auto-save: debounced PATCH for quiz metadata, individual question saves
- Utility: `lib/quiz/calculator.ts` for total points computation
- Quiz data fetched server-side in lesson editor page and passed as props

## Test Coverage
- Unit: `tests/unit/quiz/calculator.test.ts` (8 tests)
- Integration: `tests/integration/admin/quiz-crud.test.ts` (50 tests)
- E2E: `tests/e2e/admin/quiz-builder.spec.ts` (25 tests)
- **Total: 83 tests (all passing)**

## Known Limitations / Future Work
- One quiz per lesson (no multiple quizzes)
- Quiz submission and grading built in a separate feature
- No question bank / question reuse across quizzes yet
