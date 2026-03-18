# Sales Enablement Materials -- Technical Architecture

**Status:** Draft
**Zone:** sales, admin
**Last Updated:** 2026-03-18

---

## 1. Database Schema

### `sales_materials` Table

```sql
create table sales_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  material_type text not null,        -- 'battle_card' | 'one_pager' | 'case_study' | 'slide_deck' | 'email_template' | 'proposal_template' | 'roi_calculator' | 'video_demo' | 'other'
  category text,
  tags text[] default '{}',
  content jsonb,                      -- Tiptap JSON (null if file-only)
  file_path text,                     -- Supabase Storage path (null if rich-text-only)
  file_name text,                     -- Original filename for display
  file_size_bytes bigint,
  file_mime_type text,
  shareable boolean default false,
  share_token text unique,            -- 12-char alphanumeric, generated on insert
  status text not null default 'draft', -- 'draft' | 'published' | 'archived'
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Full-text search (same pattern as docs_pages)
alter table sales_materials add column search_vector tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored;

-- Indexes
create index idx_sales_materials_status on sales_materials(status);
create index idx_sales_materials_type on sales_materials(material_type);
create index idx_sales_materials_category on sales_materials(category);
create index idx_sales_materials_share_token on sales_materials(share_token) where share_token is not null;
create index idx_sales_materials_search on sales_materials using gin(search_vector);
create index idx_sales_materials_updated on sales_materials(updated_at desc);

-- Trigger: auto-update updated_at
create or replace function update_sales_materials_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_sales_materials_updated_at
  before update on sales_materials
  for each row execute function update_sales_materials_updated_at();
```

### `sales_material_categories` Table

The requirements spec uses free-text categories with autocomplete from distinct values. However, a lightweight categories table gives us consistent naming, ordering, and the ability to soft-delete without orphaning references. The `category` column on `sales_materials` remains a plain text field -- the categories table serves as a controlled vocabulary, not a foreign key constraint.

```sql
create table sales_material_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,          -- Display name, e.g. "Enterprise Solutions"
  slug text unique not null,          -- URL-safe, e.g. "enterprise-solutions"
  order_index integer default 0,
  created_at timestamptz default now()
);

create index idx_smc_order on sales_material_categories(order_index);
```

### RLS Policies

```sql
-- Sales + admin: read published materials
create policy "sales_read_published" on sales_materials
  for select to authenticated
  using (
    status = 'published'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('sales', 'admin')
    )
  );

-- Admin: full CRUD (all statuses)
create policy "admin_all" on sales_materials
  for all to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Public (anon): read shareable published materials by share_token only
create policy "public_share_read" on sales_materials
  for select to anon
  using (
    shareable = true
    and status = 'published'
  );

-- Categories: readable by sales + admin, writable by admin
create policy "categories_read" on sales_material_categories
  for select to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('sales', 'admin')
    )
  );

create policy "categories_admin" on sales_material_categories
  for all to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
```

The `public_share_read` policy allows anon reads on all shareable+published rows. The API route for public shares filters by `share_token` in the query itself, so the anon user cannot enumerate materials -- they must know the token. This is belt-and-suspenders: RLS limits the surface, the API route limits the lookup vector.

---

## 2. API Routes

All routes follow the existing pattern: `createClient()` for auth-scoped queries, `createServiceClient()` only when bypassing RLS is explicitly needed. Inputs validated with Zod. Responses use `NextResponse.json()`.

### GET `/api/sales/materials`

List published materials with filtering. Sales + admin only.

**Query params:** `?type=battle_card&category=Enterprise&q=pricing&page=1&limit=20`

**Zod schema:**
```typescript
const listSchema = z.object({
  type: z.enum([
    'battle_card', 'one_pager', 'case_study', 'slide_deck',
    'email_template', 'proposal_template', 'roi_calculator', 'video_demo', 'other'
  ]).optional(),
  category: z.string().optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
```

