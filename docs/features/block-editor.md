# Feature: Block Editor

**Status:** Complete
**Zone:** admin / shared
**Last Updated:** 2026-03-12

## Overview
A Tiptap-based Notion-like block editor used throughout the admin CMS for authoring course lessons, knowledge base pages, and certification content. Includes a slash command menu, bubble toolbar, markdown import, embed blocks, and a read-only viewer for learners.

## Business Logic
- Admins author content using a rich block editor with slash commands and formatting toolbar
- Content is stored as Tiptap JSON (never HTML) in the database
- Markdown pasted into the editor is auto-detected and converted to blocks
- Embed blocks support YouTube, Vimeo, Loom, Figma, Google Slides, and generic iframes
- Embed blocks extract and store only the `src` URL, never raw HTML (security)
- Auto-save debounces 2 seconds after last keystroke
- Learners view content via a read-only renderer (LessonViewer)

## Technical Details
- BlockEditor.tsx: `'use client'` component with Tiptap + 16 extensions
- SlashMenu.tsx: floating panel with 13 block types, keyboard navigation (arrows, Enter, Escape), fuzzy filtering
- BubbleToolbar.tsx: positioned toolbar on text selection (Bold, Italic, Underline, Code, Link, Highlight)
- EmbedNode.ts: custom Tiptap Node extension storing `{ src, title, height, embedType }`
- EmbedInputPanel.tsx: inline panel for URL/iframe input with auto-detection
- MarkdownImportModal.tsx: modal with textarea, confirmation when replacing content
- LessonViewer.tsx: read-only Tiptap renderer with `editable: false`
- `src/lib/editor/embed-utils.ts`: pure functions for URL parsing and iframe src extraction
- `src/lib/editor/markdown-utils.ts`: heuristic-based markdown detection

## Task Checklist
- [x] Install all Tiptap extensions
- [x] Build embed URL parser utilities
- [x] Build markdown detection utility
- [x] Build custom EmbedBlock Tiptap node extension
- [x] Build slash command menu extension
- [x] Build BlockEditor.tsx with all block types
- [x] Build bubble menu toolbar
- [x] Implement auto-save with debounce + status indicator
- [x] Build markdown import modal
- [x] Build LessonViewer.tsx (read-only)
- [x] Unit tests: markdown detection, embed URL parsers, iframe extraction
- [x] E2E tests: editor interactions, slash menu, markdown paste, embed

## Test Coverage
- Unit: `tests/unit/editor/embed-utils.test.ts` (29 tests)
- Unit: `tests/unit/editor/markdown-utils.test.ts` (12 tests)
- E2E: `tests/e2e/admin/block-editor.spec.ts` (12 tests)
- Total: 41 unit + 12 E2E = 53 tests, all passing

## Known Limitations / Future Work
- Side '+' button on empty lines: deferred — slash command via `/` provides the same functionality
- VideoBlock integration: deferred to video-lessons feature (Cloudflare Stream)
- Image upload: currently URL-based only; file upload to Supabase Storage deferred
- Collaborative editing: not in scope
- Table cell merging/splitting: not yet implemented
- Callout block type: not yet implemented (can be added as custom extension)
