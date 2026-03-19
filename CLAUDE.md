# CLAUDE.md — Throughput

This file is the single source of truth for how this codebase is built, tested, and extended. Read it fully before writing any code.

---

## Project Overview

Throughput is a full-stack internal + public training site built with Next.js 16, Supabase, and OpenRouter. It serves three distinct zones:

| Zone | Path | Audience |
|------|------|----------|
| Public Docs | `/docs/*` | Anyone |
| Training | `/training/*` | All employees (`employee`, `sales`, `admin`) |
| Sales Enablement | `/sales/*` | Sales team + admin only |
| Certification | `/certifications/*` | Public (anyone can attempt) |
| Admin / CMS | `/admin/*` | Admin only |

See `docs/architecture/zones.md` for full access matrix.

---

## Stack

```
Frontend:       Next.js 16 (App Router, TypeScript)
Auth + DB:      Supabase (Postgres, RLS, Auth, Storage)
Hosting:        Vercel
Editor:         Tiptap (Notion-like block editor + markdown paste)
UI:             shadcn/ui + Tailwind CSS (custom design tokens below)
LLM (grading):  OpenRouter → openai/gpt-oss-120b
LLM (content):  OpenRouter → openai/gpt-oss-120b (AI course/lesson generator)
Video:          Bunny.net Stream (~$1–3/month — storage + delivery based)
Credentials:    Self-hosted Open Badges 3.0 (LinkedIn-compatible, no Credly needed)
Testing:        Vitest (unit), Playwright (e2e), Testing Library (components)
```

### Bunny.net Stream Pricing
Bunny.net has **no free tier** but is significantly cheaper than alternatives. Pricing is usage-based: **$0.005/GB stored/month** + **$0.01/GB delivered**. Encoding is free. For a small internal platform with ~10 hours of training video watched by 20–30 people, expect **$1–3/month total**. No minimum spend.

---

## Design System

### Philosophy
Inspired by Ascendion.com and int-ai.aava.ai. Dark, premium, AI-product aesthetic. Deep navy/near-black backgrounds, electric cyan accent, high contrast white text. Clean and authoritative — not playful. shadcn/ui component primitives, customized to these tokens.

### Color Tokens

Apply these in `tailwind.config.ts` and as CSS variables in `app/globals.css`:

```css
/* globals.css */
:root {
  /* Backgrounds */
  --background:         #08090E;   /* Near-black navy — page bg */
  --background-subtle:  #0F1117;   /* Slightly lighter — card bg */
  --background-raised:  #161923;   /* Raised surface — modals, dropdowns */
  --background-muted:   #1E2330;   /* Muted surface — table rows, input bg */

  /* Borders */
  --border:             #252D3D;   /* Default border */
  --border-subtle:      #1A2030;   /* Hairline / dividers */

  /* Text */
  --foreground:         #F0F2F8;   /* Primary text — white with slight cool tint */
  --foreground-muted:   #8892A4;   /* Secondary / metadata text */
  --foreground-subtle:  #4A5568;   /* Placeholder / disabled text */

  /* Brand Accent — Electric Cyan (Ascendion-inspired) */
  --accent:             #00D4FF;   /* Primary CTA, links, active states */
  --accent-hover:       #00BBEE;   /* Hover state */
  --accent-muted:       #003D4F;   /* Accent backgrounds (badges, highlights) */
  --accent-glow:        rgba(0, 212, 255, 0.15); /* Glow effect for cards/buttons */

  /* Secondary Accent — Electric Violet (gradient partner) */
  --secondary:          #7C3AED;   /* Secondary actions, tags */
  --secondary-muted:    #2D1F4E;   /* Secondary badge bg */

  /* Semantic */
  --success:            #10B981;   /* Pass, complete */
  --success-muted:      #052E20;
  --warning:            #F59E0B;   /* In-progress, caution */
  --warning-muted:      #2D1F05;
  --destructive:        #EF4444;   /* Fail, error, delete */
  --destructive-muted:  #2D0A0A;

  /* Certification Gold */
  --gold:               #F5C842;   /* Certification badges, achievements */
  --gold-muted:         #2D2205;
}
```

```ts
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      background: 'var(--background)',
      surface: 'var(--background-subtle)',
      raised: 'var(--background-raised)',
      muted: 'var(--background-muted)',
      border: 'var(--border)',
      foreground: 'var(--foreground)',
      'foreground-muted': 'var(--foreground-muted)',
      accent: {
        DEFAULT: 'var(--accent)',
        hover: 'var(--accent-hover)',
        muted: 'var(--accent-muted)',
        glow: 'var(--accent-glow)',
      },
      secondary: {
        DEFAULT: 'var(--secondary)',
        muted: 'var(--secondary-muted)',
      },
      gold: {
        DEFAULT: 'var(--gold)',
        muted: 'var(--gold-muted)',
      },
    },
    backgroundImage: {
      'gradient-brand': 'linear-gradient(135deg, #00D4FF 0%, #7C3AED 100%)',
      'gradient-card':  'linear-gradient(145deg, #0F1117 0%, #161923 100%)',
    },
    boxShadow: {
      'accent-glow': '0 0 24px var(--accent-glow)',
      'card':        '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px var(--border)',
    },
  }
}
```