**Response (200):**
```json
{
  "materials": [
    {
      "id": "uuid",
      "title": "string",
      "slug": "string",
      "description": "string | null",
      "material_type": "string",
      "category": "string | null",
      "tags": ["string"],
      "file_name": "string | null",
      "file_mime_type": "string | null",
      "shareable": true,
      "share_token": "string | null",
      "updated_at": "iso8601"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

**Implementation notes:**
- Belt-and-suspenders: `.eq('status', 'published')` in query even though RLS enforces it.
- Full-text search uses `search_vector @@ plainto_tsquery('english', q)` when `q` is provided.
- Content (`jsonb`) and file_path are excluded from list responses to keep payloads small.
- Errors: 401 (not authenticated), 403 (role not sales/admin).

```typescript
// src/app/api/sales/materials/route.ts
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['sales', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const params = listSchema.parse(Object.fromEntries(request.nextUrl.searchParams))

  let query = supabase
    .from('sales_materials')
    .select('id, title, slug, description, material_type, category, tags, file_name, file_mime_type, shareable, share_token, updated_at', { count: 'exact' })
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .range((params.page - 1) * params.limit, params.page * params.limit - 1)

  if (params.type) query = query.eq('material_type', params.type)
  if (params.category) query = query.eq('category', params.category)
  if (params.q) query = query.textSearch('search_vector', params.q, { type: 'plain' })

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: 'Failed to fetch materials' }, { status: 500 })

  return NextResponse.json({ materials: data ?? [], total: count ?? 0, page: params.page, limit: params.limit })
}
```

### GET `/api/sales/materials/[slug]`

Single material detail. Sales + admin only.

**Response (200):** Full material object including `content` (Tiptap JSON) and `file_path`. File path is not returned directly -- if a file exists, a signed download URL is generated inline.

**Errors:** 401, 403, 404 (not found or draft).

```typescript
// src/app/api/sales/materials/[slug]/route.ts
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  // Auth check (same pattern as list route)...
  const { slug } = await params
  const { data: material } = await supabase
    .from('sales_materials')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let downloadUrl: string | null = null
  if (material.file_path) {
    const { data: signedUrl } = await supabase.storage
      .from('sales-materials')
      .createSignedUrl(material.file_path, 3600) // 1-hour TTL
    downloadUrl = signedUrl?.signedUrl ?? null
  }

  return NextResponse.json({ material: { ...material, download_url: downloadUrl } })
}
```

### GET `/api/sales/materials/categories`

Returns all categories for filter dropdowns. Sales + admin only.

**Response (200):**
```json
{ "categories": [{ "id": "uuid", "name": "string", "slug": "string" }] }
```

### POST `/api/admin/sales-materials`

Create a new material. Admin only.

**Zod schema:**
```typescript
const createSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(200),
  description: z.string().max(2000).optional(),
  material_type: z.enum([...MATERIAL_TYPES]),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  content: z.any().optional(),        // Tiptap JSON -- validated structurally if needed
  shareable: z.boolean().default(false),
  status: z.enum(['draft', 'published']).default('draft'),
})
```

**Implementation:** Generates a 12-character alphanumeric `share_token` using `crypto.randomBytes(9).toString('base64url').slice(0, 12)`. Sets `created_by` to the admin's user ID.

**Response (201):** `{ material: { id, slug, share_token } }`
**Errors:** 401, 403, 400 (validation), 409 (slug conflict).

### PATCH `/api/admin/sales-materials/[id]`

Update any mutable fields. Admin only. Partial update -- only provided fields are changed.

**Zod schema:** Same as create but all fields optional via `.partial()`.
**Response (200):** Updated material object.
**Errors:** 401, 403, 400, 404.

### DELETE `/api/admin/sales-materials/[id]`

Soft-delete: sets `status = 'archived'`. Admin only.

**Response (200):** `{ success: true }`
**Errors:** 401, 403, 404.

### POST `/api/admin/sales-materials/[id]/upload`

Upload a file attachment to Supabase Storage. Admin only. Receives a `multipart/form-data` body with a single `file` field.

**Validation:**
- Max file size: 50MB (52,428,800 bytes) -- checked server-side from the `Content-Length` header and the actual file buffer.
- Allowed MIME types: `application/pdf`, `application/vnd.openxmlformats-officedocument.presentationml.presentation` (PPTX), `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX), `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (XLSX), `image/png`, `image/jpeg`.

**Storage path:** `{materialId}/{originalFilename}` in the `sales-materials` bucket.

**Implementation:**
```typescript
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Admin auth check...
  const { id } = await params
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (file.size > 52_428_800) {
    return NextResponse.json({ error: 'File exceeds 50MB limit' }, { status: 400 })
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
  }

  const filePath = `${id}/${file.name}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const serviceClient = createServiceClient()
  const { error: uploadError } = await serviceClient.storage
    .from('sales-materials')
    .upload(filePath, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })

  // Update material row with file metadata
  await serviceClient.from('sales_materials').update({
    file_path: filePath,
    file_name: file.name,
    file_size_bytes: file.size,
    file_mime_type: file.type,
  }).eq('id', id)

  return NextResponse.json({ file_path: filePath, file_name: file.name })
}
```

