# Sales Enablement Materials — Implementation Checklist

## Phase 1: Database & Backend

### Database
- [ ] Run migration: create `sales_materials` table
- [ ] Run migration: create `sales_material_categories` table
- [ ] Run migration: add full-text search vector + GIN index
- [ ] Run migration: add `updated_at` trigger
- [ ] Configure RLS: sales read (published only)
- [ ] Configure RLS: admin full CRUD
- [ ] Configure RLS: anon read (shareable + published, scoped by share_token)
- [ ] Create Supabase Storage bucket `sales-materials` (private)

### API Routes
- [ ] `GET /api/sales/materials` — list with type/category/search filters, pagination
- [ ] `GET /api/sales/materials/[slug]` — single material with signed file URL
- [ ] `GET /api/sales/materials/categories` — distinct categories list
- [ ] `POST /api/admin/sales-materials` — create with Zod validation
- [ ] `PATCH /api/admin/sales-materials/[id]` — partial update
- [ ] `DELETE /api/admin/sales-materials/[id]` — soft delete (status → archived)
- [ ] `POST /api/admin/sales-materials/[id]/upload` — file upload (50MB limit, MIME validation)
- [ ] `GET /api/public/materials/[shareToken]` — public share (no auth, returns material + signed file URL)

### Utilities
- [ ] `lib/sales-materials/share-token.ts` — generate 12-char alphanumeric tokens
- [ ] `lib/sales-materials/data.ts` — data fetching helpers (getMaterials, getMaterial, getCategories)
- [ ] `lib/sales-materials/validation.ts` — Zod schemas for create/update

## Phase 2: Frontend — Sales Rep

### Sales Landing Page
- [ ] Install shadcn `tabs` component
- [ ] Update `/sales/page.tsx` — add SalesTabs with Courses and Materials tabs
- [ ] URL query param sync for active tab (`?tab=materials`)

### Materials Library
- [ ] `MaterialCard` component (title, type badge, category, description, updated date, share button)
- [ ] `MaterialGrid` component (grid/list toggle, responsive columns)
- [ ] `MaterialFilters` component (search input, type Select, category Select)
- [ ] Empty states (no materials, no search results)

### Material Detail
- [ ] `/sales/materials/[slug]/page.tsx` — detail page
- [ ] `MaterialViewer` component — renders Tiptap content OR file download card
- [ ] Breadcrumb navigation back to materials list
- [ ] `ShareDialog` — copy public link, show disabled state when not shareable

## Phase 3: Frontend — Admin CMS

### List View
- [ ] `/admin/sales-materials/page.tsx` — DataTable with status badges, type, category
- [ ] Bulk actions: publish, archive
- [ ] Filter/search in admin list

### Create / Edit
- [ ] `/admin/sales-materials/new/page.tsx` — create form
- [ ] `/admin/sales-materials/[id]/edit/page.tsx` — edit form
- [ ] Form fields: title, slug (auto-generated), description, type, category, tags, status
- [ ] Content mode toggle: Rich Text (Tiptap editor) vs File Upload
- [ ] File upload with drag-and-drop, progress indicator, MIME/size validation
- [ ] Public share toggle with generated token display + copy button
- [ ] Category management (create new inline or select existing)

## Phase 4: Public Share Page
- [ ] `/share/[token]/page.tsx` — standalone layout without app sidebar/nav
- [ ] Renders material title, content (rich text or file download)
- [ ] Branded header with logo, minimal footer
- [ ] 404 for invalid/revoked tokens

## Phase 5: Testing

### Unit Tests
- [ ] `tests/unit/sales-materials/share-token.test.ts`
- [ ] `tests/unit/sales-materials/filters.test.ts`
- [ ] `tests/unit/sales-materials/validation.test.ts`
- [ ] `tests/unit/sales-materials/slug.test.ts`

### Integration Tests
- [ ] `tests/integration/sales-materials/list.test.ts` — role matrix, filtering, pagination
- [ ] `tests/integration/sales-materials/detail.test.ts` — role access, draft visibility
- [ ] `tests/integration/sales-materials/admin-crud.test.ts` — create, update, delete
- [ ] `tests/integration/sales-materials/upload.test.ts` — file upload validation
- [ ] `tests/integration/sales-materials/public-share.test.ts` — token access, revoked tokens
- [ ] `tests/integration/sales-materials/categories.test.ts`
- [ ] `tests/integration/sales-materials/search.test.ts`

### E2E Tests
- [ ] `tests/e2e/sales/materials-browse.spec.ts` — browse, filter, search
- [ ] `tests/e2e/sales/materials-detail.spec.ts` — view, download, share
- [ ] `tests/e2e/sales/materials-admin.spec.ts` — admin CRUD flow
- [ ] `tests/e2e/sales/materials-public.spec.ts` — public share page
