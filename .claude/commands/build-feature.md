# /project:build-feature

Build a feature for the Throughput end-to-end.

## Usage
```
/project:build-feature $FEATURE_NAME
```

## What This Command Does

You are building a feature for the Throughput. Before writing any code, read CLAUDE.md in full. It contains the design system, stack, conventions, testing standards, and all architectural decisions. Do not deviate from it.

For the feature: **$FEATURE_NAME**

Execute these steps IN ORDER. Do not skip any step. Do not consider the feature done until all steps are complete.

---

### Step 1 — Read CLAUDE.md
Read `CLAUDE.md` in the project root. Confirm you understand the stack, design tokens, testing requirements, and feature doc requirements before proceeding.

### Step 2 — Create or Update Feature Doc
Create (or update if it exists) `docs/features/[kebab-case-feature-name].md` using the template in CLAUDE.md. Set Status to "In Progress". List the acceptance criteria you plan to implement. Commit this file before writing any code.

### Step 3 — Database Changes (if any)
If the feature requires schema changes:
- Write the migration SQL in `supabase/migrations/[timestamp]_[feature-name].sql`
- Include RLS policies
- Include rollback SQL in a comment at the bottom
- Apply the migration to the local Supabase instance

### Step 4 — Backend / API Routes
Build all server-side logic:
- API routes in `app/api/`
- Validate all inputs with Zod
- Handle errors explicitly — no silent failures
- Use the correct Supabase client (server component / route handler / service role where documented)
- Add JSDoc comments on all exported functions

### Step 5 — Frontend Components
Build all UI:
- Follow the design system in CLAUDE.md exactly (color tokens, shadcn primitives, component conventions)
- Default to Server Components; add `'use client'` only where required
- All interactive states: loading, error, empty, success
- Mobile responsive

### Step 6 — Unit Tests
Write unit tests in `tests/unit/` covering:
- All pure functions and utilities introduced by this feature
- Edge cases and error paths
- Minimum 90% coverage on `lib/` code touched by this feature

Run: `npx vitest run tests/unit/` — all must pass before continuing.

### Step 7 — Integration Tests
Write integration tests in `tests/integration/` covering:
- Every API route introduced or modified
- RLS policy enforcement for all roles that interact with this feature
- The full data flow (request → DB → response)

Run: `npx vitest run tests/integration/` — all must pass before continuing.

### Step 8 — E2E Tests
Write Playwright tests in `tests/e2e/` covering:
- The complete happy path user flow
- At least one error/edge case path
- Role-based access (if applicable): test that unauthorized roles cannot access the feature

Run: `npx playwright test tests/e2e/[feature-area]/` — all must pass before continuing.

### Step 9 — Update Feature Doc
Update `docs/features/[feature-name].md`:
- Set Status to "Complete"
- Fill in the Test Coverage section with file paths
- Note any known limitations or follow-up work

### Step 10 — Summary
Output a summary of:
- What was built
- Files created/modified
- Test coverage achieved
- Any deviations from the spec and why
- Any follow-up items for future features
