# Testing Strategy: Sales Enablement Materials Library

## Overview

Testing strategy for the Sales Materials Library feature covering the `/sales` materials tab, `/admin/sales-materials` CMS, and `/share/materials/[token]` public page. Focuses on role-based access enforcement (employee=403, sales=200, admin=full CRUD), file upload validation, share token security, and end-to-end user flows. All tests follow the existing Vitest + Playwright setup with mocked Supabase clients.

---

## Critical Test Scenarios (Top 10)

### 1. Role-based access enforcement on materials list
- **Test:** GET `/api/sales/materials` returns 200 for sales/admin, 403 for employee, 401 for unauthenticated
- **Expected:** Only sales and admin roles can access published materials
- **Priority:** High

### 2. Draft materials invisible to sales reps
- **Test:** GET `/api/sales/materials` with mix of draft/published/archived materials
- **Expected:** Response contains only `status = 'published'` materials; draft and archived excluded
- **Priority:** High

### 3. Admin CRUD lifecycle
- **Test:** POST create, PATCH update, DELETE (soft) a material through admin routes
- **Expected:** Material transitions draft -> published -> archived correctly; soft delete sets status to archived
- **Priority:** High

### 4. File upload validation
- **Test:** Upload files with valid MIME types (PDF, DOCX, PPTX, XLSX, PNG, JPG) and invalid types (EXE, SVG, HTML)
- **Expected:** Valid types accepted, invalid types rejected with 400; files exceeding 50MB rejected
- **Priority:** High

### 5. Public share token access
- **Test:** GET `/api/share/materials/[shareToken]` for shareable vs non-shareable vs archived materials
- **Expected:** Returns material content when shareable=true AND status=published; returns 404 otherwise
- **Priority:** High

### 6. Share token is opaque (enumeration prevention)
- **Test:** Access materials via slug on public route, sequential token guessing, UUID-based access
- **Expected:** Only the exact 12-char alphanumeric share token works; no slug or ID-based public access
- **Priority:** High

### 7. Filter and search on materials list
- **Test:** Filter by type, category, text search; combined filters; empty result set
- **Expected:** Correct filtering; search uses full-text index; empty state returned when no matches
- **Priority:** Medium

### 8. File download generates signed URL
- **Test:** GET `/api/sales/materials/[slug]/download` for file-based materials
- **Expected:** Returns a signed Supabase Storage URL with 1-hour TTL; 404 for materials without files
- **Priority:** Medium

### 9. Admin cannot create material with invalid data
- **Test:** POST to create with missing title, invalid material_type, slug with spaces, title > 200 chars
- **Expected:** Zod validation returns 400 with specific field errors
- **Priority:** Medium

### 10. Share revocation immediately blocks access
- **Test:** Set shareable=false on a previously shareable material, then access public URL
- **Expected:** Public endpoint returns 404 immediately after revocation
- **Priority:** Medium

---

## Unit Tests

**Path:** `tests/unit/sales-materials/`

### `share-token.test.ts` -- Share token generation

```typescript
import { describe, it, expect } from 'vitest'
import { generateShareToken, isValidShareToken } from '@/lib/sales-materials/share-token'

describe('generateShareToken', () => {
  it('returns a 12-character alphanumeric string', () => {
    const token = generateShareToken()
    expect(token).toMatch(/^[a-zA-Z0-9]{12}$/)
  })

  it('generates unique tokens across 1000 calls', () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateShareToken()))
    expect(tokens.size).toBe(1000)
  })
})

describe('isValidShareToken', () => {
  it('accepts valid 12-char alphanumeric tokens', () => {
    expect(isValidShareToken('aBcDeFgHiJkL')).toBe(true)
  })

  it('rejects tokens with wrong length', () => {
    expect(isValidShareToken('short')).toBe(false)
    expect(isValidShareToken('toolongtoken123')).toBe(false)
  })

  it('rejects tokens with special characters', () => {
    expect(isValidShareToken('abc!@#def$%^')).toBe(false)
  })
})
```

