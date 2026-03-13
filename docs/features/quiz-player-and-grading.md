# Feature: Quiz Player & Grading

**Status:** Complete
**Zone:** training + sales (shared learner components)
**Last Updated:** 2026-03-12

## Purpose
Learner-facing quiz experience with immediate MC/TF scoring and LLM-powered open-ended grading. Integrated into the lesson flow — learners must pass quizzes before completing lessons. Results include per-question feedback, LLM narrative for open-ended responses, and aggregate scoring.

## User Stories
- As a learner, I can take a quiz with MC, T/F, and open-ended questions one at a time
- As a learner, I see my score and per-question feedback immediately after submission
- As a learner, I see detailed AI feedback for open-ended questions
- As a learner, I can retake quizzes if I don't pass
- As a learner, I can advance to the next lesson after passing the quiz

## Acceptance Criteria
- [x] QuizPlayer component: one question per screen with Back/Next navigation
- [x] Progress indicator: "Question X of Y"
- [x] MC: radio button options (styled as selectable cards)
- [x] True/False: two large toggle buttons
- [x] Open Ended: textarea with character count, min 50 chars
- [x] Submit button on final question only
- [x] beforeunload warning for unsaved answers
- [x] POST /api/quiz/submit: validates enrollment, scores MC/TF, grades open-ended via LLM
- [x] Creates quiz_attempt and question_responses rows via service role
- [x] gradeOpenEndedResponse() in lib/openrouter/grader.ts
- [x] calculateCourseScore() and calculateQuizScore() in lib/scoring/calculator.ts
- [x] Results display: score badge, per-question breakdown, LLM feedback cards
- [x] Loading state during open-ended grading ("Your responses are being reviewed by AI...")
- [x] "Retake Quiz" and "Next Lesson" buttons on results
- [x] Quiz page at /training/[courseSlug]/[lessonSlug]/quiz
- [x] Sales mirror at /sales/[courseSlug]/[lessonSlug]/quiz
- [x] Unit tests for scorer and grader
- [x] Integration tests for submit API
- [x] E2E tests for full quiz flow

## Technical Notes
- API route: `POST /api/quiz/submit`
- Uses `createServiceClient()` for all DB writes (quiz_attempts, question_responses) since RLS only allows admin writes
- Uses `createClient()` for reads (enrollment check, quiz/question fetch) to respect RLS
- OpenRouter model: `openai/gpt-oss-120b` for open-ended grading via `callOpenRouter()` client
- LLM grading failures handled gracefully — score=0 with fallback message, doesn't crash submission
- Quiz page strips `is_correct` from MC options server-side (learners never see correct answers in source)
- `parseGradeResponse()` exported separately for testability — validates/clamps all LLM output
- Correct answers only revealed for MC/TF in results, not for open-ended

## Test Coverage

### Unit Tests (51 tests)
- `tests/unit/lib/scoring/calculator.test.ts` — 16 tests: calculateCourseScore (8), calculateQuizScore (8)
- `tests/unit/lib/openrouter/grader.test.ts` — 11 tests: parseGradeResponse validation, clamping, fallbacks
- `tests/unit/components/training/QuizPlayer.test.tsx` — 12 tests: rendering, navigation, question types, states
- *Existing:* `tests/unit/quiz/calculator.test.ts` — calculateTotalPoints, calculatePercentage

### Integration Tests (12 tests)
- `tests/integration/training/quiz-submit.test.ts` — 12 tests: auth, validation, enrollment check, MC/TF scoring, LLM grading, failure handling, attempt numbering, pass/fail

### E2E Tests (34 tests)
- `tests/e2e/training/quiz-player.spec.ts` — 17 player + 11 results-passed + 6 results-failed

**Total: 97 new tests, all passing**
**Full suite: 506 unit/integration + 34 E2E = 540 total**

## Known Limitations / Future Work
- No quiz timer (certification exams will need timed mode)
- No question-level analytics (which questions are hardest)
- No partial credit for MC (all-or-nothing)
- Open-ended grading is synchronous — may want async for large quizzes
- ~~No max attempts limit per quiz~~ — Done (added max_attempts column + admin UI + 429 enforcement)
