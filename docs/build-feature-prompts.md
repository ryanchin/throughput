# Throughput — Build Feature Prompts

Run these in Claude Code IN ORDER. Each builds on the previous.
Each prompt uses the `/project:build-feature` custom command.

Paste the entire block for each prompt into Claude Code.

---

## PHASE 1 — Foundation

### 1.1 — Project Scaffold + Design System

```
/project:build-feature project-scaffold

Before writing any code, set up the full project foundation:

1. Scaffold a Next.js 16 (App Router) project with TypeScript and Tailwind
2. Install and configure shadcn/ui with dark mode as the default
3. Apply the full design token system from CLAUDE.md to globals.css and tailwind.config.ts — every CSS variable and Tailwind color extension exactly as specified
4. Install all dependencies listed in the "Initial Setup Commands" section of CLAUDE.md
5. Create the full folder structure from the "Project Structure" section of CLAUDE.md — empty files with correct names are fine at this stage
6. Set up path aliases in tsconfig.json (@/ pointing to src/ or root as appropriate)
7. Create .env.local.example with all environment variable keys from CLAUDE.md (no values)
8. Create a simple /app/page.tsx that renders the AAVA logo text, a headline using the gradient-brand style, and confirms the design system is working
9. Verify the dev server runs without errors

Tests required: a single Playwright smoke test that visits / and confirms the page loads with a 200 status.
```

---

### 1.2 — Supabase Schema + Auth

```
/project:build-feature supabase-auth-and-schema

Set up Supabase authentication and the complete database schema.

1. Create all migration SQL files in supabase/migrations/ for every table defined in CLAUDE.md:
   - profiles, courses, lessons, quizzes, questions
   - course_enrollments, lesson_progress, quiz_attempts, question_responses
   - docs_pages
   - certification_tracks, cert_questions, cert_attempts, certificates
   Include all RLS policies exactly as specified in CLAUDE.md.

2. Create a Supabase trigger that auto-creates a profiles row on auth.users insert:
   - Default role: 'employee' for email signups
   - Default role: 'public' for users who sign up via the /certifications public flow (detect by referrer or a signup_context param)

3. Build the auth flow:
   - /login page: email + password form + magic link option, styled with the design system
   - /logout route handler
   - middleware.ts implementing the full role-based route protection from CLAUDE.md
   - A useProfile() hook (client) and getProfile() server utility

4. Build a minimal layout for the (app) route group showing:
   - Top nav with AAVA logo, zone links (Training / Sales if role permits), user avatar + logout
   - Zone indicator showing which section the user is in

Tests required:
- Unit: getProfile() returns null for unauthenticated, profile object for authenticated
- Integration: test all role/route combinations from the CLAUDE.md integration test matrix
- E2E: login flow, logout flow, redirect to /login when unauthenticated, role-based redirect (employee → /training, blocked from /sales)
```

---

## PHASE 2 — CMS & Block Editor

### 2.1 — Block Editor

```
/project:build-feature block-editor

Build the Tiptap-based Notion-like block editor used throughout the admin CMS.

1. Install Tiptap and all extensions listed in CLAUDE.md Initial Setup Commands
2. Install @tiptap/extension-markdown for markdown paste/import support
3. Build BlockEditor.tsx as a 'use client' component with:
   - All block types from CLAUDE.md (H1/H2/H3, paragraph, bullet list, numbered list, checklist, code block, quote, divider, image, table, callout)
   - Slash command menu triggered by '/' — floating panel showing block type options with keyboard navigation
   - Bubble menu (appears on text selection): Bold, Italic, Underline, Code, Link, Highlight
   - Side '+' button on empty lines to trigger slash menu
   - Auto-save: debounced 2 seconds after last keystroke, saves Tiptap JSON to a provided onSave callback
   - Save status indicator: "Saving...", "Saved", "Error saving"

4. Markdown import — two paths:
   a. Auto-detect on paste: if pasted text looks like Markdown, convert to Tiptap nodes
   b. Explicit "Paste Markdown" button in toolbar: opens a modal with a plain textarea, "Import" button inserts at cursor (or replaces all with confirmation if editor is not empty)

5. Embed block (custom Tiptap Node):
   - Triggered by /embed slash command
   - Input: accepts a URL or pasted <iframe> HTML
   - Auto-detects YouTube, Vimeo, Loom, Figma, Google Slides, generic iframe
   - Extracts src from pasted embed codes (never stores raw HTML)
   - Renders sandboxed iframe in view and edit mode
   - Stores: { type: 'embed', attrs: { src, title, height, embedType } }

6. Build a read-only viewer component LessonViewer.tsx that renders Tiptap JSON content using EditorContent with editable: false — this is what learners see

Tests required:
- Unit: markdown detection heuristic, URL parser for each embed type (YouTube, Vimeo, Loom, Figma)
- Unit: embed src extraction from pasted iframe HTML
- E2E: type content, verify slash menu appears, select heading block, verify it renders; paste markdown, verify it converts; paste YouTube URL in embed block, verify iframe src is correct
```