### Component Conventions

- Use shadcn/ui primitives as the base for all components. Do not build custom dialog, dropdown, tooltip, tabs, or form components from scratch.
- Override shadcn default light-mode colors by pointing CSS variables to the dark tokens above in `components.json` and `globals.css`.
- Cards: `bg-surface border border-border rounded-xl shadow-card`
- Primary buttons: `bg-accent text-background hover:bg-accent-hover` with `shadow-accent-glow` on focus
- Secondary buttons: `bg-muted border border-border text-foreground hover:bg-raised`
- Headings use a subtle `bg-gradient-brand bg-clip-text text-transparent` for hero/section titles only — not body copy
- Certification badges use `text-gold border-gold` with a glow effect

### Typography

```css
/* Font stack — no custom font required, system stack looks premium on dark */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Scale */
--text-xs:   0.75rem;   /* 12px — metadata, badges */
--text-sm:   0.875rem;  /* 14px — body secondary */
--text-base: 1rem;      /* 16px — body */
--text-lg:   1.125rem;  /* 18px — subheadings */
--text-xl:   1.25rem;   /* 20px — card titles */
--text-2xl:  1.5rem;    /* 24px — section headers */
--text-3xl:  1.875rem;  /* 30px — page titles */
--text-4xl:  2.25rem;   /* 36px — hero */
```

---

## AAVA Certification System

### Concept
Any person — employee or public — can earn an **AAVA Certification** by completing a public certification track. Certifications are stackable credentials that signal PM methodology proficiency. They are separate from internal training courses.

### Certification Tiers

| Tier | Name | Prerequisites | Badge Color |
|------|------|--------------|-------------|
| 1 | AAVA Foundations | None | Silver |
| 2 | AAVA Practitioner | Foundations | Cyan |
| 3 | AAVA Specialist | Practitioner + 1 domain cert | Gold |
| Domain | AAVA [Domain] Expert (e.g., Sprint Planning Expert) | Practitioner | Gold |

### How It Works

1. **Anyone** can create a free public account (email + password or magic link) on `aava.ai/certifications`
2. They enroll in a certification track (free)
3. Each track has lessons (public, readable without login) + a proctored final exam (requires login)
4. The final exam is a **timed, randomized question pool** — questions are pulled from a pool and randomized per attempt
5. Passing score: **80%** — higher bar than internal courses (70%)
6. On passing: a **shareable certificate** is generated (unique URL, public, shows name + credential + date + verification hash)
7. On failing: 24-hour cooldown before re-attempt (max 3 attempts per 30 days)
8. Certificates include a **LinkedIn share button** and a public verification page at `/verify/[certId]`

### LinkedIn Integration — Open Badges 3.0 (Self-Hosted, No Credly Required)

LinkedIn's "Licenses & Certifications" section accepts any credential with a public verification URL. The industry standard is **Open Badges 3.0** (IMS Global / Mozilla spec). We implement this ourselves — no Credly, Accredible, or third-party service needed.

**How it works:**

1. When a certificate is issued, generate and store a JSON-LD badge assertion at a permanent public URL:
   `GET /api/badges/[certHash]` → returns Open Badges 3.0 compliant JSON-LD

2. The assertion document structure:
```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
  ],
  "type": ["VerifiableCredential", "OpenBadgeCredential"],
  "id": "https://aava.ai/api/badges/[certHash]",
  "issuer": {
    "id": "https://aava.ai",
    "type": "Profile",
    "name": "AAVA Product Studio",
    "url": "https://aava.ai",
    "email": "certifications@aava.ai"
  },
  "issuanceDate": "2024-01-15T00:00:00Z",
  "credentialSubject": {
    "type": "AchievementSubject",
    "id": "mailto:[user-email]",
    "achievement": {
      "id": "https://aava.ai/certifications/[track-slug]",
      "type": "Achievement",
      "name": "AAVA Practitioner Certification",
      "description": "...",
      "criteria": { "narrative": "Pass the AAVA Practitioner exam with 80% or higher." },
      "image": { "id": "https://aava.ai/badges/practitioner.png", "type": "Image" }
    }
  }
}
```

3. The "Add to LinkedIn" button on the certificate page opens a pre-filled LinkedIn deep link:
```
https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME
  &name=AAVA+Practitioner+Certification
  &organizationId=        ← AAVA's LinkedIn Company Page ID (add once page is created)
  &issueYear=2024
  &issueMonth=1
  &certUrl=https%3A%2F%2Faava.ai%2Fverify%2F[certHash]
  &certId=[cert_number]   ← e.g. AAVA-2024-000042
```
This pre-populates the LinkedIn "Licenses & Certifications" form. The user clicks Save — one step.

4. The public `/verify/[certHash]` page renders the certificate and the JSON-LD assertion (for machine verification). LinkedIn will link to this page as the "Show Credential" URL.

**Key implementation notes:**
- The `/api/badges/[certHash]` route must respond with `Content-Type: application/ld+json`
- The badge image (`/badges/[tier].png`) must be hosted publicly — store in Supabase Storage with public bucket
- `organizationId` in the LinkedIn deeplink requires AAVA to have a LinkedIn Company Page — add the numeric ID once available
- The JSON-LD response must remain permanently available at that URL (do not delete issued certificate records)

