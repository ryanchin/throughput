# Sales Enablement Materials Library -- Product Requirements

**Status:** Draft
**Zone:** sales, admin
**Last Updated:** 2026-03-18
**Author:** Product

---

## Context and Why Now

The sales zone (`/sales/*`) currently offers only structured courses -- the same lessons-and-quizzes format used in training. Sales reps need quick access to prospect-facing collateral (battle cards, one-pagers, case studies, decks) without enrolling in a course. Today, these materials live in shared drives and Slack threads, leading to version drift, stale content, and reps sending outdated collateral to prospects.

Adding a Materials Library to the existing sales zone fills this gap using infrastructure we already have: Supabase Storage for files, the Tiptap block editor for rich-text materials, and the role-based access system for scoping visibility.

---

## Users and Jobs to Be Done

**Sales Rep** (role: `sales`)
- Browse and search collateral by type, category, or keyword so I spend less time hunting for the right asset
- Preview a material without downloading so I can confirm it is current before sharing
- Copy a public share link and send it directly to a prospect
- See which materials were recently added or updated so I always use the latest version

**Admin** (role: `admin`)
- Create and manage sales materials using the same block editor used for courses
- Upload file-based materials (PDF, PPTX, DOCX) alongside rich-text materials
- Control which materials are publicly shareable and which are internal-only
- Organize materials with types, categories, and tags
- See basic engagement data (views, downloads) to understand what reps actually use

---

## Business Goals and Success Metrics

### Leading Indicators
- Materials library adoption: 80%+ of sales reps access the library within 30 days of launch
- Search usage: average time-to-find-material under 15 seconds (measured via search-to-click latency)
- Share link generation: at least 10 public links created per week within 60 days

### Lagging Indicators
- Reduction in "where is the latest [X]?" messages in Slack sales channels (qualitative, survey-based)
- Prospect engagement: public share link view count trending upward month-over-month
- Content freshness: 90%+ of materials updated within the last 90 days (admin dashboard metric)

---

## Functional Requirements

### FR-1: Materials Listing and Browsing

Sales reps can browse all published materials on the `/sales` page under a "Materials" tab alongside the existing "Courses" tab.

**Acceptance Criteria:**
- [ ] `/sales` page renders two tabs: "Courses" (existing) and "Materials" (new)
- [ ] Materials tab shows a filterable grid of MaterialCard components
- [ ] Each MaterialCard displays: title, type badge, category, description excerpt, updated date, file type icon (for attachments)
- [ ] Filter bar supports: type (dropdown), category (dropdown), search (text input with debounce)
- [ ] Empty state when no materials match filters
- [ ] Materials sorted by `updated_at` descending by default
- [ ] Only `status = 'published'` materials appear for sales reps

### FR-2: Material Detail and Preview

Sales reps can open a material to view its full content or download the attached file.

**Acceptance Criteria:**
- [ ] `/sales/materials/[slug]` renders the material detail page
- [ ] Rich-text materials render via the existing read-only Tiptap `LessonViewer` component
- [ ] File-based materials show a file preview panel (PDF inline viewer, other types show metadata + download button)
- [ ] Download button for file-based materials generates a signed Supabase Storage URL (1-hour TTL)
- [ ] Back navigation returns to the materials tab with filter state preserved (URL query params)

### FR-3: Public Share Links

Admins can mark a material as publicly shareable. Sales reps can copy a public link to send to prospects.

**Acceptance Criteria:**
- [ ] Materials have a `shareable` boolean flag (default: false)
- [ ] When `shareable = true`, a "Copy Link" button appears on the MaterialCard and detail page
- [ ] Public URL format: `/share/materials/[shareToken]` -- uses a unique token, not the slug (prevents enumeration)
- [ ] Public share page renders material content without requiring login
- [ ] Public share page includes company branding (logo, accent colors) but no internal navigation
- [ ] `share_token` is a random 12-character alphanumeric string, generated on material creation, stored on the row
- [ ] RLS policy allows unauthenticated reads on materials where `shareable = true`, scoped to the share token lookup
- [ ] Admin can revoke shareability at any time (sets `shareable = false`; existing links return 404)

### FR-4: Admin Material Management

Admins create, edit, and organize materials in `/admin/sales-materials`.