Uses `createServiceClient()` for the storage upload because the `sales-materials` bucket is private and the anon key cannot write to it. The admin session is validated before reaching this point.

### GET `/api/public/materials/[shareToken]`

Public share link endpoint. No auth required.

**Implementation:**
```typescript
export async function GET(request: NextRequest, { params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params
  const serviceClient = createServiceClient()

  const { data: material } = await serviceClient
    .from('sales_materials')
    .select('id, title, slug, description, material_type, category, content, file_name, file_mime_type, file_size_bytes, file_path, updated_at')
    .eq('share_token', shareToken)
    .eq('shareable', true)
    .eq('status', 'published')
    .single()

  if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let downloadUrl: string | null = null
  if (material.file_path) {
    const { data: signedUrl } = await serviceClient.storage
      .from('sales-materials')
      .createSignedUrl(material.file_path, 3600)
    downloadUrl = signedUrl?.signedUrl ?? null
  }

  return NextResponse.json({ material: { ...material, download_url: downloadUrl } })
}
```

Uses `createServiceClient()` because anon users cannot query the table through the standard client. The triple filter (`share_token` + `shareable` + `published`) prevents any unintended access.

---

## 3. File Storage

### Supabase Storage Bucket: `sales-materials`

**Bucket configuration:**
- **Public:** No. All downloads go through signed URLs (1-hour TTL) generated server-side.
- **File size limit:** 50MB (enforced in API route, not just bucket policy, for clear error messages).
- **Allowed MIME types:** Enforced server-side before upload. The bucket does not restrict MIME types at the Supabase level -- server-side validation is the authority.

**File path convention:** `{materialId}/{filename}`. One file per material. Uploading a new file to the same material uses `upsert: true` to replace the existing file. The previous file is overwritten, not versioned.

**Bucket creation (Supabase dashboard or migration):**
```sql
insert into storage.buckets (id, name, public) values ('sales-materials', 'sales-materials', false);
```

**Storage policy:** Only the service role can write. Signed URLs handle read access.

```sql
-- No public read policy. All reads via signed URLs.
-- Write policy: service role only (handled by using createServiceClient in API routes).
```

**Storage budget:** The Supabase free tier allows 1GB. Sales materials share this with badge images and lesson cover images. At 50MB max per material, 20 materials = 1GB. Monitor usage via the Supabase dashboard. If the library grows beyond ~15 materials with large files, upgrade the Supabase plan or move to Bunny.net Storage (already in the stack for video).

---

## 4. Frontend Routes and Components

### Page Routes

| Route | Type | Purpose |
|-------|------|---------|
| `/sales` | Server Component (updated) | Add Tabs for Courses/Materials |
| `/sales/materials/[slug]` | Server Component (new) | Material detail + preview |
| `/share/materials/[shareToken]` | Server Component (new) | Public share page, no auth |
| `/admin/sales-materials` | Server Component (new) | Admin list of all materials |
| `/admin/sales-materials/new` | Client Component (new) | Material creation form |
| `/admin/sales-materials/[id]/edit` | Client Component (new) | Material edit form |

### `/sales` Page Update

The existing Server Component fetches course data. It will also fetch materials in parallel and pass both datasets to a client-side `SalesTabs` component that manages tab state via URL search params.

```typescript
// src/app/(app)/sales/page.tsx (updated)
export default async function SalesCatalogPage() {
  const [catalogData, materialsData] = await Promise.all([
    getCatalogData('sales'),
    getMaterialsList(),   // new function in src/lib/sales/materials.ts
  ])
  if (!catalogData) redirect('/login')

  return (
    <div>
      {/* Hero (unchanged) */}
      <SalesTabs courses={enrichedCourses} materials={materialsData} />
    </div>
  )
}
```

