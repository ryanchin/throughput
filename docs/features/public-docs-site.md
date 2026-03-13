# Feature: Public Docs Site

**Status:** Complete
**Zone:** docs (public)
**Last Updated:** 2026-03-13

## Purpose
Public-facing Docusaurus 3 documentation site for the AAVA methodology. Provides structured reference docs, getting started guides, certification overviews, and methodology breakdowns organized by PM lifecycle stage. Deploys separately to Vercel as a standalone static site.

## User Stories
- As a visitor, I can browse AAVA methodology documentation without logging in
- As a visitor, I can view embedded content (videos, slides, diagrams) in docs
- As an admin, I can add new docs pages with embeds using MDX

## Acceptance Criteria
- [x] Docusaurus 3 site scaffolded at /docs-site with TypeScript
- [x] AAVA brand colors applied (dark mode default, light mode available)
- [x] Nav structure: Getting Started, AAVA Methodology, Certifications, Guides
- [x] Methodology sub-sections by PM lifecycle stage (7 phases, 28 pages)
- [x] Stub .md files for each methodology flow
- [x] Reusable Embed component for sandboxed iframes
- [x] Embed usage guide doc
- [x] vercel.json for standalone deployment
- [x] Main app TopNav "Docs" link to docs.aava.ai
- [x] E2E tests: nav sections load, content renders, dark mode, Embed guide

## Technical Notes
- Separate Docusaurus 3 project at /docs-site (not part of Next.js app)
- Uses Docusaurus/Infima CSS variables mapped to AAVA design tokens
- Sidebar manually configured in sidebars.ts for precise control
- Docs serve as homepage (routeBasePath: '/')
- Blog disabled
- Embed component: sandboxed iframe with allow-scripts, allow-same-origin, allow-presentation
- Methodology content based on AAVA PM lifecycle stages from CLAUDE.md
- TopNav in main app handles external links with `<a>` tags (target="_blank")

## Test Coverage

### E2E Tests (14 tests)
- `docs-site/tests/e2e/docs-site.spec.ts` — 14 tests:
  - Navigation (6): intro page, getting started, methodology, certifications, methodology sub-pages, certification tiers
  - Sidebar (1): main sections visible
  - Content (3): quick links, lifecycle table, certification tier table
  - Embed (1): embedding guide page loads
  - Dark Mode (1): loads in dark mode by default
  - Navbar (2): AAVA Docs title, Throughput link

**Total: 14 tests, all passing**

## Known Limitations / Future Work
- Content is stub-only — needs full methodology content written by SMEs
- agentic_flows_pm_acceleration.xlsx not found in repo — flow content generated from CLAUDE.md structure
- No Algolia search — Docusaurus built-in search only
- No CI/CD pipeline for docs site (manual Vercel deploy)
- Search E2E test omitted (requires Algolia or docusaurus-search-local plugin fully configured)