---

### 2.2 — Draft/Published Status System

```
/project:build-feature draft-published-workflow

Implement the draft/published content status system across all content types.

1. Confirm all content tables (courses, lessons, certification_tracks, docs_pages) have a status column defaulting to 'draft'

2. Update all RLS policies to add AND status = 'published' to all learner-facing SELECT policies. Admin policies see all statuses.

3. Update all learner-facing API routes and Server Component data fetches to also filter status = 'published' in the query (belt-and-suspenders — not relying on RLS alone).

4. Admin UI — Course editor:
   - Status badge on every course card: DRAFT (amber) or PUBLISHED (green)
   - Publish button triggers a preflight check modal:
     * Lists any unpublished lessons in the course
     * Option: "Publish all lessons and this course" or "Cancel"
   - Unpublish button: immediate, no confirmation needed
   - Individual lesson rows have a toggle switch (Draft ↔ Published)

5. Validation rules (enforced in API routes, not just UI):
   - Cannot publish a course with zero published lessons → 422 with clear error message
   - Cannot publish a certification track with fewer questions than questions_per_exam → 422

6. Create an admin-only API route PATCH /api/admin/content/status that handles status changes for any content type (course, lesson, certification_track, docs_page) with the validation logic above.

Tests required:
- Unit: preflight validation functions (hasPublishedLessons, hasSufficientQuestions)
- Integration: PATCH /api/admin/content/status — test all content types, test validation failures, test non-admin gets 403
- Integration: confirm learner API routes return 404 for draft content across all roles
- E2E: toggle lesson draft → published → draft, publish a course with unpublished lessons (verify preflight modal), confirm published course appears in learner catalog, confirm draft course does not
```

---

### 2.3 — Course & Lesson CMS

```
/project:build-feature admin-course-cms

Build the full admin CMS for creating and managing courses and lessons.

1. /admin/courses page:
   - Course list with: title, zone badge (Training/Sales), status badge, lesson count, enrollment count, last updated, Edit / Delete actions
   - "New Course" button

2. Course create/edit form (/admin/courses/new and /admin/courses/[courseId]):
   - Fields: title, slug (auto-generated from title, editable), description, cover image upload (Supabase Storage), zone (Training/Sales dropdown), passing score (number input, default 70)
   - Slug validation: unique check against DB on blur
   - Cover image: drag-and-drop upload, preview, remove

3. Lesson management within course editor:
   - Ordered list of lessons with drag-to-reorder (dnd-kit)
   - Each lesson row: title, status toggle, Edit / Delete
   - "Add Lesson" button

4. Lesson editor (/admin/courses/[courseId]/lessons/[lessonId]):
   - Split-pane layout: left = lesson metadata + BlockEditor, right = Quiz Builder (built in next feature)
   - Lesson metadata: title, slug
   - BlockEditor wired to auto-save to lessons.content (jsonb)

5. All CRUD operations wired to Supabase via API routes or Server Actions (your choice — document which in the feature doc)

Tests required:
- Unit: slug generation function (title → kebab-case slug)
- Integration: CRUD for courses and lessons — create, read, update, delete; confirm RLS blocks non-admin
- E2E: create a course, add a lesson, type content in the block editor, verify auto-save indicator, reorder lessons via drag, publish the lesson and course, verify it appears in the learner /training catalog
```

---

### 2.4 — Quiz Builder

```
/project:build-feature quiz-builder

Build the admin quiz builder attached to lessons.

1. QuizBuilder.tsx component renders in the right pane of the lesson editor
2. A lesson can have one quiz (one-to-one for now)
3. Quiz has: title, optional instructions textarea
4. Questions list with drag-to-reorder (dnd-kit)

5. "Add Question" button shows a type picker:
   - Multiple Choice
   - True / False
   - Open Ended

6. Per question type UI:
   Multiple Choice:
   - Question text input
   - Add/remove answer options (min 2, max 6)
   - Radio to mark the correct answer
   - Point value input (default 10)

   True / False:
   - Question text input
   - Toggle: correct answer is True or False
   - Point value input (default 10)

   Open Ended:
   - Question text input
   - Rubric textarea with placeholder: "Describe what a full-credit answer includes. The AI grader will use this to score the response on a 0–[max_points] scale."
   - Point value input (default 10)

7. Preview mode: "Preview Quiz" button renders the quiz exactly as learners will see it (non-submittable in preview)

8. All quiz/question data persists to Supabase via auto-save (same pattern as the block editor — debounced 2s)

Tests required:
- Unit: quiz total points calculator (sum of question max_points)
- Integration: create quiz with all three question types, verify correct DB rows; update question order, verify order_index updates
- E2E: add one of each question type, set correct answers and rubric, enable preview mode and verify rendering, save and reload the lesson editor and verify quiz persists
```