### Data Fetching Layer

New file: `src/lib/sales/materials.ts` following the same `server-only` pattern as `src/lib/training/data.ts`.

```typescript
// src/lib/sales/materials.ts
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth/getProfile'

export async function getMaterialsList(filters?: {
  type?: string; category?: string; q?: string
}) {
  const profile = await getProfile()
  if (!profile || !['sales', 'admin'].includes(profile.role)) return null

  const supabase = await createClient()
  let query = supabase
    .from('sales_materials')
    .select('id, title, slug, description, material_type, category, tags, file_name, file_mime_type, shareable, share_token, updated_at')
    .eq('status', 'published')
    .order('updated_at', { ascending: false })

  if (filters?.type) query = query.eq('material_type', filters.type)
  if (filters?.category) query = query.eq('category', filters.category)
  if (filters?.q) query = query.textSearch('search_vector', filters.q, { type: 'plain' })

  const { data } = await query
  return data ?? []
}

export async function getMaterialBySlug(slug: string) {
  // Same auth pattern, returns full material with signed download URL
}
```

### Component Tree

```
src/components/sales/
  SalesTabs.tsx           -- Client. Tabs with URL state sync (useSearchParams).
  MaterialsLibrary.tsx    -- Client. Toolbar (search, filters, view toggle) + grid/list.
  MaterialCard.tsx        -- Client. Grid card matching design spec.
  MaterialRow.tsx         -- Client. List view row.
  MaterialFilters.tsx     -- Client. Search input + type/category dropdowns.
  ShareDialog.tsx         -- Client. Copy link dialog with clipboard API.
  MaterialViewer.tsx      -- Client. Read-only Tiptap renderer + PDF iframe.
  MaterialEmptyState.tsx  -- Server. Empty/no-results state.

src/components/admin/sales-materials/
  MaterialForm.tsx        -- Client. Create/edit form with Tiptap + file upload.
  MaterialsTable.tsx      -- Client. Admin table with status badges, bulk actions.
  FileUploadZone.tsx      -- Client. Drag-and-drop file upload with progress.
```

**`SalesTabs`** syncs the active tab to `?tab=courses|materials` using `useSearchParams` and `router.replace`. Default tab is `courses`. When the Materials tab is active, `MaterialsLibrary` renders with client-side filtering that calls the API route on filter changes (debounced search, dropdown selects).

**`MaterialCard`** follows the same hover/glow pattern as `CourseCard`: `bg-surface border border-border rounded-xl shadow-card hover:border-accent/30 hover:shadow-accent-glow`. No cover image, no progress bar. Type badge top-left, share icon top-right.

**`ShareDialog`** uses shadcn `Dialog` on desktop and `Sheet` (side="bottom") on mobile. The copy button uses `navigator.clipboard.writeText()` with a 2-second "Copied" feedback state.

**`MaterialViewer`** renders Tiptap JSON content using `EditorContent` with `editable: false`, same as the existing lesson viewer. For PDF files, it renders an `<iframe src={signedUrl} />` with `type="application/pdf"`. For non-previewable files (PPTX, DOCX, XLSX), it shows a file info card with a download button.

### Admin Pages

**`/admin/sales-materials`** renders `MaterialsTable` -- a div-based table (matching existing admin patterns) with columns: Title, Type, Category, Status, Updated, Actions. The Actions column uses a shadcn `DropdownMenu` with Edit, Toggle Share, Archive. Bulk actions (publish, unpublish, archive) operate on checkbox-selected rows via a batch PATCH endpoint.

**`/admin/sales-materials/new` and `/admin/sales-materials/[id]/edit`** render `MaterialForm`, which includes:
- Title input, slug input (auto-generated from title, editable)
- Type select, category select (with autocomplete from existing categories)
- Description textarea
- Content mode toggle: "Rich Text" shows the Tiptap editor; "File Upload" shows `FileUploadZone`
- Shareable switch + read-only public URL display
- Status toggle (Draft / Published)
- Save button calls POST (create) or PATCH (update)

---

## 5. Public Share Links

### Token Generation

Share tokens are 12-character URL-safe strings generated on material creation:

```typescript
import crypto from 'crypto'

function generateShareToken(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12)
}
```

This produces 72 bits of entropy (9 bytes), which yields ~4.7 sextillion possible tokens -- sufficient to prevent brute-force enumeration.

### Share Link Lifecycle

1. **Creation:** Token generated on `POST /api/admin/sales-materials` and stored on the row. Every material gets a token regardless of `shareable` status.
2. **Activation:** Admin sets `shareable = true` via PATCH. The share URL becomes functional.
3. **Deactivation:** Admin sets `shareable = false`. The public endpoint returns 404 for that token. The token itself is not deleted, so re-enabling sharing restores the same URL.
4. **Archival:** Soft-deleting a material (`status = 'archived'`) also causes the public endpoint to return 404 because the query requires `status = 'published'`.

### Public Share Page

Route: `src/app/(app)/share/materials/[shareToken]/page.tsx` (or outside the `(app)` layout group if the app layout requires auth).

This page is a Server Component that calls the public API endpoint. It renders:
- Company logo and branding (Throughput/AAVA header)
- Material title, type badge, description
- Content (Tiptap viewer) or file download card
- No internal navigation, no sidebar, no user menu

The layout for `/share/*` should be a minimal shell without the authenticated app chrome. Create `src/app/share/layout.tsx` as a standalone layout.

---

## 6. Search Implementation

Full-text search reuses the existing `docs_pages` pattern with a generated `tsvector` column (see schema above). The `search_vector` column is automatically maintained by Postgres -- no application-level indexing step needed.

### Query Pattern

```typescript
// In API route or data fetcher:
if (searchQuery) {
  query = query.textSearch('search_vector', searchQuery, { type: 'plain' })
}
```

The `plain` type runs `plainto_tsquery`, which handles multi-word queries by ANDing the terms. This matches the behavior users expect: searching "enterprise pricing" finds materials containing both words.

### Search UX

The search input in `MaterialFilters` debounces at 300ms and updates a URL search param (`?q=...`). The `MaterialsLibrary` component reads this param and passes it to the data fetch. On the server, the initial page load can also read `searchParams` and pre-filter results for shareable direct links to filtered views.

For the global search bar (top nav), materials will be included alongside knowledge pages in a future integration. The same `search_vector` column and GIN index support this without additional infrastructure.

---

## File Map

New files to create:

```
src/
  app/
    (app)/sales/
      page.tsx                              -- UPDATE: add parallel materials fetch + SalesTabs
    (app)/sales/materials/[slug]/
      page.tsx                              -- NEW: material detail page
    share/
      layout.tsx                            -- NEW: minimal public layout
      materials/[shareToken]/
        page.tsx                            -- NEW: public share page
    admin/sales-materials/
      page.tsx                              -- NEW: admin list
      new/page.tsx                          -- NEW: create form
      [id]/edit/page.tsx                    -- NEW: edit form
    api/
      sales/materials/
        route.ts                            -- NEW: GET list
        [slug]/route.ts                     -- NEW: GET detail
        categories/route.ts                 -- NEW: GET categories
      admin/sales-materials/
        route.ts                            -- NEW: POST create
        [id]/route.ts                       -- NEW: PATCH update, DELETE archive
        [id]/upload/route.ts                -- NEW: POST file upload
      public/materials/[shareToken]/
        route.ts                            -- NEW: GET public share
  lib/
    sales/
      materials.ts                          -- NEW: data fetching (server-only)
      validation.ts                         -- NEW: Zod schemas + constants
  components/
    sales/
      SalesTabs.tsx                         -- NEW
      MaterialsLibrary.tsx                  -- NEW
      MaterialCard.tsx                      -- NEW
      MaterialRow.tsx                       -- NEW
      MaterialFilters.tsx                   -- NEW
      ShareDialog.tsx                       -- NEW
      MaterialViewer.tsx                    -- NEW
      MaterialEmptyState.tsx                -- NEW
    admin/sales-materials/
      MaterialForm.tsx                      -- NEW
      MaterialsTable.tsx                    -- NEW
      FileUploadZone.tsx                    -- NEW
supabase/
  migrations/
    YYYYMMDDHHMMSS_create_sales_materials.sql  -- NEW: schema migration
```