### Additional Database Tables

```sql
-- Certification tracks (separate from internal courses)
create table certification_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  tier integer not null,                          -- 1, 2, 3
  domain text,                                    -- null for tiered, 'sprint_planning' etc for domain
  description text,
  prerequisite_track_id uuid references certification_tracks(id),
  passing_score integer default 80,
  exam_duration_minutes integer default 60,
  question_pool_size integer default 50,          -- Total questions in pool
  questions_per_exam integer default 30,          -- Randomly selected per attempt
  status text default 'published',
  created_at timestamptz default now()
);

-- Public user accounts (can be non-employees)
-- Uses the same profiles table; role = 'public' for external users

-- Certification question pool
create table cert_questions (
  id uuid primary key default gen_random_uuid(),
  track_id uuid references certification_tracks(id) on delete cascade,
  question_text text not null,
  question_type text not null,                    -- 'multiple_choice' | 'open_ended'
  options jsonb,
  correct_answer text,
  rubric text,                                    -- For open_ended LLM grading
  max_points integer default 10,
  difficulty text default 'medium',               -- 'easy' | 'medium' | 'hard'
  tags text[],
  created_at timestamptz default now()
);

-- Certification attempts
create table cert_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  track_id uuid references certification_tracks(id),
  attempt_number integer default 1,
  question_ids uuid[],                            -- The randomly selected question set for this attempt
  score numeric(5,2),
  passed boolean,
  started_at timestamptz default now(),
  submitted_at timestamptz,
  expires_at timestamptz                          -- 24h cooldown window for next attempt
);

-- Earned certificates
create table certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  track_id uuid references certification_tracks(id),
  attempt_id uuid references cert_attempts(id),
  cert_number text unique not null,               -- AAVA-2024-XXXXXX (human-readable)
  verification_hash text unique not null,         -- SHA-256 for public verification
  issued_at timestamptz default now(),
  expires_at timestamptz,                         -- null = no expiry
  revoked boolean default false,
  revoked_at timestamptz
);
```

### Certificate Page Design

The public certificate at `/certifications/verify/[hash]` should display:
- AAVA logo
- Recipient full name (large, gradient text)
- Certification name + tier badge
- Issue date
- Verification status ("✓ Verified by AAVA")
- LinkedIn share button
- Print/PDF download button

---

## Video in Lessons

Video is supported in both internal courses and certification tracks. Lessons can contain one or more video blocks inside the block editor.

### Upload Flow (Admin)

1. Admin drags a video file into the block editor (or uses a dedicated "Add Video" block)
2. Frontend requests a **Bunny.net direct upload URL** via a server-side API route (`POST /api/admin/video/upload-url`)
3. The file uploads directly from the browser to Bunny.net via a presigned PUT URL — never through our server
4. On upload complete: store the Bunny.net `videoId` (GUID) in the lesson content JSON as a video block: `{ type: "video", videoId: "abc123", title: "..." }`
5. Bunny.net transcodes asynchronously — show a "Processing…" state in the editor until `status === 4` (ready) by polling `GET /api/admin/video/status/[videoId]`

### Playback (Learner)

- Render the Bunny.net Stream Player iframe: `https://iframe.mediadelivery.net/embed/[libraryId]/[videoId]`
- Enable **token authentication** for all internal/sales zone videos (prevent hotlinking). Public cert track videos can be unauthenticated.
- Signed token generation happens server-side in the lesson page Server Component using HMAC-SHA256; token TTL = 4 hours

### Schema additions

```sql
-- Add to lessons table
alter table lessons add column video_ids text[] default '{}';
-- Bunny.net video GUIDs referenced in this lesson (for token auth generation)
-- Full video metadata (title, duration, thumbnail) lives in Bunny.net Stream, not our DB
```

### Environment Variables (add)
```env
BUNNY_STREAM_API_KEY=              # Bunny.net API key (server-side only)
BUNNY_STREAM_LIBRARY_ID=           # Stream library ID
BUNNY_STREAM_CDN_HOSTNAME=         # e.g. vz-abc123.b-cdn.net
BUNNY_STREAM_TOKEN_SECRET=         # HMAC-SHA256 secret for token auth
```

### API Routes
```
POST /api/admin/video/upload-url    → Get a Bunny.net presigned upload URL
GET  /api/admin/video/status/[uid]  → Poll transcoding status from Bunny.net API
DELETE /api/admin/video/[uid]       → Delete from Bunny.net library (admin only)
GET  /api/video/token/[uid]         → Generate signed playback token (authenticated users only)
```

### Lesson Video Block (Tiptap)

Define a custom Tiptap Node extension `VideoBlock` that:
- In edit mode: shows upload dropzone or videoId input + processing state
- In view mode (learner): renders the Bunny.net iframe player with signed token appended
- Stores: `{ type: 'video', attrs: { videoId: string, title: string, duration: number } }`

---

## AI Course & Content Generator (Admin)