---

## PHASE 3 — AI Features

### 3.1 — AI Course Generator

```
/project:build-feature ai-course-generator

Build the LLM-powered course and lesson content generator.

1. "Generate with AI" toggle on the New Course form (added to the course CMS built earlier)
   - When enabled, shows: Description textarea (required), Number of lessons (1–20, default 5), Include quizzes toggle (default on)
   - The existing Title and Zone fields are still required

2. POST /api/admin/generate/course API route:
   - Auth: admin only
   - Input: Zod-validated { title, zone, audience, description, lessonCount, includeQuizzes }
   - Calls OpenRouter with the exact prompt structure from CLAUDE.md (openai/gpt-oss-120b, response_format: json_object)
   - Parses the JSON response
   - Creates the course + all lessons + all quizzes + all questions in the DB in a single transaction, all with status = 'draft'
   - Returns { courseId } on success
   - On LLM or parse failure: returns 500 with error detail (never silently create partial data — use DB transaction so it's all-or-nothing)

3. After generation, redirect admin to /admin/courses/[courseId] with a toast: "Draft course generated — review and edit before publishing"

4. Each lesson's content_outline from the LLM is pre-loaded into the Tiptap block editor via the Markdown import path (parse the markdown outline into Tiptap JSON on insert)

5. "Regenerate lesson" button on individual lesson editor:
   - Calls POST /api/admin/generate/lesson with { courseContext, lessonTitle, additionalNotes }
   - Shows confirmation dialog if lesson has existing content: "Replace existing content?"
   - Inserts generated content into the editor

6. Loading states:
   - Course generation: full-page loading overlay "Generating your course draft…" with estimated time (15–30 seconds)
   - Lesson regeneration: inline spinner in the editor

Tests required:
- Unit: LLM JSON response parser + validator (test with valid response, malformed JSON, missing fields, extra fields)
- Unit: markdown-to-Tiptap conversion for the content_outline insertion
- Integration: POST /api/admin/generate/course — mock the OpenRouter call, verify DB rows are created correctly with draft status; verify transaction rollback on parse failure
- E2E: fill the generate form, mock OpenRouter to return a fixture response, verify course appears in admin list as DRAFT, verify lessons have content pre-loaded in editor
```

---

## PHASE 4 — Video

### 4.1 — Bunny.net Stream Video

```
/project:build-feature video-lessons

Integrate Bunny.net Stream for video upload and playback in lessons.

1. API routes:
   POST /api/admin/video/upload-url    → Get a Bunny.net presigned upload URL
   GET  /api/admin/video/status/[uid]  → Poll transcoding status from Bunny.net API
   DELETE /api/admin/video/[uid]       → Delete from Bunny.net library (admin only)
   GET  /api/video/token/[uid]         → Generate a signed playback token via HMAC-SHA256 (authenticated users; TTL 4 hours)

   All admin routes: admin-only auth guard
   Signed URL route: any authenticated user (employee, sales, admin)
   Never generate signed URLs for unauthenticated requests

2. VideoBlock custom Tiptap Node:
   - Triggered by /video slash command in the block editor
   - Edit mode: drag-and-drop upload zone OR paste a Bunny.net video GUID
   - Upload flow:
     a. Call POST /api/admin/video/upload-url to get the upload URL
     b. Upload directly from browser to Bunny.net via the presigned PUT URL using fetch with progress tracking (no extra library needed — Bunny.net uses standard HTTP PUT)
     c. Show upload progress bar (0–100%)
     d. On complete: store videoId in block attrs, start polling /api/admin/video/status/[uid]
     e. Show "Processing video…" state while transcoding (status !== 3 i.e. not finished)
     f. Once ready: show video thumbnail preview in editor
   - View mode (learner): render Bunny.net iframe player using token from /api/video/token/[uid]
     URL format: https://iframe.mediadelivery.net/embed/[BUNNY_STREAM_LIBRARY_ID]/[videoId]?token=[token]&expires=[expires]
   - Block stores: { type: 'video', attrs: { videoId: string, title: string, duration: number } }

3. Video title input: appears below the upload zone, required before the lesson can be published

4. A lesson with a video in status 'inprogress' (still transcoding) cannot be published — enforce this in the publish validation logic.

Tests required:
- Unit: HMAC-SHA256 token generation (verify it returns a string, verify it uses the correct secret, verify expiry is set correctly)
- Unit: upload URL requester (mock fetch, verify correct Bunny.net API call shape and headers)
- Integration: GET /api/video/token/[uid] — verify 401 for unauthenticated, 200 + token for authenticated; verify admin can delete, non-admin cannot
- E2E: mock the Bunny.net API responses; upload a video file, verify progress indicator, verify "Processing" state, mock status = 3 (finished), verify player iframe appears with correct Bunny.net embed src + token params; verify unauthenticated user cannot get a playback token
```