### `filters.test.ts` -- Filter and search logic

Test the utility that builds Supabase query filters from URL search params:
- Type filter maps to `.eq('material_type', value)`
- Category filter maps to `.eq('category', value)`
- Search text maps to `.textSearch('search_vector', query)`
- Combined filters chain correctly
- Empty/null filter values are ignored
- Invalid type values are rejected

### `validation.test.ts` -- Zod schema validation

Test the material creation/update Zod schemas:
- `title`: required, 1-200 chars
- `slug`: lowercase alphanumeric + hyphens, unique format
- `material_type`: must be one of the 9 enum values
- `file_mime_type`: must be in allowlist
- `file_size_bytes`: max 52,428,800
- `tags`: array of strings, optional
- `shareable`: boolean, defaults to false

### `slug.test.ts` -- Slug generation

- Auto-generates from title (lowercase, hyphens, no special chars)
- Handles unicode characters
- Truncates at reasonable length
- Does not collide with reserved paths

---

## Integration Tests

**Path:** `tests/integration/sales-materials/`

All integration tests follow the existing mock pattern from `tests/integration/training/courses.test.ts` -- mock `@/lib/supabase/server` with `createClient` returning `{ auth: { getUser }, from }`, use `createChain()` helper for query mocking.

### `materials-list.test.ts` -- GET /api/sales/materials

**Role-based access matrix:**

| Role | Expected Status |
|------|----------------|
| Unauthenticated | 401 |
| `employee` | 403 |
| `sales` | 200 |
| `admin` | 200 |

Additional cases:
- Returns only published materials (mock DB returns mix, assert filtered)
- Supports `?type=battle_card` filter
- Supports `?category=Enterprise` filter
- Supports `?search=competitor` text search
- Returns empty array with 200 when no materials match
- Results sorted by `updated_at` descending

### `material-detail.test.ts` -- GET /api/sales/materials/[slug]

- Returns 200 with full material content for sales/admin
- Returns 401 for unauthenticated
- Returns 403 for employee role
- Returns 404 for draft material accessed by sales
- Returns 404 for non-existent slug
- Includes Tiptap JSON content in response
- Includes file metadata (path, name, size, mime) when file exists

### `admin-crud.test.ts` -- Admin material management

**POST /api/admin/sales-materials (create):**
- Returns 201 with created material for admin
- Returns 403 for sales role
- Returns 400 for missing required fields (title, material_type)
- Returns 400 for invalid material_type enum value
- Auto-generates share_token on creation
- Sets status to 'draft' by default

**PATCH /api/admin/sales-materials/[id] (update):**
- Returns 200 with updated material for admin
- Returns 403 for sales role
- Partial update works (only changed fields)
- Can toggle status between draft/published
- Can toggle shareable flag
- Returns 404 for non-existent material ID

**DELETE /api/admin/sales-materials/[id] (soft delete):**
- Returns 200 for admin, sets status to 'archived'
- Returns 403 for sales role
- Returns 404 for non-existent material
- Archived material no longer appears in sales list endpoint
- Archived material's public share link returns 404

### `file-upload.test.ts` -- POST /api/admin/sales-materials/[id]/upload

- Returns 200 for valid PDF upload by admin
- Returns 403 for sales role
- Returns 400 for disallowed MIME type (e.g., `application/x-executable`)
- Returns 400 for file exceeding 50MB
- Stores file at `sales-materials/[materialId]/[filename]` path
- Updates material row with file_path, file_name, file_size_bytes, file_mime_type
- Returns 404 for non-existent material ID

**Allowed MIME types to test:**
```typescript
const VALID_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',         // xlsx
  'image/png',
  'image/jpeg',
]

const INVALID_MIMES = [
  'application/x-executable',
  'text/html',
  'image/svg+xml',
  'application/javascript',
]
```