Admins can describe a course or lesson in plain language and have the LLM generate a structured draft. This accelerates content creation significantly.

### Course Generator

**UI:** Admin opens "New Course" → optional "Generate with AI" toggle appears above the form.

**Inputs:**
```
Course Title:       [text input]
Audience:           [dropdown: employees / sales / certification / all]
Description:        [textarea] "Describe what this course covers, who it's for, and what learners will be able to do after."
Number of lessons:  [1–20, default 5]
Include quizzes:    [toggle, default on]
```

**API Route:** `POST /api/admin/generate/course`

```typescript
// Prompt structure sent to OpenRouter
const systemPrompt = `You are an expert instructional designer and product management trainer working for AAVA Product Studio.
Generate a complete course outline in JSON. Return ONLY valid JSON, no markdown fences, no preamble.

JSON structure:
{
  "title": string,
  "description": string,          // 2-3 sentence course overview
  "learning_objectives": string[], // 3-5 bullet points
  "lessons": [
    {
      "title": string,
      "summary": string,           // 1-2 sentences
      "key_topics": string[],      // 3-6 topics this lesson covers
      "content_outline": string,   // Markdown: headers, bullet points, key concepts
      "quiz": {
        "questions": [
          {
            "type": "multiple_choice" | "true_false" | "open_ended",
            "question_text": string,
            "options": [           // MC only: array of {text, is_correct}
              { "text": string, "is_correct": boolean }
            ],
            "rubric": string       // open_ended only
          }
        ]
      }
    }
  ]
}`

// User message:
`Create a ${lessonCount}-lesson course titled "${title}" for ${audience}.
Description: ${description}
Include quizzes: ${includeQuizzes}`
```

**Behavior after generation:**
- The entire generated course is created in the DB with `status = 'draft'`
- All lessons are created with `status = 'draft'`
- Admin is redirected to the course editor to review, edit, and publish
- Each lesson's `content_outline` is pre-loaded into the Tiptap block editor as parsed Markdown (see Markdown Import below)
- Admin can regenerate individual lessons without affecting the rest

### Lesson Generator

Available on any individual lesson editor: "Generate lesson content" button opens a side panel.

**Inputs:** Course context (auto-filled) + lesson title + optional additional notes

**Output:** Populates the Tiptap editor with structured content. Does not overwrite existing content without a confirmation dialog ("Replace existing content?").

---

## Draft / Published Status

Every piece of content has a `status` field. The system supports two states:

| Status | Behavior |
|--------|----------|
| `draft` | Visible only in admin. Never shown to learners. Does not appear in course catalog. |
| `published` | Visible to learners according to zone/role rules. |

### Rules

- A **course** can only be published if it has at least one published lesson
- A **lesson** can be published independently — useful for incremental rollout
- A **certification track** can only be published if it has a complete published question pool (≥ `questions_per_exam` questions)
- Admins see draft content everywhere in the admin UI, clearly badged `DRAFT` in orange
- Draft content never appears in learner-facing API responses — enforced at the RLS level AND in API route logic (belt-and-suspenders)

### Status UI

- Course card in admin: status badge top-right (`DRAFT` / `PUBLISHED`)
- Lesson row in course editor: status dot + toggle switch (Draft ↔ Published)
- Publish action: clicking "Publish" on a course triggers a pre-flight check — lists any unpublished lessons and asks admin to confirm or auto-publish all
- **Unpublish is always allowed** — returns content to draft immediately

### DB Pattern

```sql
-- Already on courses, lessons, certification_tracks, docs_pages:
status text not null default 'draft'  -- 'draft' | 'published'

-- RLS selects for learners always include: AND status = 'published'
-- Admin RLS policies see all statuses
```

---

## Markdown Import in the Block Editor

Admins can paste raw Markdown into the block editor. This makes it easy to copy content from Notion, Confluence, GitHub, ChatGPT, or any text editor and have it render as proper Tiptap blocks.

### How It Works