---

## PHASE 5 — Learner Experience

### 5.1 — Course Catalog + Enrollment

```
/project:build-feature course-catalog-and-enrollment

Build the learner-facing course catalog and enrollment flow.

1. /training page (employees + sales):
   - Grid of CourseCard components: cover image, title, description, lesson count, estimated time (sum of lesson durations), zone badge
   - Shows only published courses the user's role can access (training for all, sales only for sales+admin)
   - If already enrolled: shows progress bar and "Continue" button
   - If not enrolled: shows "Start Course" button
   - Empty state: "No courses available yet" with an illustration

2. /training/[courseSlug] course overview page:
   - Hero: cover image, title, description, learning objectives (if set)
   - Lesson list sidebar: all lessons with lock icons (future lessons locked until prior is complete, OR open navigation — make this a course-level setting: sequential vs free-navigation)
   - "Start Course" / "Continue" CTA button
   - Enrollment happens on first CTA click (creates course_enrollments row)
   - Progress ring showing X of Y lessons complete

3. /training/[courseSlug]/[lessonSlug] lesson page:
   - Left sidebar: lesson nav with completion checkmarks (LessonNav component)
   - Main content: LessonViewer (Tiptap read-only renderer) + any video blocks with signed URLs
   - "Mark as Complete" button at bottom — marks lesson_progress, auto-advances to next lesson
   - If lesson has a quiz: "Take Quiz" button appears after lesson content; quiz must be completed before lesson is marked complete
   - Progress bar in top of page: X of Y lessons complete + current aggregate score

4. Mirror this structure for /sales/[courseSlug]/[lessonSlug] — same components, sales zone filter

Tests required:
- Integration: GET /api/training/courses — returns only published training courses; sales zone courses excluded for employee role
- Integration: POST /api/training/enroll — creates enrollment row, returns existing enrollment if duplicate
- Integration: PATCH /api/training/progress — marks lesson complete, updates enrollment
- E2E: browse catalog, click Start Course, complete a lesson, verify checkmark, verify progress bar updates, navigate to next lesson
```

---

### 5.2 — Quiz Player + LLM Grading

```
/project:build-feature quiz-player-and-grading

Build the learner-facing quiz experience and LLM grading pipeline.

1. QuizPlayer.tsx component (client component):
   - One question per screen with Back/Next navigation
   - Progress indicator: "Question 3 of 8"
   - MC: radio button options
   - True/False: two large toggle buttons (True / False)
   - Open Ended: textarea with character count, min 50 chars to enable Submit
   - Submit button appears only on the final question (not Next)
   - Prevents navigating away with unsaved answers (beforeunload warning)

2. POST /api/quiz/submit API route:
   a. Validate session + quiz ownership (user is enrolled in the course)
   b. Create quiz_attempt row
   c. For each answer:
      - MC/TF: score immediately (compare to correct_answer), store in question_responses
      - open_ended: store answer, add to grading queue
   d. Grade all open_ended answers via gradeOpenEndedResponse() from lib/openrouter/grader.ts (exact implementation from CLAUDE.md)
   e. Update quiz_attempt.score
   f. Check if all required lessons complete → update course_enrollment status
   g. Recalculate and store aggregate course score using calculateCourseScore() from lib/scoring/calculator.ts
   h. Return full results including per-question feedback

3. Results display after submission:
   - Score badge: X / 100 with pass/fail color
   - Per-question breakdown: correct/incorrect indicator
   - For open_ended: LLM feedback card with score badge, narrative paragraph, strengths bullets, improvements bullets
   - "Retake Quiz" button (if course allows retakes)
   - "Next Lesson" button

4. Loading state during open_ended grading: animated "Your responses are being reviewed by AI…" overlay (3–6 second expected wait)

5. Implement gradeOpenEndedResponse() in lib/openrouter/grader.ts exactly per the CLAUDE.md spec
6. Implement calculateCourseScore() in lib/scoring/calculator.ts exactly per the CLAUDE.md spec

Tests required:
- Unit: calculateCourseScore() — all cases from CLAUDE.md unit test spec
- Unit: gradeOpenEndedResponse() JSON parser — valid response, malformed JSON, missing fields
- Integration: POST /api/quiz/submit — full pipeline with mocked OpenRouter; verify all DB rows created correctly; verify unenrolled user gets 403; verify course marked complete when all lessons done
- E2E: take a quiz with all three question types, submit, verify loading state appears, verify results page shows per-question feedback including LLM narrative for open_ended
```