**Acceptance Criteria:**
- [ ] `/admin/sales-materials` lists all materials (draft and published) with status badges
- [ ] "New Material" button opens a creation form with fields: title, slug (auto-generated, editable), type, category, tags, shareable toggle
- [ ] Content mode selector: "Rich Text" (opens Tiptap block editor) or "File Upload" (opens file uploader)
- [ ] File upload accepts: PDF, PPTX, DOCX, XLSX, PNG, JPG (max 50MB per file)
- [ ] Files stored in Supabase Storage bucket `sales-materials` with path `[materialId]/[filename]`
- [ ] A material can have BOTH rich-text content AND an attached file (e.g., a summary page with a downloadable deck)
- [ ] Draft/published workflow uses the existing status system -- same toggle pattern as courses
- [ ] Edit page uses the same Tiptap editor instance as the course lesson editor
- [ ] Delete requires confirmation dialog; soft-deletes by setting `status = 'archived'`
- [ ] Bulk actions: publish, unpublish, delete (checkbox selection on list page)

### FR-5: Material Types and Categories

Materials are organized by type and category for filtering and navigation.

**Acceptance Criteria:**
- [ ] `material_type` is an enum stored on the row: `battle_card`, `one_pager`, `case_study`, `slide_deck`, `email_template`, `proposal_template`, `roi_calculator`, `video_demo`, `other`
- [ ] `category` is a free-text field with autocomplete from existing categories (no separate categories table -- query distinct values)
- [ ] `tags` is a text array for additional filtering (e.g., `['enterprise', 'healthcare', 'q1-2026']`)
- [ ] Filter UI on `/sales` materials tab reflects these dimensions

### FR-6: Engagement Tracking (Nice to Have -- Phase 2)

Track views and downloads for admin reporting.

**Acceptance Criteria:**
- [ ] `material_views` table logs: material_id, user_id (nullable for public views), viewed_at, source (`internal` or `public_share`)
- [ ] `material_downloads` table logs: material_id, user_id (nullable), downloaded_at, source
- [ ] Admin materials list shows view count and download count columns
- [ ] Material detail page (admin) shows a simple engagement chart (views over time)
- [ ] Public share views are tracked with IP-based deduplication (1 view per IP per 24h)

---

## Data Model

### New Table: `sales_materials`

```sql
create table sales_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  material_type text not null,                -- enum values listed in FR-5
  category text,
  tags text[] default '{}',
  content jsonb,                              -- Tiptap JSON (nullable if file-only)
  file_path text,                             -- Supabase Storage path (nullable if rich-text-only)
  file_name text,                             -- Original filename for display
  file_size_bytes bigint,
  file_mime_type text,
  shareable boolean default false,
  share_token text unique,                    -- 12-char alphanumeric, generated on insert
  status text not null default 'draft',       -- 'draft' | 'published' | 'archived'
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index idx_sales_materials_status on sales_materials(status);
create index idx_sales_materials_type on sales_materials(material_type);
create index idx_sales_materials_share_token on sales_materials(share_token);
create index idx_sales_materials_search on sales_materials
  using gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));

-- RLS policies
-- Sales + admin: SELECT where status = 'published'
-- Admin: full CRUD
-- Public (anon): SELECT where shareable = true AND status = 'published', lookup by share_token only
```

### Phase 2 Tables (FR-6)

```sql
create table material_views (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references sales_materials(id) on delete cascade,
  user_id uuid references profiles(id),       -- null for public views
  source text not null default 'internal',     -- 'internal' | 'public_share'
  ip_hash text,                                -- SHA-256 of IP for dedup (public views)
  viewed_at timestamptz default now()
);

create table material_downloads (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references sales_materials(id) on delete cascade,
  user_id uuid references profiles(id),
  source text not null default 'internal',
  downloaded_at timestamptz default now()
);
```

---

## API Requirements

### Sales Rep Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/sales/materials` | List published materials with filtering (type, category, search, tags) |
| GET | `/api/sales/materials/[slug]` | Get single material detail (published only) |
| GET | `/api/sales/materials/[slug]/download` | Generate signed download URL for file attachment |

