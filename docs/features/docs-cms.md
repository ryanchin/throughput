# Feature: Database-Backed Docs CMS

**Status:** In Progress
**Zone:** admin + docs (public)
**Last Updated:** 2026-03-13

## Purpose

Replaces the filesystem-based markdown docs with a database-backed CMS. Documentation pages are stored in the `docs_pages` table (same as knowledge pages) with `type='docs'`. This gives admins a WYSIWYG block editor for docs content, eliminating the need to manage markdown files and deploy changes.

## User Stories

- As an admin, I can create, edit, and publish documentation pages through the admin CMS
- As an admin, I can organize docs into a nested tree hierarchy with parent pages
- As a visitor, I can browse published documentation pages without logging in
- As a visitor, I can navigate docs via a sidebar tree and breadcrumbs

## Acceptance Criteria

- [x] Database migration adds `type` column to `docs_pages` with 'knowledge' and 'docs' values
- [x] database.types.ts updated with `DocsPageType` and `type` field on docs_pages
- [x] Knowledge queries filter by `type` parameter (defaults to 'knowledge')
- [x] Knowledge POST route includes `type: 'knowledge'` in inserts
- [x] Admin docs API routes: GET/POST at `/api/admin/docs-pages`, GET/PATCH/DELETE at `/api/admin/docs-pages/[pageId]`
- [x] Public docs nav API route at `/api/docs/nav`
- [x] Admin docs list page at `/admin/docs` with page tree, status toggles, delete, new page modal
- [x] Admin docs editor page at `/admin/docs/[pageId]` with BlockEditor and auto-save
- [x] Admin layout nav includes "Docs" link
- [x] Public `/docs` page reads from DB (intro page)
- [x] Public `/docs/[...slug]` reads from DB with breadcrumbs and LessonViewer
- [x] Public docs layout fetches nav tree from DB
- [x] DocsSidebar updated to accept NavTreeNode data
- [x] Seed script at `scripts/seed-docs.ts` converts markdown to Tiptap JSON

## Technical Notes

### Database
- Added `type text not null default 'knowledge' check (type in ('knowledge', 'docs'))` to `docs_pages`
- Indexes on `type` and `(type, status)` for query performance
- Docs pages always have `visibility = 'public'` (no visibility controls in admin UI)

### API Routes
- `POST/GET /api/admin/docs-pages` — mirrors knowledge route pattern with `type='docs'`
- `GET/PATCH/DELETE /api/admin/docs-pages/[pageId]` — includes `type='docs'` filter on all queries
- `GET /api/docs/nav` — public, no auth, returns nav tree with caching headers

### Admin UI
- List page: same pattern as knowledge admin, without visibility column
- Editor page: same pattern as knowledge editor, without visibility controls
- New page modal: title + slug + parent only (no visibility selector)

### Public Pages
- Layout fetches nav tree directly from DB (server component)
- Docs home page shows intro page or first top-level page
- Slug pages use `fetchPageBySlug(path, 'docs')` and render with LessonViewer
- Breadcrumbs built from slug segments

### Seed Script
- `npx tsx scripts/seed-docs.ts`
- Reads `src/content/docs/` markdown files
- Parses frontmatter for title and sidebar_position
- Converts markdown to Tiptap JSON (headings, paragraphs, lists, code blocks, blockquotes, inline marks)
- Preserves tree structure via parent-child relationships
- Deletes existing docs pages before re-seeding

### Files Changed/Created
- `supabase/migrations/20260313000002_docs_pages_type_column.sql` (new)
- `src/lib/supabase/database.types.ts` (updated)
- `src/lib/knowledge/queries.ts` (updated — type filter)
- `src/app/api/admin/knowledge/route.ts` (updated — type in insert)
- `src/app/api/admin/docs-pages/route.ts` (new)
- `src/app/api/admin/docs-pages/[pageId]/route.ts` (new)
- `src/app/api/docs/nav/route.ts` (new)
- `src/app/(app)/admin/docs/page.tsx` (new)
- `src/app/(app)/admin/docs/[pageId]/page.tsx` (new)
- `src/app/(app)/admin/layout.tsx` (updated — Docs nav link)
- `src/app/(public)/docs/layout.tsx` (updated — DB nav tree)
- `src/app/(public)/docs/DocsSidebarWrapper.tsx` (updated — NavTreeNode type)
- `src/app/(public)/docs/page.tsx` (updated — DB intro page)
- `src/app/(public)/docs/[...slug]/page.tsx` (updated — DB page fetch)
- `src/components/docs/DocsSidebar.tsx` (updated — NavTreeNode interface)
- `scripts/seed-docs.ts` (new)

## Task Checklist

- [x] Database migration for `type` column
- [x] Update database.types.ts
- [x] Update knowledge queries with type filter
- [x] Update knowledge POST to include type
- [x] Create admin docs API routes (GET, POST, PATCH, DELETE)
- [x] Create public docs nav API route
- [x] Create admin docs list page
- [x] Create admin docs editor page
- [x] Add Docs link to admin nav
- [x] Update public /docs pages to read from DB
- [x] Update DocsSidebar for DB data
- [x] Create seed script
- [ ] Backend tests
- [ ] Frontend tests

## Known Limitations / Future Work

- Filesystem-based `src/lib/docs/` code is kept as fallback (not deleted)
- `src/content/docs/` markdown files are kept as reference
- The seed script does basic markdown-to-Tiptap conversion — complex tables and nested lists may not convert perfectly
- No search integration yet for docs pages
- No drag-to-reorder in the admin docs list (placeholder drag handles only)