---

### 5.3 — Course Completion + Score Card

```
/project:build-feature course-completion-scorecard

Build the course completion flow and final score display.

1. Course completion triggers when:
   - All required lessons marked complete AND
   - All lesson quizzes submitted (at least one attempt)

2. On completion:
   - Update course_enrollments.status to 'passed' or 'failed' based on final_score vs passing_score
   - Update course_enrollments.completed_at and final_score

3. Completion modal / page displayed immediately after the final lesson quiz:
   - Circular progress ring showing final score (animated fill)
   - PASSED (green, with confetti animation) or FAILED (amber, with encouragement message)
   - Score breakdown table: quiz name | score | max | percentage
   - "Share to LinkedIn" button (opens LinkedIn post share URL — not the cert system, just a simple share) for passed courses
   - "View Certificate" button (only if this course is tied to a certification track)
   - "Browse More Courses" button

4. Score card also accessible at /training/[courseSlug]/results

5. Admin completion tracking dashboard at /admin/users:
   - Table: Name | Email | Role | Courses Enrolled | Courses Passed | Avg Score | Last Active
   - Click a user to see per-course detail
   - Export to CSV button

Tests required:
- Unit: completion trigger logic (all required lessons done + all quizzes attempted)
- Integration: verify course_enrollment status updates correctly on completion; verify final_score is calculated correctly
- E2E: complete all lessons and quizzes in a course, verify completion modal appears with correct score, verify pass/fail status, verify it appears correctly in admin user table
```

---

## PHASE 6 — Certification System

### 6.1 — Certification Tracks + Public Signup

```
/project:build-feature certification-tracks

Build the public certification track system and signup flow.

1. /certifications page (public — no auth required):
   - Hero section: "Get AAVA Certified" headline with gradient text
   - Certification tier cards: Foundations (Silver), Practitioner (Cyan), Specialist (Gold)
   - Domain certifications grid below
   - Each card: name, tier badge, description, prerequisite indicator, "View Track" button
   - Prerequisites shown as locked if user hasn't earned them (requires auth to check — show lock icon with "Sign in to check eligibility")

2. Public account signup:
   - Separate from internal employee signup
   - Route: /certifications/signup
   - Fields: Full name, email, password (or magic link)
   - On signup: creates auth user + profiles row with role = 'public'
   - No org affiliation required

3. /certifications/[trackSlug] track overview page (public):
   - Track description, learning objectives, what's covered
   - Lesson list (publicly visible, readable without login)
   - Exam details: X questions, Y minutes, 80% to pass
   - "Start Learning" button (public) / "Take Exam" button (requires login + prerequisites met)
   - Prerequisite checker: if prerequisite cert not earned, show "Complete [prerequisite] first" with a link

4. Cert track admin CMS at /admin/certifications:
   - CRUD for certification_tracks
   - Question pool manager: add/edit/delete questions (MC + open_ended), set difficulty tags
   - Pool size indicator: "47 of 50 required questions added"

Tests required:
- Integration: GET /api/certifications — returns published tracks for unauthenticated users; prerequisite status included for authenticated users
- Integration: POST /api/certifications/signup — creates public profile, confirm role = 'public', confirm duplicate email returns 409
- E2E: visit /certifications as logged-out user, view a track, sign up for public account, verify redirect to track page, verify prerequisite lock state
```

---

### 6.2 — Certification Exam + Certificates