### `public-share.test.ts` -- GET /api/share/materials/[shareToken]

- Returns 200 with material content when shareable=true AND status=published
- Returns 404 when shareable=false
- Returns 404 when status=draft
- Returns 404 when status=archived
- Returns 404 for non-existent token
- Response excludes internal metadata (created_by, internal IDs)
- No auth header required (anon access)

### `categories.test.ts` -- GET /api/sales/materials/categories

- Returns distinct category values from published materials
- Returns empty array when no materials exist
- Requires sales or admin role

---

## E2E Tests (Playwright)

**Path:** `tests/e2e/sales/`

### `materials-browse.spec.ts` -- Browse and filter materials

```typescript
test.describe('Sales Materials Library', () => {
  test('displays materials grid on materials tab', async ({ page }) => {
    // Navigate to /sales?tab=materials
    // Assert MaterialCard components render
    // Assert type badges, titles, descriptions visible
  })

  test('filters materials by type', async ({ page }) => {
    // Click Type dropdown, select "Battle Card"
    // Assert only battle card materials shown
    // Assert URL params updated
  })

  test('searches materials by keyword', async ({ page }) => {
    // Type in search input
    // Wait for debounce (300ms)
    // Assert filtered results
  })

  test('shows empty state when no results match', async ({ page }) => {
    // Search for nonsense string
    // Assert "No materials match your search" message
    // Assert "Clear filters" button visible and functional
  })

  test('toggles between grid and list view', async ({ page }) => {
    // Click list view icon
    // Assert row layout renders
    // Click grid view icon
    // Assert card grid renders
  })

  test('preserves tab and filter state on back navigation', async ({ page }) => {
    // Navigate to /sales?tab=materials with type filter
    // Click into a material detail page
    // Click browser back
    // Assert materials tab still active with filter preserved
  })
})
```

### `materials-detail.spec.ts` -- Material detail page

```typescript
test.describe('Material Detail', () => {
  test('renders rich-text material with Tiptap viewer', async ({ page }) => {
    // Navigate to /sales/materials/[slug] for a rich-text material
    // Assert breadcrumb, title, type badge, content area
  })

  test('renders file-based material with download button', async ({ page }) => {
    // Navigate to a file-based material
    // Assert download button visible
    // Assert file metadata (name, size) displayed
  })

  test('copy share link button copies URL to clipboard', async ({ page }) => {
    // Click share button on a shareable material
    // Assert share dialog opens
    // Click copy button
    // Assert clipboard contains the public share URL
    // Assert button text changes to "Copied"
  })

  test('share dialog shows disabled state for non-shareable materials', async ({ page }) => {
    // Open share dialog on a non-shareable material
    // Assert disabled state message shown
  })
})
```

### `materials-admin.spec.ts` -- Admin CRUD flow

```typescript
test.describe('Admin Materials Management', () => {
  test('creates a new rich-text material', async ({ page }) => {
    // Navigate to /admin/sales-materials
    // Click "New Material"
    // Fill title, select type, select category, write description
    // Add content in Tiptap editor
    // Click Save
    // Assert redirect to materials list
    // Assert new material appears with DRAFT badge
  })

  test('uploads a file attachment', async ({ page }) => {
    // Open existing material editor
    // Select "File Upload" mode
    // Upload a test PDF via file input
    // Assert file name and size shown
    // Save material
    // Assert file_path populated on material
  })

  test('publishes a draft material', async ({ page }) => {
    // Open a draft material
    // Toggle status to Published
    // Save
    // Assert status badge changes to PUBLISHED
  })

  test('soft-deletes a material with confirmation', async ({ page }) => {
    // Click delete on a material row
    // Assert confirmation dialog appears
    // Confirm deletion
    // Assert material disappears from list (or shows archived status)
  })

  test('rejects file upload with invalid type', async ({ page }) => {
    // Attempt to upload an .exe or .html file
    // Assert error toast or validation message
  })
})
```

