# Feature: AI Content Generation Upgrade

**Status:** Complete
**Zone:** admin
**Last Updated:** 2026-03-18

## Purpose
Upgrade the AI generation experience for courses, certifications, and lessons. Currently courses have a basic AI toggle with no custom instructions or context, and certifications have no AI at all. This feature adds a shared AI Context Panel with style presets, instructions, file upload, and course context picking — used across all three content types.

## User Stories
- As an admin, I can provide custom instructions to the AI so generated content matches my specific needs
- As an admin, I can upload reference documents (PDF/DOCX) so the AI uses my existing materials as context
- As an admin, I can select existing courses as context so certifications and new courses build on existing content
- As an admin, I can generate certification exam questions with AI instead of writing them all manually
- As an admin, I can generate additional questions for an existing certification track
- As an admin, I can choose a tone/style preset so I don't start from a blank instructions field
- As an admin, I can see a history of all AI generations for accountability

## Acceptance Criteria
- [x] Shared AiContextPanel component with style presets, instructions, file upload, course picker
- [x] File upload extracts text from PDF/DOCX with preview (3-line + expand)
- [x] Course picker shows searchable list with lesson count and word count
- [x] Smart context truncation (summarize if >12K words)
- [x] Extended course generation API with instructions, file context, course context
- [x] Extended lesson generation API with shared context
- [x] New certification question generation API
- [x] "Generate Questions" button on existing cert track editor
- [x] AI toggle + AiContextPanel on certification create/edit
- [x] CourseForm updated to use AiContextPanel
- [x] Generation history table + admin dashboard tab
- [x] Progressive generation overlay with status messages
- [x] All error states preserve form inputs

## Technical Notes
- Shared component: `src/components/admin/AiContextPanel.tsx`
- Context builder lib: `src/lib/generate/context-builder.ts`
- File extraction: `src/lib/generate/extract-file-text.ts` (pdf-parse + mammoth)
- New API: `POST /api/admin/generate/certification`
- Extended: `POST /api/admin/generate/course`, `POST /api/admin/generate/lesson`
- New table: `generation_logs`
- Smart truncation threshold: 12K words
- File size limit: 50MB (consistent with sales materials)

## Test Coverage
- Unit: `tests/unit/components/admin/AiContextPanel.test.tsx` (26 tests — presets, instructions, file upload, course picker)
- Unit: `tests/unit/components/admin/NewCertTrackForm.test.tsx` (12 tests — AI toggle, context panel, generation overlay, validation, submission flows)
- Unit: `tests/unit/components/admin/QuestionPoolManager.test.tsx` (17 tests — generate panel toggle, generation flow, error handling, overlay, mutual exclusion with add form)
- Integration: `tests/integration/admin/extract-text.test.ts` (7 tests — auth, validation, extraction, error handling)
- E2E: `tests/e2e/admin/ai-generation.spec.ts`

## Known Limitations / Future Work
- Single file upload only (no multi-file)
- No real-time streaming of LLM output
- No content versioning for AI-generated drafts
- No generation quality scoring / feedback mechanism