```
/project:build-feature certification-exam-and-certificates

Build the proctored certification exam and certificate generation.

1. Exam flow at /certifications/[trackSlug]/exam:
   - Requires login (redirect to /certifications/login if not)
   - Prerequisite check: if not met, redirect to track overview
   - Attempt limit check: if 3 attempts in last 30 days, show cooldown timer
   - On "Start Exam": server-side randomly selects questions_per_exam questions from the pool
     * Store selected question_ids[] on the cert_attempt row immediately (do not re-randomize on reload)
     * Use stratified sampling: proportional across difficulty levels (easy/medium/hard)
   - Countdown timer (duration from track config): displayed top-right, amber when < 5 min, red when < 1 min
   - Auto-submit when timer reaches 0
   - Same QuizPlayer component used for internal quizzes (reuse it)

2. Exam submission: POST /api/certifications/submit
   - Same grading pipeline as internal quizzes (MC/TF immediate, open_ended → OpenRouter)
   - On pass (score >= passing_score):
     a. Generate cert_number: AAVA-[YYYY]-[6-digit-padded-sequence] e.g. AAVA-2024-000042
     b. Generate verification_hash: SHA-256 of (cert.id + user_id + issued_at.toISOString())
     c. Insert certificates row
     d. Return { passed: true, certHash, certNumber, score }
   - On fail: return { passed: false, score, nextAttemptAvailable } + set expires_at on cert_attempt (24h from now)

3. Certificate page at /certifications/certificate/[certHash]:
   - Full-page certificate design using the design system
   - AAVA logo, recipient name (gradient text), certification name, tier badge (gold glow), issue date
   - Verification checkmark: "✓ Verified by AAVA Product Studio"
   - "Add to LinkedIn" button using the pre-filled deeplink from CLAUDE.md
   - "Download PDF" button (use browser print CSS for a print-optimized layout — no server-side PDF lib needed)
   - "Share Link" button (copies the certificate URL to clipboard)

4. Public verification page at /verify/[certHash]:
   - Looks up certificate by verification_hash
   - Shows certificate details + "✓ Verified" or "⚠ Invalid" state
   - If revoked: shows revocation notice

5. Open Badges 3.0 JSON-LD endpoint GET /api/badges/[certHash]:
   - Returns the full JSON-LD badge assertion per the spec in CLAUDE.md
   - Content-Type: application/ld+json
   - Cache-Control: public, max-age=3600
   - 404 if cert not found or revoked

Tests required:
- Unit: cert_number generator (correct format, sequential, no duplicates in test)
- Unit: verification_hash generator (deterministic — same inputs → same hash)
- Unit: question stratified sampling (correct distribution across difficulty levels)
- Integration: POST /api/certifications/submit — mock OpenRouter, verify certificate row created on pass, verify attempt limit enforcement (4th attempt → 429), verify cooldown expires_at is set
- Integration: GET /api/badges/[certHash] — valid hash returns JSON-LD with correct Content-Type; invalid hash returns 404
- E2E: complete an exam (mock OpenRouter), verify certificate page renders with correct data, click "Add to LinkedIn" and verify the URL contains the correct pre-filled params, visit /verify/[certHash] and confirm "Verified" state
```

---

## PHASE 7 — Public Docs Site

### 7.1 — Docusaurus Public Docs

```
/project:build-feature public-docs-site

Build the public-facing Docusaurus documentation site.

1. Scaffold a Docusaurus 3 site at /docs-site (separate from the Next.js app):
   - TypeScript configuration
   - Apply AAVA brand colors to the Docusaurus custom CSS (as close to the design tokens as Docusaurus allows — it uses its own CSS variable system)
   - Dark mode as default, light mode available

2. Create the full nav structure with _category_.json files:
   /docs-site/docs/
   ├── intro.md                          ← "Welcome to AAVA" landing page
   ├── getting-started/
   │   ├── _category_.json               ← label: "Getting Started", position: 1
   │   ├── what-is-aava.md
   │   ├── how-to-use-this-site.md
   │   └── certification-overview.md
   ├── methodology/
   │   ├── _category_.json               ← label: "AAVA Methodology", position: 2
   │   ├── goals-and-okrs/
   │   │   ├── _category_.json
   │   │   └── [one .md per flow from the agentic_flows spreadsheet in this category]
   │   ├── research/
   │   ├── ideation/
   │   ├── roadmapping/
   │   └── [one sub-section per lifecycle stage from the spreadsheet]
   └── certifications/
       ├── _category_.json               ← label: "Certifications", position: 3
       ├── overview.md
       └── [one .md per certification tier]

3. Generate stub .md files for every flow from the AAVA spreadsheet (the source file is agentic_flows_pm_acceleration.xlsx — read it and create one doc page per flow with: title = Flow Name, sections: Overview, Inputs, Process, Outputs, populated from the spreadsheet data).

4. Create the reusable Embed component at /docs-site/src/components/Embed.tsx per the CLAUDE.md spec, and document its usage in a "How to add embeds" guide.

5. The docs site deploys separately to Vercel (second Vercel project). Configure vercel.json for the docs subdirectory.

6. Link the public docs site from the main app: /docs in the main nav links to docs.aava.ai (or /docs subdomain).

Tests required:
- E2E (Playwright, separate playwright config pointing at the docs site): all top-level nav sections render without 404, the intro page loads, search returns results for "goal extraction", the Embed component renders an iframe when src is provided
```

---

## PHASE 8 — Polish + Production Readiness

### 8.1 — Rate Limiting + Security Hardening