### `materials-public-share.spec.ts` -- Public share page

```typescript
test.describe('Public Share Page', () => {
  test('renders shared material without login', async ({ page }) => {
    // Navigate to /share/materials/[validToken] without auth
    // Assert material title, content rendered
    // Assert no internal navigation (sidebar, user menu) visible
    // Assert company branding (logo, accent colors) present
  })

  test('returns 404 for invalid share token', async ({ page }) => {
    // Navigate to /share/materials/invalidtoken
    // Assert 404 page rendered
  })

  test('returns 404 for revoked share link', async ({ page }) => {
    // Navigate to a token where shareable=false
    // Assert 404 page rendered
  })
})
```

---

## Test Data Fixtures

**Path:** `tests/fixtures/sales-materials.ts`

```typescript
export const MATERIAL_FIXTURES = {
  battleCard: {
    id: 'mat-11111111-1111-4111-a111-111111111111',
    title: 'Competitor X Battle Card',
    slug: 'competitor-x-battle-card',
    description: 'Key differentiators and objection handling for Competitor X deals.',
    material_type: 'battle_card',
    category: 'Competitive Intel',
    tags: ['enterprise', 'competitor-x'],
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sample battle card content.' }] }] },
    file_path: null,
    shareable: true,
    share_token: 'aBcDeFgHiJkL',
    status: 'published',
    created_by: 'admin-user-id',
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-15T00:00:00Z',
  },

  draftCaseStudy: {
    id: 'mat-22222222-2222-4222-a222-222222222222',
    title: 'Acme Corp Case Study',
    slug: 'acme-corp-case-study',
    description: 'How Acme Corp reduced churn by 40% using our platform.',
    material_type: 'case_study',
    category: 'Customer Stories',
    tags: ['mid-market', 'saas'],
    content: { type: 'doc', content: [] },
    file_path: null,
    shareable: false,
    share_token: 'mNoPqRsTuVwX',
    status: 'draft',
    created_by: 'admin-user-id',
    created_at: '2026-03-10T00:00:00Z',
    updated_at: '2026-03-10T00:00:00Z',
  },

  fileBasedDeck: {
    id: 'mat-33333333-3333-4333-a333-333333333333',
    title: 'Q1 2026 Product Overview Deck',
    slug: 'q1-2026-product-overview',
    description: 'Latest product capabilities slide deck for prospect meetings.',
    material_type: 'slide_deck',
    category: 'Product',
    tags: ['q1-2026', 'product'],
    content: null,
    file_path: 'sales-materials/mat-33333333/overview-deck.pptx',
    file_name: 'overview-deck.pptx',
    file_size_bytes: 4_500_000,
    file_mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    shareable: true,
    share_token: 'yZaBcDeFgHiJ',
    status: 'published',
    created_by: 'admin-user-id',
    created_at: '2026-02-20T00:00:00Z',
    updated_at: '2026-03-12T00:00:00Z',
  },

  archivedTemplate: {
    id: 'mat-44444444-4444-4444-a444-444444444444',
    title: 'Old Email Template',
    slug: 'old-email-template',
    description: 'Deprecated outreach template.',
    material_type: 'email_template',
    category: 'Outreach',
    tags: [],
    content: { type: 'doc', content: [] },
    file_path: null,
    shareable: true,
    share_token: 'kLmNoPqRsTuV',
    status: 'archived',
    created_by: 'admin-user-id',
    created_at: '2025-12-01T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  },

  nonShareable: {
    id: 'mat-55555555-5555-4555-a555-555555555555',
    title: 'Internal Pricing Guide',
    slug: 'internal-pricing-guide',
    description: 'Confidential pricing tiers and discount authority matrix.',
    material_type: 'one_pager',
    category: 'Pricing',
    tags: ['internal-only', 'pricing'],
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Confidential pricing content.' }] }] },
    file_path: null,
    shareable: false,
    share_token: 'wXyZaBcDeFgH',
    status: 'published',
    created_by: 'admin-user-id',
    created_at: '2026-03-05T00:00:00Z',
    updated_at: '2026-03-14T00:00:00Z',
  },
}

export const TEST_USERS = {
  admin: { id: 'admin-user-id', role: 'admin' },
  sales: { id: 'sales-user-id', role: 'sales' },
  employee: { id: 'employee-user-id', role: 'employee' },
}
```

