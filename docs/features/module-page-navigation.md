# Feature: Module Page Navigation

**Status:** Complete
**Zone:** training, sales
**Last Updated:** 2026-03-18

## Purpose
Transform the lesson viewing experience from a single scrollable wall of text into bite-sized pages. Each `## heading` in lesson content becomes a separate page with Previous/Next navigation, a progress bar, and keyboard support. This makes AI-generated courses feel like real training — learners click through pages and feel progress.

## User Stories
- As a learner, I can navigate through a module page-by-page so I'm not overwhelmed by a wall of text
- As a learner, I can see my progress within a module via a progress bar
- As a learner, I can use keyboard arrows to navigate between pages
- As a learner, I can jump to any page in a module via the sidebar TOC
- As a learner, I can take a quiz seamlessly as the final page of a module

## Acceptance Criteria
- [ ] Content splits at `## heading` boundaries into separate pages
- [ ] SectionPaginator with Previous/Next buttons, page count, progress bar
- [ ] Previous hidden on page 1, Next shows "Take Quiz →" before quiz
- [ ] Sidebar shows expandable page list under active module
- [ ] Keyboard navigation (Left/Right arrow keys)
- [ ] 150ms fade-in transitions between pages
- [ ] Single-page modules hide paginator entirely
- [ ] Quiz renders as final page in the paginator
- [ ] URL persists page state via `?page=N` query param
- [ ] Reduced motion support
- [ ] Mobile responsive (44px touch targets)
- [ ] AI prompts updated for 5-10 sections of 400-800 words

## Technical Notes
- Zero DB changes — client-side rendering change only
- `splitContentIntoPages()` utility in `src/lib/training/content-splitter.ts`
- `SectionPaginator` component in `src/components/training/SectionPaginator.tsx`
- Updated `LessonNav` sidebar with page-level TOC
- Updated lesson page to use paginator
- AI prompt updates in course and lesson generation routes

## Test Coverage
- Unit: `tests/unit/training/content-splitter.test.ts`
- E2E: `tests/e2e/training/module-pages.spec.ts`

## Known Limitations / Future Work
- Per-page progress tracking (currently per-lesson only)
- Explicit section editing in admin (currently headings determine pages)
- Section reordering in admin UI