```
/project:build-feature rate-limiting-and-security

Add rate limiting and security hardening to all sensitive routes.

1. Install Upstash Redis client: npm install @upstash/ratelimit @upstash/redis
   Add env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

2. Apply rate limiting to:
   - POST /api/quiz/submit: 10 submissions per user per hour
   - POST /api/certifications/submit: 5 submissions per user per day
   - POST /api/admin/generate/course: 20 generations per admin per day
   - POST /api/admin/generate/lesson: 50 generations per admin per day
   - /api/auth routes (login, signup): 10 attempts per IP per 15 minutes

3. Confirm all API routes validate the authenticated session explicitly (do not rely solely on RLS)

4. Add Content-Security-Policy headers for embed iframes — allow only the listed embed domains (YouTube, Vimeo, Loom, Figma, Google)

5. Confirm OPENROUTER_API_KEY and BUNNY_* variables are never exposed client-side (grep for NEXT_PUBLIC_ prefix and confirm none of the sensitive keys use it)

Tests required:
- Integration: hit the quiz submit endpoint 11 times with the same user, verify the 11th returns 429
- Integration: hit the cert submit endpoint 6 times, verify 6th returns 429
- Unit: confirm no sensitive env vars have NEXT_PUBLIC_ prefix (this can be a lint rule or simple test)
```

---

### 8.2 — Admin Analytics Dashboard

```
/project:build-feature admin-analytics-dashboard

Build the admin analytics home dashboard.

1. /admin page (the admin home):
   Stat cards row:
   - Total users (by role breakdown: employees / sales / public)
   - Active this month (users with any lesson_progress or quiz_attempt in last 30 days)
   - Courses published
   - Certifications issued (total + this month)

2. Course performance table:
   - Columns: Course | Enrolled | Completed | Pass Rate | Avg Score
   - Sorted by enrollment count descending

3. Most missed questions section:
   - Top 10 questions by incorrect answer rate (across all attempts, all users)
   - Shows: question text (truncated), course, quiz, % incorrect

4. Recent certifications issued:
   - Last 20 certificates: recipient name, certification name, issue date, score

5. All data fetched server-side via Supabase aggregate queries. No client-side data fetching on this page.

6. Export buttons:
   - "Export Users CSV" → downloads profiles + enrollment summary
   - "Export Completions CSV" → downloads all course_enrollment rows with user + course data

Tests required:
- Integration: verify each analytics query returns correctly shaped data; verify non-admin gets 403
- E2E: visit /admin, verify all four stat cards render with numeric values, verify the course performance table has at least the seeded test course, click Export Users CSV and verify a download is triggered
```

---

## PHASE 9 — Knowledge (Support Docs)

### 9.1 — Knowledge Base (Scoped Support Docs)

```
/project:build-feature knowledge-support-docs

Build the Knowledge zone — scoped support documentation browseable by all users based on their access level.

1. Schema changes:
   - Add visibility column to docs_pages: text not null default 'internal' ('public' | 'internal' | 'group:[name]')
   - Create user_groups table (user_id, group_name, added_by, added_at)
   - Add tsvector search column to docs_pages with GIN index (see CLAUDE.md Knowledge section)
   - Write and apply the migration in supabase/migrations/
   - Update RLS policies on docs_pages for the three visibility levels + group join check

2. /knowledge route (authenticated — employees and above):
   - Left sidebar: nested collapsible nav tree built from docs_pages parent_id hierarchy
     * Uses the recursive CTE query from CLAUDE.md
     * Sections are collapsible, active page highlighted
     * Visibility-filtered: user only sees pages they have access to
   - Main content area: renders the selected page using LessonViewer (Tiptap read-only, reuse existing component)
   - Page header: title, last updated date, breadcrumb trail
   - /knowledge with no page selected: shows a home page (featured sections, recently updated pages)

3. /knowledge/[...slug] nested routing:
   - Supports arbitrary nesting depth via catch-all route
   - 404 for pages that don't exist or that the user doesn't have visibility access to

4. Admin CMS at /admin/knowledge:
   - Page tree with drag-to-reorder and drag-to-nest (reparent pages)
   - Each row: title, visibility badge, status badge, Edit / Delete
   - "New Page" button — creates a child of the currently selected parent, or a root page
   - Page editor: title, slug, visibility dropdown, parent selector, block editor (same BlockEditor.tsx component)
   - Same draft/published workflow as courses

5. Group management in /admin/users:
   - Add a "Groups" column to the user table
   - Click a user → ability to add/remove group memberships (type in group name or select from existing groups)
   - Group names are free-form text (e.g. 'sales', 'leadership', 'engineering')
   - Show all current groups as removable tags

6. Global search (/search or top nav search bar):
   - Searches across: knowledge pages, lessons, courses, docs_pages (public docs), cert tracks
   - Uses Postgres tsvector full-text search on each table
   - Results grouped by content type with type badges
   - Access-filtered: each content type query pre-filters by the user's visibility/role/groups
   - Search results link directly to the content page
   - No AI, no embeddings — pure Postgres full-text search

7. Navigation update:
   - Add "Knowledge" link to the main app nav for all authenticated users
   - Public users (/certifications) do not see the Knowledge nav item
   - Knowledge pages with visibility='public' are accessible without login at /knowledge/[slug] — redirect to login for internal pages if not authenticated

Tests required:
- Unit: recursive nav tree builder (flat rows with parent_id → nested tree structure)
- Unit: visibility filter logic (public / internal / group)
- Integration: GET /api/knowledge/nav — returns only pages the requesting user can see; test all three visibility levels with appropriate roles; test group:[name] pages only appear for group members
- Integration: GET /api/knowledge/[slug] — 404 for pages outside user's visibility, 200 for accessible pages
- Integration: POST /api/admin/knowledge — non-admin gets 403; admin can create/update/delete
- Integration: global search — employee sees internal + public results but not group:sales content; sales employee sees group:sales content
- E2E: browse /knowledge as employee, verify sidebar nav renders with sections, click a page, verify content renders; visit a group:sales page as non-sales employee, verify 404; admin creates a new knowledge page, sets visibility to group:sales, verify it appears for sales user and not for standard employee
```