---

## Security Tests

Embedded within integration tests but called out explicitly here for coverage tracking.

### Auth bypass attempts (`tests/integration/sales-materials/security.test.ts`)

| Test | Route | Attack | Expected |
|------|-------|--------|----------|
| No auth header | GET `/api/sales/materials` | Missing Authorization | 401 |
| Expired token | GET `/api/sales/materials` | Expired JWT | 401 |
| Employee escalation | POST `/api/admin/sales-materials` | Employee JWT on admin route | 403 |
| Sales escalation | DELETE `/api/admin/sales-materials/[id]` | Sales JWT on admin-only action | 403 |
| Direct ID access | GET `/api/share/materials/mat-11111111...` | Use UUID instead of share token | 404 |
| Token enumeration | GET `/api/share/materials/aaaa`, `/api/share/materials/aaab` | Sequential guessing | 404 (no timing leak) |

### File upload security (`tests/integration/sales-materials/file-upload.test.ts`)

| Test | Attack | Expected |
|------|--------|----------|
| MIME spoofing | Send `.exe` with `Content-Type: application/pdf` | 400 (server validates actual content) |
| Oversized file | 51MB file | 400 with size limit error |
| Path traversal | Filename `../../etc/passwd` | Sanitized filename; stored safely |
| Double extension | `report.pdf.exe` | 400 or sanitized |

### Share link security

| Test | Scenario | Expected |
|------|----------|----------|
| Revoked link | Admin sets shareable=false, then access token | 404 |
| Draft material token | Valid token but status=draft | 404 |
| Archived material token | Valid token but status=archived | 404 |
| Response content | Public share response body | No internal IDs, no created_by, no admin metadata |

---

## Implementation Plan

### Week 1: Core Testing
- [ ] Create `tests/fixtures/sales-materials.ts` with seed data
- [ ] Write unit tests: share-token, filters, validation, slug generation
- [ ] Write integration tests: materials-list, material-detail, public-share (role matrix)
- [ ] Write integration tests: admin-crud (create, update, soft-delete)

### Week 2: Risk Coverage
- [ ] Write integration tests: file-upload (MIME validation, size limits)
- [ ] Write integration tests: security (auth bypass, enumeration, path traversal)
- [ ] Write E2E tests: materials-browse, materials-detail, materials-public-share
- [ ] Write E2E tests: materials-admin (create, upload, publish, delete)

---

## Success Criteria

- [ ] All role-based access tests pass (employee=403, sales=200, admin=200 pattern across all routes)
- [ ] Draft/archived materials never returned to non-admin users
- [ ] Public share endpoint returns 404 for revoked, draft, or archived materials
- [ ] File upload rejects all invalid MIME types and oversized files
- [ ] All 10 critical scenarios have passing tests
- [ ] `npx vitest run` exits clean with zero failures
- [ ] `npx playwright test tests/e2e/sales/` exits clean

## Quick Start Commands

```bash
# Run all sales materials unit tests
npx vitest run tests/unit/sales-materials/

# Run all sales materials integration tests
npx vitest run tests/integration/sales-materials/

# Run all sales materials E2E tests
npx playwright test tests/e2e/sales/materials-*.spec.ts

# Run everything for this feature
npx vitest run tests/unit/sales-materials/ tests/integration/sales-materials/ && npx playwright test tests/e2e/sales/materials-*.spec.ts
```
