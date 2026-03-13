# Feature: Knowledge Support Docs

**Status:** Complete
**Zone:** knowledge (shared)
**Last Updated:** 2026-03-13

## Purpose
The Knowledge zone is a scoped support documentation section where users browse how-tos, reference guides, FAQs, and process docs outside of formal courses. Content is stored in the existing docs_pages table with visibility controls (public, internal, group-scoped). Includes a nested nav tree, Tiptap read-only viewer, admin CMS, group management, and full-text search across all content types.

## User Stories
- As an employee, I can browse internal knowledge articles relevant to my role
- As a sales team member, I can access sales-specific knowledge pages scoped to my group
- As a public user, I can view public knowledge pages without logging in
- As an admin, I can create, edit, reorder, and manage knowledge pages with visibility controls
- As an admin, I can manage user group memberships for group-scoped content
- As any user, I can search across all content types (knowledge, courses, lessons, certifications)

## Acceptance Criteria
- [x] Migration: visibility column on docs_pages, user_groups table, tsvector search column with GIN index
- [x] RLS policies for three visibility levels + group join check
- [x] /knowledge route with left sidebar nav tree (recursive CTE, collapsible, visibility-filtered)
- [x] /knowledge/[...slug] nested routing with Tiptap read-only content viewer
- [x] Knowledge home page with featured sections and recently updated pages
- [x] Admin CMS at /admin/knowledge with page tree, CRUD, drag-to-reorder, visibility/status controls
- [x] Page editor with title, slug, visibility dropdown, parent selector, block editor
- [x] Group management in /admin/users (add/remove group tags)
- [x] Global search across knowledge pages, lessons, courses, cert tracks
- [x] Search results grouped by content type, access-filtered
- [x] Navigation: Knowledge link for authenticated non-public users
- [x] Public knowledge pages accessible without login
- [x] Integration tests: nav visibility, page access, admin CRUD, search filtering
- [x] E2E tests: browse, content render, visibility enforcement, admin page creation
- [x] Unit tests: nav tree builder, visibility filter logic

## Technical Notes
- Reuses docs_pages table with added visibility column
- Recursive CTE query for nav tree (see CLAUDE.md)
- Tiptap EditorContent in read-only mode for page viewing
- Postgres tsvector full-text search (no AI/embeddings)
- user_groups join table for group-scoped visibility
- Admin CMS reuses BlockEditor component
- Draft/published workflow same as courses

## Test Coverage
- Unit: `tests/unit/knowledge/nav-tree.test.ts` (28 tests — buildNavTree, filterNavTree, canAccessVisibility, findNodeByPath, buildBreadcrumbs)
- Unit: `tests/unit/knowledge/search.test.ts` (15 tests — globalSearch across all content types)
- Integration: `tests/integration/knowledge/knowledge-routes.test.ts` (36 tests — all API routes, auth, RBAC, CRUD, search, groups)
- E2E: `tests/e2e/knowledge/knowledge-browse.spec.ts` (13 tests — sidebar, home page, page viewer, breadcrumbs)
- E2E: `tests/e2e/knowledge/admin-knowledge.spec.ts` (12 tests — CMS page tree, status/visibility badges, CRUD actions)
- E2E: `tests/e2e/knowledge/search.spec.ts` (7 tests — search bar, results, type badges, no-results state)

## Known Limitations / Future Work
- No AI-powered search (pure Postgres FTS)
- No version history for knowledge pages
- Group names are free-form text (no predefined list)
- No inline commenting or feedback on knowledge pages
