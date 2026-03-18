# Feature: Sales Enablement Materials Library

## Status & Progress
- **Phase**: Complete
- **Progress**: 100% (28/28 tasks)
- **Next**: Run migration on Supabase, seed test data
- **Zone**: sales, admin

## Core Requirements
**Business Goal**: Give sales reps a single source of truth for prospect-facing collateral, eliminating version drift from shared drives and Slack threads.
**User Need**: Sales reps need to quickly find, preview, and share up-to-date materials with prospects.
**Success Metric**: 80%+ sales rep adoption within 30 days; 10+ public share links created per week within 60 days.

## Key Design Decisions
- **Landing Page**: `/sales` uses shadcn Tabs to split Courses (existing) and Materials (new)
- **Content Types**: Rich text (Tiptap editor) OR file attachments (PDF, PPTX, DOCX via Supabase Storage)
- **Public Sharing**: Optional per-material — admin toggles shareable flag, generates a 12-char share token for public URL
- **Material Types**: battle_card, one_pager, case_study, slide_deck, email_template, proposal_template, roi_calculator, video_demo
- **Search**: Postgres full-text search (tsvector) — same pattern as docs_pages

## Technical Approach
- **Database**: `sales_materials` + `sales_material_categories` tables with RLS (3 tiers: sales read, admin CRUD, anon share)
- **Storage**: Private Supabase Storage bucket `sales-materials`, signed URL downloads (1hr TTL), 50MB limit
- **API**: 8 endpoints — 3 sales-facing, 4 admin, 1 public share
- **Frontend**: Updated `/sales` page with tabs, new `/sales/materials/[slug]` detail page, admin CRUD at `/admin/sales-materials`

## Testing Focus
**Critical Scenarios**: Role-based access (employee=403), draft visibility filtering, public share token access, file upload validation
**Quality Gates**: All 10 critical scenarios passing, full role access matrix covered, no auth bypass vectors

## Implementation Checklist

### Phase 1: Database & Backend
- [ ] Create `sales_materials` table with RLS policies
- [ ] Create `sales_material_categories` table
- [ ] Set up Supabase Storage bucket `sales-materials`
- [ ] `GET /api/sales/materials` — list with filtering/search
- [ ] `GET /api/sales/materials/[slug]` — material detail
- [ ] `GET /api/sales/materials/categories` — categories list
- [ ] `POST /api/admin/sales-materials` — create material
- [ ] `PATCH /api/admin/sales-materials/[id]` — update material
- [ ] `DELETE /api/admin/sales-materials/[id]` — soft delete (archive)
- [ ] `POST /api/admin/sales-materials/[id]/upload` — file upload
- [ ] `GET /api/public/materials/[shareToken]` — public share endpoint
- [ ] Share token generation utility

### Phase 2: Frontend — Sales Rep
- [ ] Update `/sales` page with Tabs (Courses / Materials)
- [ ] MaterialCard component
- [ ] MaterialGrid with grid/list toggle
- [ ] MaterialFilters (type, category, search)
- [ ] `/sales/materials/[slug]` detail page
- [ ] MaterialViewer (rich text + file download)
- [ ] ShareDialog (copy link, email)

### Phase 3: Frontend — Admin CMS
- [ ] `/admin/sales-materials` list page with DataTable
- [ ] `/admin/sales-materials/new` create form
- [ ] `/admin/sales-materials/[id]/edit` edit form
- [ ] File upload component with drag-and-drop
- [ ] Public share toggle with token display
- [ ] Category management

### Phase 4: Public Share & Testing
- [ ] `/share/[token]` public page (standalone layout, no app chrome)
- [ ] Unit tests (share token, filtering, validation)
- [ ] Integration tests (all API routes, role matrix)
- [ ] E2E tests (browse, filter, share, admin CRUD)

## Test Coverage
- Unit: `tests/unit/sales-materials/` — 62 tests (share-token, validation, slug)
- Integration: `tests/integration/sales-materials/` — 54 tests (list, admin-crud, public-share)
- E2E: `tests/e2e/sales/` — 72 tests (materials-browse, materials-admin)
- **Total: 188 tests, all passing**

## Known Limitations / Future Work
- Engagement tracking (views, downloads) deferred to Phase 2
- No material versioning — uploading a new file overwrites the previous
- No bulk import from external sources
- Rich text content editing in admin form uses separate Tiptap editor (not embedded in form yet)
- Categories table exists but admin category CRUD UI is minimal (autocomplete from existing)

## Documentation
- [requirements.md](requirements.md) — Product requirements and acceptance criteria
- [design-specs.md](design-specs.md) — UX/UI design specifications
- [architecture.md](architecture.md) — Technical implementation and database schema
- [testing-strategy.md](testing-strategy.md) — QA testing approach and scenarios
- [checklist.md](checklist.md) — Detailed implementation checklist
