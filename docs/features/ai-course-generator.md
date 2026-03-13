# Feature: AI Course Generator

**Status:** Complete
**Zone:** admin
**Last Updated:** 2026-03-12

## Purpose
LLM-powered course and lesson content generator. Admins describe a course in plain language and the AI generates a complete structured draft with lessons, quizzes, and questions — all in draft status for review before publishing. Individual lessons can also be regenerated independently.

## User Stories
- As an admin, I can toggle "Generate with AI" on the new course form to have the LLM create a full course draft
- As an admin, I can specify the number of lessons, audience, and whether to include quizzes
- As an admin, I see a loading overlay while the course is being generated
- As an admin, I am redirected to the course editor after generation to review the draft
- As an admin, I can regenerate individual lesson content from the lesson editor
- As an admin, I am warned before replacing existing lesson content

## Acceptance Criteria
- [x] "Generate with AI" toggle on new course form
- [x] AI form fields: description (required), lesson count (1–20, default 5), include quizzes toggle (default on)
- [x] POST /api/admin/generate/course with Zod validation
- [x] OpenRouter integration with system prompt from CLAUDE.md
- [x] LLM JSON response parser with validation
- [x] All-or-nothing DB transaction: course + lessons + quizzes + questions created in draft status
- [x] Markdown content_outline parsed into Tiptap JSON for lesson content
- [x] Redirect to course editor after generation
- [x] Full-page loading overlay during generation
- [x] POST /api/admin/generate/lesson for single lesson regeneration
- [x] "Regenerate with AI" button in lesson editor with confirmation dialog
- [x] Inline loading spinner during lesson regeneration
- [x] Unit tests for LLM response parser and markdown-to-Tiptap conversion
- [x] Integration tests for generate/course API route
- [x] E2E tests for generation workflow

## Technical Notes
- API routes: `app/api/admin/generate/course/` and `app/api/admin/generate/lesson/`
- Uses OpenRouter API with `openai/gpt-oss-120b` model
- LLM response parsed and validated with Zod before DB insertion
- Markdown-to-Tiptap conversion via custom line-by-line parser supporting headings, lists, bold, italic, code blocks, blockquotes
- DB writes use Supabase service role client; rollback deletes course on failure (cascade cleans children)
- All generated content has status = 'draft'

## Test Coverage
- Unit: `tests/unit/lib/generate/parser.test.ts` (11 tests)
- Unit: `tests/unit/lib/generate/markdown-to-tiptap.test.ts` (13 tests)
- Integration: `tests/integration/admin/generate-course.test.ts` (17 tests)
- E2E: `tests/e2e/admin/ai-generator.spec.ts` (13 tests)
- **Total: 54 tests (all passing)**

## Known Limitations / Future Work
- No streaming — waits for full LLM response before processing
- No partial regeneration (regenerate single quiz, reorder generated lessons)
- Question pool generation for certification tracks is a separate feature
- No cost tracking for OpenRouter usage yet