**Paste detection:** Override the Tiptap `handlePaste` event. If pasted content:
- Is plain text AND
- Contains Markdown syntax (starts with `#`, contains `**`, `- `, `1. `, ` ``` `, `> `, etc.)

→ Parse it as Markdown and insert as Tiptap JSON nodes instead of raw text.

**Explicit import button:** A "Paste Markdown" button in the editor toolbar opens a modal with a plain textarea. Admin pastes Markdown, clicks "Import" — content is parsed and inserted at the cursor position (or replaces all content if editor is empty, with confirmation).

### Implementation

Use the Tiptap `@tiptap/extension-markdown` extension which handles bidirectional Markdown ↔ Tiptap JSON conversion:

```bash
npm install @tiptap/extension-markdown
```

```typescript
// In BlockEditor.tsx — add to editor extensions:
import { Markdown } from '@tiptap/extension-markdown'

useEditor({
  extensions: [
    StarterKit,
    Markdown.configure({
      html: false,          // Don't allow raw HTML paste
      transformPastedText: true,   // Auto-convert pasted markdown
      transformCopiedText: false,  // Don't convert on copy
    }),
    // ... other extensions
  ]
})
```

**Supported Markdown elements → Tiptap nodes:**
- `# H1`, `## H2`, `### H3` → Heading nodes
- `**bold**`, `*italic*` → marks
- `- item`, `* item` → BulletList
- `1. item` → OrderedList
- `- [ ] task` → TaskList
- ` ```code``` ` → CodeBlock
- `> quote` → Blockquote
- `---` → HorizontalRule
- `[text](url)` → Link
- Tables → Table node (if Table extension installed)

## Embed Blocks in Content

Both the block editor (admin/internal) and the public docs site support rich embeds.

### Block Editor — Embed Block (Tiptap)

A custom `EmbedBlock` Tiptap Node extension handles arbitrary embeds. Admins can paste an iframe embed code or a URL and it renders sandboxed in the editor and learner view.

**Supported embed types (auto-detected from URL or code):**
- YouTube / Vimeo (video URL → embed)
- Loom (share URL → embed)
- Figma (embed code or share URL)
- Miro / Lucidchart (embed URL)
- Google Slides / Docs (published embed URL)
- Generic iframe (paste raw `<iframe ...>` code)

**Implementation:**
```typescript
// Custom Tiptap Node: EmbedBlock
// Stores: { type: 'embed', attrs: { src: string, title: string, height: number, embedType: string } }

// In edit mode: URL/code input field with "Embed" button
// In view mode: sandboxed iframe with:
//   sandbox="allow-scripts allow-same-origin allow-presentation"
//   referrerpolicy="no-referrer"
//   loading="lazy"

// URL parsing helpers:
// YouTube: https://youtube.com/watch?v=ID → https://www.youtube-nocookie.com/embed/ID
// Vimeo:   https://vimeo.com/ID → https://player.vimeo.com/video/ID
// Loom:    https://www.loom.com/share/ID → https://www.loom.com/embed/ID
// Figma:   https://www.figma.com/... → extract from embed code
// Generic: extract src from pasted <iframe ...> HTML
```

**Slash command:** `/embed` in the editor opens the embed input panel.

**Security note:** Never render raw pasted HTML. Always extract the `src` from pasted embed codes and construct the iframe programmatically. Store only the `src` URL, not raw HTML.

### Public Docs Site — MDX Embeds (Docusaurus)

The public docs site uses Docusaurus with MDX, which supports React components inline. Create a reusable `<Embed>` component:

```tsx
// docs/src/components/Embed.tsx
export function Embed({ src, title, height = 400 }: { src: string; title: string; height?: number }) {
  return (
    <iframe
      src={src}
      title={title}
      width="100%"
      height={height}
      style={{ border: 'none', borderRadius: '8px' }}
      sandbox="allow-scripts allow-same-origin allow-presentation"
      loading="lazy"
    />
  )
}
```

Usage in any `.mdx` doc file:
```mdx
import { Embed } from '@site/src/components/Embed'

## Demo Video

<Embed src="https://www.loom.com/embed/abc123" title="Feature demo" height={480} />
```

---

## Docs Site Navigation Structure

### Public Docs (Docusaurus)

Docusaurus supports unlimited nesting via `_category_.json` files. Structure example:

```
docs/
├── sidebars.js               ← Auto-generated or manually defined
├── intro.md                  ← Top-level landing page
├── getting-started/
│   ├── _category_.json       ← { "label": "Getting Started", "position": 1, "collapsed": false }
│   ├── overview.md
│   ├── quick-start.md
│   └── key-concepts.md
├── methodology/
│   ├── _category_.json       ← { "label": "AAVA Methodology", "position": 2 }
│   ├── goals-okrs/
│   │   ├── _category_.json   ← { "label": "Goals & OKRs", "position": 1 }
│   │   ├── overview.md
│   │   └── goal-decomposition.md
│   └── sprint-planning/
│       ├── _category_.json
│       └── ...
└── certifications/
    ├── _category_.json
    └── ...
```

The sidebar auto-generates from this folder structure. Sections are collapsible, can have their own landing pages, and support badges/icons via `_category_.json` customization.

### Internal Content Nav (Admin CMS + Learner View)

Internal lessons use a **tree-nav component** built with shadcn + recursive rendering:

```typescript
// Structure stored in DB: courses → lessons (ordered)
// For docs pages: docs_pages with parent_id + order_index allows arbitrary nesting

// NavTree component renders:
// ▼ Section: Goals & OKRs          ← course (collapsible)
//   ✓ Lesson 1: Goal Extraction    ← completed lesson (checkmark)
//   ● Lesson 2: Alignment Validator ← current lesson (dot)
//   ○ Lesson 3: Decomposition      ← upcoming lesson (empty circle)
//
// Admin docs nav mirrors this with add/reorder/nest controls
```

The `docs_pages` table already has `parent_id` for nesting. Build a recursive CTE query to fetch the full tree in one DB call:

```sql
-- Recursive nav tree query
with recursive nav_tree as (
  select id, title, slug, parent_id, order_index, 0 as depth
  from docs_pages
  where parent_id is null and status = 'published'
  union all
  select d.id, d.title, d.slug, d.parent_id, d.order_index, n.depth + 1
  from docs_pages d
  join nav_tree n on d.parent_id = n.id
  where d.status = 'published'
)
select * from nav_tree order by depth, order_index;
```

---

### Rule: Every feature must follow this process. No exceptions.

```
1. Create feature spec:     docs/features/[feature-name].md
2. Build frontend + backend
3. Write tests (see Testing Standards below)
4. All tests pass
5. Update feature doc with "Status: Complete" + test coverage summary
6. Open PR / commit
```

### Feature Doc Template

Every new feature gets a file at `docs/features/[kebab-case-name].md`:

```markdown
# Feature: [Name]

**Status:** Draft | In Progress | Complete
**Zone:** training | sales | docs | certification | admin | shared
**Last Updated:** YYYY-MM-DD

## Purpose
One paragraph. What does this do and why does it exist?

## User Stories
- As a [role], I can [action] so that [outcome]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes
- Key implementation decisions
- API routes involved
- DB tables touched
- LLM integration notes (if applicable)

## Test Coverage
- Unit: `tests/unit/[file].test.ts`
- Integration: `tests/integration/[file].test.ts`
- E2E: `tests/e2e/[file].spec.ts`

## Known Limitations / Future Work
```

---

## Testing Standards

### A feature is NOT done until all three test layers pass.

```
tests/
├── unit/           # Vitest — pure functions, utilities, scoring logic
├── integration/    # Vitest + Supabase test DB — API routes, DB queries
└── e2e/            # Playwright — full user flows in browser
```

### Unit Tests (Vitest)

Required for:
- All scoring/calculation functions (`lib/scoring/`)
- LLM grader response parsing (`lib/openrouter/`)
- Auth role helpers
- Any pure utility function

```ts
// Example: tests/unit/scoring/calculator.test.ts
import { describe, it, expect } from 'vitest'
import { calculateCourseScore } from '@/lib/scoring/calculator'

describe('calculateCourseScore', () => {
  it('returns 100 when all questions answered correctly', () => { ... })
  it('returns 0 when no points earned', () => { ... })
  it('weights open-ended questions by max_points', () => { ... })
  it('uses latest attempt per quiz when multiple attempts exist', () => { ... })
  it('marks as passed when score >= passing_score', () => { ... })
  it('marks as failed when score < passing_score', () => { ... })
})
```

### Integration Tests (Vitest + Supabase)

Required for:
- Every API route in `app/api/`
- RLS policies (test that employee cannot access sales content, etc.)
- Quiz submission pipeline end-to-end
- Certificate generation + verification hash

```ts
// Use a test Supabase project configured in .env.test
// Seed with test fixtures before each test suite
// Teardown after each suite
```

Test these role + access combinations explicitly:

| Test Case | Expected |
|-----------|----------|
| `public` user accesses `/api/training/courses` | 401 |
| `employee` accesses training course | 200 |
| `employee` accesses sales course | 403 |
| `sales` accesses sales course | 200 |
| `sales` accesses training course | 200 |
| `admin` accesses any route | 200 |
| Learner accesses `draft` course | 404 |
| Learner accesses `draft` lesson | 404 |
| Quiz submission with invalid attempt ID | 400 |
| Open-ended grading stores LLM feedback | row exists in question_responses |
| Cert attempt #4 within 30 days | 429 |
| `/api/badges/[certHash]` returns valid JSON-LD | Content-Type: application/ld+json |
| Video upload URL route called by non-admin | 403 |
| Signed video URL route called by unauthenticated user | 401 |
| AI generator called with empty description | 400 |

### E2E Tests (Playwright)

Required for every user-facing flow. Cover the happy path AND at least one error/edge case per flow.

```
tests/e2e/
├── auth/
│   ├── login.spec.ts                  # Login, logout, magic link
│   └── role-redirect.spec.ts          # Zone access redirects
├── training/
│   ├── course-enrollment.spec.ts
│   ├── lesson-completion.spec.ts
│   ├── video-playback.spec.ts         # Video block renders, signed URL works
│   └── quiz-submission.spec.ts        # MC, T/F, open-ended
├── certification/
│   ├── public-signup.spec.ts
│   ├── exam-flow.spec.ts              # Timed exam, randomized questions
│   ├── certificate-generation.spec.ts
│   ├── certificate-verify.spec.ts     # Public verify page
│   └── linkedin-badge.spec.ts         # Open Badges JSON-LD endpoint
├── admin/
│   ├── course-editor.spec.ts
│   ├── draft-publish-workflow.spec.ts # Status toggle, publish preflight check
│   ├── ai-generator.spec.ts           # Course + lesson generation flow
│   ├── markdown-import.spec.ts        # Paste markdown, explicit import modal
│   ├── video-upload.spec.ts           # Upload flow, processing state
│   ├── quiz-builder.spec.ts
│   └── user-management.spec.ts
└── docs/
    └── public-docs.spec.ts
```

### Running Tests

```bash
# Unit + integration
npx vitest run

# Watch mode during development
npx vitest

# E2E (requires running dev server)
npx playwright test

# E2E with UI
npx playwright test --ui

# Coverage report
npx vitest run --coverage
```

### Coverage Targets

| Layer | Minimum Coverage |
|-------|-----------------|
| Unit (lib/) | 90% |
| Integration (API routes) | 80% |
| E2E (user flows) | All flows documented in feature docs |

---

## Project Documentation Structure

```
docs/
├── architecture/
│   ├── overview.md                  # System design, stack decisions
│   ├── zones.md                     # Access zones + role matrix
│   ├── database.md                  # Full schema with ERD
│   ├── llm-grading.md               # OpenRouter grading integration
│   └── video.md                     # Bunny.net Stream integration details
├── features/
│   ├── block-editor.md              # Tiptap editor + markdown import
│   ├── quiz-builder.md
│   ├── llm-grading.md
│   ├── llm-content-generator.md     # AI course/lesson generation
│   ├── video-lessons.md             # Bunny.net Stream upload + playback
│   ├── draft-published-workflow.md  # Status system
│   ├── markdown-import.md
│   ├── course-completion-tracking.md
│   ├── certification-system.md
│   ├── open-badges.md               # LinkedIn Open Badges 3.0 integration
│   ├── certificate-verification.md
│   ├── admin-cms.md
│   ├── user-management.md
│   └── public-docs.md
└── decisions/
    └── [YYYY-MM-DD]-[topic].md      # Architecture Decision Records (ADRs)
```

---

## Code Conventions

### TypeScript
- Strict mode always on (`"strict": true` in tsconfig)
- No `any` — use `unknown` and narrow, or define proper types
- Database types generated from Supabase: `lib/supabase/database.types.ts`
- All API route handlers typed with `NextRequest` / `NextResponse`

### File Naming
- Components: `PascalCase.tsx`
- Utilities/lib: `camelCase.ts`
- Tests: `[filename].test.ts` or `[filename].spec.ts`
- Feature docs: `kebab-case-name.md`

### Server vs Client Components
- Default to **Server Components**
- Add `'use client'` only when needed (event handlers, hooks, browser APIs)
- Never fetch data in Client Components — pass as props from Server Components or use Server Actions
- All LLM calls (OpenRouter) happen server-side only — never expose `OPENROUTER_API_KEY` to the client

### Supabase Patterns
- Use `createServerComponentClient` in Server Components
- Use `createRouteHandlerClient` in API routes
- Use `createMiddlewareClient` in middleware only
- **Never use the service role key client-side** — only in API routes for operations that need to bypass RLS intentionally (quiz grading writes)
- Always handle Supabase errors explicitly — do not assume `.data` is non-null

### API Routes
- All routes return typed JSON responses
- Use `NextResponse.json({ error: 'message' }, { status: 4xx })` for errors
- Validate all inputs with **Zod** before processing
- Rate limit sensitive routes (quiz submission, cert attempts) using Upstash Redis or a simple DB-backed counter

---

## Knowledge (Support Docs)

The **Knowledge** zone is a scoped support documentation section — the place users go for how-tos, reference guides, FAQs, and process docs outside of formal courses. It uses the same `docs_pages` table and block editor already in the platform, with access controlled by visibility.

This is distinct from:
- **Courses** → structured, sequential training with quizzes and completion tracking
- **Public docs site** (`/docs`) → static Docusaurus methodology reference
- **Knowledge** (`/knowledge`) → searchable, browseable support docs scoped by access level

### Access Model

Every knowledge page inherits the same visibility system as the rest of the platform:

| Visibility | Who sees it |
|------------|-------------|
| `public` | Anyone, no login required |
| `internal` | All authenticated users (employee, sales, admin) |
| `group:[name]` | Named group members only (e.g. `group:sales`) |

Group membership is stored in a `user_groups` join table (see schema below). A user can belong to multiple groups.

### Database

Reuses the existing `docs_pages` table with `visibility` added:

```sql
alter table docs_pages add column visibility text not null default 'internal';
-- 'public' | 'internal' | 'group:[name]'

-- Group membership
create table user_groups (
  user_id uuid references profiles(id) on delete cascade,
  group_name text not null,
  added_by uuid references profiles(id),
  added_at timestamptz default now(),
  primary key (user_id, group_name)
);
```

RLS: same pattern as `kb_articles` — public reads for public pages, role check for internal, group join for group pages.

### Navigation Structure

Knowledge pages use the same nested `parent_id` + `order_index` tree as the public docs site, rendered in a left sidebar with collapsible sections. The recursive CTE nav query (see Docs Site Navigation Structure section) is reused here.

```
/knowledge
├── Getting Started
│   ├── How to use Throughput
│   └── Your learning path
├── AAVA Methodology
│   ├── Goals & OKRs
│   ├── Sprint Planning
│   └── ...
├── Templates & Tools          ← internal only
│   └── ...
└── Sales Resources            ← group:sales only
    └── ...
```

### Search

The global search bar (top nav) includes knowledge pages in its results, scoped to the user's access level. Uses Postgres `tsvector` full-text search — no AI, no embeddings, no additional cost.

```sql
-- Add full-text search index to docs_pages
alter table docs_pages add column search_vector tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content::text, ''))
  ) stored;

create index docs_pages_search_idx on docs_pages using gin(search_vector);
```

### Admin CMS

Knowledge pages are managed in `/admin/knowledge` — same CRUD pattern as the course CMS, using the block editor. Admin can:
- Create pages and nest them under parent pages
- Set visibility per page
- Drag to reorder within a section
- Publish / unpublish (same draft/published workflow)


```env
# .env.local (never commit)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=             # Server-side only

OPENROUTER_API_KEY=                    # Server-side only — grading + content generation
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small

NEXT_PUBLIC_SITE_URL=                  # e.g. https://throughput.aava.ai

BUNNY_STREAM_API_KEY=                  # Server-side only
BUNNY_STREAM_LIBRARY_ID=               # Stream library ID
BUNNY_STREAM_CDN_HOSTNAME=             # e.g. vz-abc123.b-cdn.net
BUNNY_STREAM_TOKEN_SECRET=             # HMAC-SHA256 secret for token auth

# .env.test (separate Supabase project for tests)
SUPABASE_TEST_URL=
SUPABASE_TEST_SERVICE_ROLE_KEY=
```

---

## gstack

Use the `/browse` skill from gstack for **all web browsing**. Never use `mcp__claude-in-chrome__*` tools.

### Available skills

| Skill | Purpose |
|-------|---------|
| `/office-hours` | Office hours sessions |
| `/plan-ceo-review` | Plan CEO review |
| `/plan-eng-review` | Plan engineering review |
| `/plan-design-review` | Plan design review |
| `/design-consultation` | Design consultation |
| `/review` | Code review |
| `/ship` | Ship code |
| `/browse` | Web browsing (use this instead of MCP browser tools) |
| `/qa` | QA testing |
| `/qa-only` | QA testing only |
| `/design-review` | Design review |
| `/setup-browser-cookies` | Set up browser cookies |
| `/retro` | Retrospective |
| `/debug` | Debug issues |
| `/document-release` | Document a release |

---

## Git Conventions

```
feat:     New feature
fix:      Bug fix
test:     Adding or updating tests
docs:     Documentation only (including docs/features/)
refactor: Code restructure, no behavior change
chore:    Deps, config, tooling
```

Branch naming: `feat/[feature-name]`, `fix/[issue]`, `test/[area]`

**No PR merges without:**
1. Passing CI (unit + integration tests)
2. Playwright e2e passing on the affected flows
3. Feature doc created/updated in `docs/features/`

---

## Common Gotchas

- **Tiptap content** is stored as JSON. Never store HTML. Render with `EditorContent` in `editable: false` mode for the learner view.
- **Markdown paste** — the `@tiptap/extension-markdown` `transformPastedText` option handles auto-detection on paste. The explicit "Paste Markdown" modal is a UX affordance for users who want deliberate import, not accidental paste conversion.
- **Quiz randomization for certifications** — select questions server-side, store the selected `question_ids[]` on the `cert_attempts` row immediately on exam start. Do not re-randomize on page reload.
- **LLM grading latency** — open-ended questions take 3–6 seconds to grade. Show a loading state in the quiz results view. Grade async: submit all MC/TF responses immediately, stream open-ended grades as they complete.
- **AI generator output** — always creates content in `draft` status. Never auto-publish. Always redirect admin to the editor to review before publishing.
- **Draft content in API responses** — enforce `status = 'published'` filter in BOTH RLS policies AND API route query logic. Belt-and-suspenders. A misconfigured RLS policy should not be the only guard.
- **Bunny.net token auth** — generate server-side only using HMAC-SHA256 of (libraryId + tokenSecret + expirationTime + videoId). TTL = 4 hours. Never cache tokens client-side. Regenerate on each lesson page load. Unauthenticated URLs for public cert track content only. Bunny.net docs: https://docs.bunny.net/docs/stream-embedding-videos
- **Video upload via Direct Creator Upload** — the upload goes browser → Cloudflare directly. Our API route only generates the upload URL (server-side Cloudflare API call). Never proxy the video upload through our Next.js server.
- **Bunny.net transcoding** — after upload, `status` will be `3` (processing) for 30–120 seconds. Poll until `status === 4` (ready) before allowing the lesson to be published. Status codes: 0=queued, 1=processing, 2=encoding, 3=finished, 4=error — handle status 4 (error) explicitly with a retry option in the admin UI.
- **Open Badges JSON-LD endpoint** — must be permanently available. Never delete certificate records. The `certHash` is the public key. Handle the route in Next.js as a static-ish API route with proper caching headers (`Cache-Control: public, max-age=3600`).
- **LinkedIn deeplink organizationId** — this is AAVA's LinkedIn Company Page numeric ID. Find it in the LinkedIn Company Page admin URL. Without it, the LinkedIn form won't show the AAVA logo/name pre-filled as the issuer, but it will still work.
- **Certificate verification hash** — use `crypto.createHash('sha256').update(cert.id + cert.user_id + cert.issued_at).digest('hex')`. Store it on the `certificates` row. The public `/verify/[hash]` page looks up by this hash, not by UUID (prevents enumeration).
- **RLS + service role** — quiz submission and cert grading writes use the service role key in the API route after manually validating the session. Document this clearly in the API route file with a comment explaining why.
- **Supabase free tier Storage** — 1GB limit. Use for cover images, lesson images, and badge PNG files only. Video lives in Bunny.net Stream.