---

## PHASE 10 — Landing Page

### 10.1 — Throughput Landing Page

```
/project:build-feature landing-page

Build the Throughput public landing page at /.

The landing page serves the public certification audience primarily. Internal employees are onboarded via invite — they don't need to be sold. Design must match the dark, electric-cyan design system from CLAUDE.md exactly.

Sections in order:

1. HERO (full viewport height)
   - Headline: "PM mastery, verified." — large, gradient text (bg-gradient-brand bg-clip-text)
   - Subhead: one sentence explaining what Throughput is
   - Two CTAs side by side:
     * Primary: "Get Certified" → /certifications (bg-accent with shadow-accent-glow)
     * Secondary: "Explore the Methodology" → /docs (ghost button)
   - Background: animated SVG — slowly drifting nodes connected by lines in accent color at low opacity (CSS animation only, no JS library, keep it subtle)

2. TRUST STRIP (below hero, full width, subtle border top/bottom)
   - "Built on the AAVA Product Methodology"
   - AAVA logo
   - Stat pills: "X agentic flows", "Y certification tracks", "Z practitioners certified" (pull real counts from DB at build time via generateStaticParams or ISR — fall back to hardcoded values until data exists)

3. WHAT YOU LEARN (3-column card grid)
   One card per certification tier:
   - AAVA Foundations — Silver badge icon, 3 bullet points of what's covered, "Free · ~4 hours" label, "Start for free →" link
   - AAVA Practitioner — Cyan badge icon (accent glow), same structure
   - AAVA Specialist — Gold badge icon (gold glow), "Requires Practitioner" prerequisite note
   Cards use bg-surface border-border rounded-xl shadow-card

4. HOW IT WORKS (3-step horizontal flow)
   Step 1: Study — "Free methodology content. No login required." Icon: book
   Step 2: Examine — "Timed proctored exam. Open-ended questions graded by AI." Icon: clipboard-check
   Step 3: Certify — "Shareable certificate. LinkedIn badge. Verified URL." Icon: badge-check
   Connected by a subtle horizontal line between steps (desktop) / vertical on mobile

5. METHODOLOGY PREVIEW
   - Section headline: "The AAVA PM Methodology"
   - Subhead: one sentence
   - Scrollable horizontal card strip showing 6 lifecycle stages (Goals, Research, Ideation, Roadmapping, Sprint Planning, Development) — each card has the stage name, icon, and flow count
   - CTA: "Explore all X flows →" → /docs

6. FOR TEAMS
   - Two-column layout (text left, visual right)
   - Headline: "Training your PM team?"
   - Body: 2–3 sentences about internal training + sales enablement zones
   - Bullet points: course completion tracking, role-based access, sales enablement materials, AI-graded assessments
   - CTA: "Request access" → a simple mailto: or /contact link (no form needed yet)
   - Right side: a simple dark card mockup showing a course progress UI (static, not real UI — just illustrative)

7. FOOTER
   - Left: Throughput logo + "A product of AAVA" with aava.ai link
   - Center nav links: Certifications, Methodology, Knowledge, Login
   - Right: LinkedIn icon link, copyright

Implementation notes:
- This page is fully static (no auth required, no Supabase calls at render time except the trust strip stat counts via ISR with revalidate: 3600)
- Mobile responsive — all sections stack cleanly on mobile
- No layout.tsx wrapper from (app) route group — this page has its own minimal layout with just the landing nav (logo + "Login" + "Get Certified" button)
- The animated SVG background in the hero must not cause CLS — use a fixed viewBox and CSS animation only

Tests required:
- E2E: landing page loads with 200 status, all 7 sections render, "Get Certified" button navigates to /certifications, "Explore the Methodology" navigates to /docs, "Login" navigates to /login, page is mobile-responsive (test at 375px viewport)
```