### Admin Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/admin/sales-materials` | List all materials (any status) |
| POST | `/api/admin/sales-materials` | Create new material |
| GET | `/api/admin/sales-materials/[id]` | Get material for editing |
| PATCH | `/api/admin/sales-materials/[id]` | Update material (content, metadata, status) |
| DELETE | `/api/admin/sales-materials/[id]` | Soft-delete (set status = 'archived') |
| POST | `/api/admin/sales-materials/[id]/upload` | Upload file attachment to Supabase Storage |
| DELETE | `/api/admin/sales-materials/[id]/upload` | Remove file attachment |

### Public Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/share/materials/[shareToken]` | Get shareable material (no auth required) |

### Validation

- All inputs validated with Zod schemas
- `title`: required, 1-200 chars
- `slug`: required, lowercase alphanumeric + hyphens, unique
- `material_type`: required, must be one of the enum values
- `file_size_bytes`: max 50MB (52,428,800 bytes)
- `file_mime_type`: must be in allowlist (application/pdf, application/vnd.openxmlformats-officedocument.*, image/png, image/jpeg)

---

## Non-Functional Requirements

- **Performance:** Materials list API responds in under 200ms for up to 500 materials with filters applied. Full-text search uses the Postgres GIN index, no external search service.
- **Storage:** Files stored in a dedicated `sales-materials` Supabase Storage bucket. Bucket policy: private (signed URLs for downloads). Budget: stay within Supabase free tier 1GB limit initially; monitor and upgrade if needed.
- **Security:** Public share links use opaque tokens (not slugs or UUIDs). Signed download URLs expire after 1 hour. RLS enforces role-based access at the database level. File upload restricted to allowlisted MIME types server-side (not just client-side).
- **Observability:** Log material creation, status changes, and share link generation events. Phase 2 engagement tracking provides usage metrics.

---

## Scope

### In Scope (Phase 1)
- FR-1 through FR-5: browsing, preview, share links, admin CRUD, types/categories
- Database migration, RLS policies, API routes
- Frontend pages: `/sales` materials tab, `/sales/materials/[slug]`, `/admin/sales-materials`, `/share/materials/[token]`
- Unit tests for utilities (slug generation, share token generation, filter logic)
- Integration tests for all API routes with role-based access checks
- E2E tests for browse, preview, share link copy, admin create/edit/publish flows

### Out of Scope (Phase 2 / Future)
- FR-6: Engagement tracking (views, downloads, analytics dashboard)
- AI-generated material summaries or recommendations
- Material versioning (keeping historical versions of a file)
- Expiring share links (time-limited public access)
- Prospect-facing portal (authenticated prospect accounts)
- Email notifications when materials are updated
- Integrations with CRM (Salesforce, HubSpot)
- Bulk import from Google Drive or SharePoint

---

## Rollout Plan

1. **Dev:** Build behind existing role gates -- no feature flag needed since `/sales` is already restricted to `sales` + `admin` roles
2. **Internal QA:** Admin creates 5-10 seed materials covering each type. Sales team lead validates browse, search, and share flows.
3. **Launch:** Announce in sales Slack channel with a 2-minute Loom walkthrough. No gradual rollout needed -- small user base.
4. **Kill switch:** If critical issues arise, set all materials to `status = 'draft'` via a single SQL update. The materials tab renders an empty state. Courses tab remains unaffected.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Supabase Storage 1GB limit hit by file uploads | Materials become unuploadable | Monitor storage usage in admin dashboard; enforce 50MB per-file limit; upgrade Supabase plan if approaching 80% capacity |
| Public share links leak internal-only materials | Confidential content exposed | `shareable` flag defaults to false; admin must explicitly enable; share page shows no internal nav or metadata |
| Stale materials sent to prospects | Damaged credibility | Show `updated_at` prominently on MaterialCard; Phase 2 adds admin alerts for materials not updated in 90+ days |
| Slug collisions with existing `/sales/[courseSlug]` routes | Routing conflicts, 404s | Materials use a separate path segment: `/sales/materials/[slug]`, not `/sales/[slug]` |

---

## Open Questions

1. Should materials support multiple file attachments per material, or just one? (Current spec: one file + optional rich text. Revisit if admins need to bundle related files.)
2. Do we need material "collections" or "kits" -- grouped bundles of materials for specific deal stages? (Defer to Phase 2 based on usage patterns.)
3. Should the public share page show a "Request a demo" CTA or contact form? (Product decision -- not blocking Phase 1.)
