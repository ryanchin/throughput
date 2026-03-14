# Feature: Interactive Course Elements

**Status:** Draft
**Zone:** training + sales (learner-facing) + admin (authoring)
**Last Updated:** 2026-03-13

## Overview

Three interactive content types that make courses more engaging beyond text, video, and traditional quizzes. Each element is embeddable inside lesson content via the Tiptap block editor and follows existing patterns for admin authoring, learner consumption, grading, and progress tracking.

1. **Scenario Simulations** -- branching decision trees that present realistic PM scenarios with choices, consequences, and debriefs
2. **Drag-to-Rank / Drag-to-Match Exercises** -- interactive drag-and-drop activities for prioritization and concept matching
3. **Pre-Test / Post-Test with Knowledge Delta** -- diagnostic assessments before and after a course that measure learning gain

All three features exist because the platform currently relies on passive content (read/watch) plus end-of-lesson quizzes. These elements add active learning within lessons, which research consistently shows improves retention and engagement.

**Source** -- Clark & Mayer, "e-Learning and the Science of Instruction": interactive practice with feedback improves transfer by 20-40% over passive content.

---

## Feature 1: Scenario Simulations

### Overview

Scenario simulations present learners with a realistic product management situation and a series of branching choices. Each choice leads to a consequence (what happens as a result), then the learner either continues to another decision point or reaches a terminal node with a debrief. Admins build scenarios using a visual branching editor in the lesson page. Scenarios can be graded (optimal path earns full points) or ungraded (purely educational).

**Who it is for:** All learners (employee, sales). Admins author scenarios.

**Why it exists:** PM work is inherently about decisions under uncertainty. Text and quizzes test recall; scenarios test judgment. They also make courses feel less like documentation and more like practice.

### Business Logic

**Scenario structure:**
- A scenario is a directed acyclic graph (DAG) stored as JSON
- Each node is either a `decision` node (presents a situation + choices) or a `terminal` node (shows outcome + debrief)
- Each choice on a decision node leads to exactly one other node
- One node is marked as the `root` (entry point)
- At least one path must exist from root to a terminal node
- Maximum depth: 10 levels (prevents runaway branching)
- Maximum nodes per scenario: 50 (keeps authoring and rendering manageable)

**Grading rules:**
- Each scenario has an `is_graded` flag (default: false)
- If graded: each terminal node has a `score` (0-100). The optimal path terminal has score=100. Suboptimal terminals have lower scores set by the admin.
- Points earned = `(terminal_score / 100) * max_points`
- `max_points` is set per scenario block (default: 10, same pattern as quiz questions)
- Ungraded scenarios award no points and are not factored into course completion score

**Learner flow:**
1. Learner encounters the scenario block in the lesson content
2. Sees the root node: situation text + choice buttons
3. Clicks a choice -- sees the consequence text, then the next decision node (or terminal)
4. At a terminal node: sees outcome text, debrief explanation, and (if graded) the score they earned
5. Learner can replay the scenario to explore other paths (no penalty, best score kept)
6. The path taken is recorded for analytics

**Admin authoring flow:**
1. Admin inserts a `/scenario` block via the slash menu in the block editor
2. A visual branching builder opens in a modal or side panel
3. Admin creates the root node with situation text and choices
4. For each choice, admin creates the next node (decision or terminal)
5. Admin can mark one terminal as the "optimal outcome" (auto-sets score=100)
6. Admin sets `is_graded` toggle and `max_points`
7. Validation on save: at least one path from root to terminal; no orphan nodes; no cycles

**Edge cases:**
- Learner refreshes mid-scenario: resume from last visited node (path stored in component state, not DB, until terminal reached)
- Learner replays a graded scenario: best score across all completions is kept
- Admin deletes a node that has children: cascade delete all descendants with confirmation dialog
- Empty scenario (no nodes): block shows "No scenario configured" placeholder in learner view; not counted for grading

**Permissions:**
- Only admins can create/edit/delete scenario content
- All authenticated learners with course access can interact with scenarios
- Scenario responses are scoped to user_id via RLS

### Technical Details

**Database schema:**

```sql
-- Scenario simulation responses (tracks learner paths and scores)
create table public.scenario_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  scenario_block_id text not null,            -- Tiptap node ID within lesson content
  path_taken jsonb not null,                  -- Array of node IDs in order visited
  terminal_node_id text not null,             -- Which terminal node was reached
  score numeric(5,2),                         -- null if ungraded
  max_points integer,                         -- null if ungraded
  completed_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.scenario_responses enable row level security;

create policy "Users can view own scenario responses" on public.scenario_responses
  for select using (user_id = auth.uid());

create policy "Users can create own scenario responses" on public.scenario_responses
  for insert with check (user_id = auth.uid());

create policy "Admins can manage scenario responses" on public.scenario_responses
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Index for looking up best score per scenario
create index idx_scenario_responses_lookup
  on public.scenario_responses(user_id, lesson_id, scenario_block_id);
```

**Tiptap node extension:**

```typescript
// src/components/editor/extensions/ScenarioNode.ts
// Custom Tiptap Node: ScenarioBlock
// Stores:
// {
//   type: 'scenarioBlock',
//   attrs: {
//     blockId: string,          // Unique ID for this block instance
//     title: string,
//     isGraded: boolean,
//     maxPoints: number,
//     scenario: {               // The decision tree
//       rootNodeId: string,
//       nodes: {
//         [nodeId: string]: {
//           id: string,
//           type: 'decision' | 'terminal',
//           situationText: string,       // Markdown-supported rich text
//           consequenceText?: string,     // Shown after choice is made (decision nodes)
//           choices?: Array<{
//             id: string,
//             text: string,
//             nextNodeId: string
//           }>,
//           outcomeText?: string,         // Terminal only
//           debriefText?: string,         // Terminal only
//           score?: number                // Terminal only, 0-100
//         }
//       }
//     }
//   }
// }
```

**API endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/training/scenarios/respond` | Record a learner's scenario completion (path + score) |
| GET | `/api/training/scenarios/responses?lessonId=X` | Get learner's responses for a lesson's scenarios |
| GET | `/api/admin/analytics/scenarios?courseId=X` | Admin: path analytics for scenarios in a course |

**Key components:**

| Component | Path | Purpose |
|-----------|------|---------|
| `ScenarioNode.ts` | `src/components/editor/extensions/` | Tiptap node extension |
| `ScenarioBuilder.tsx` | `src/components/editor/` | Admin visual tree editor (modal) |
| `ScenarioPlayer.tsx` | `src/components/training/` | Learner-facing scenario interaction |
| `ScenarioNodeEditor.tsx` | `src/components/editor/` | Individual node edit form within builder |

**Scenario builder UI approach:**
- Use a tree layout rendered with SVG lines connecting nodes (no external graph library needed for a simple DAG)
- Each node is a card with edit-in-place text fields
- "Add Choice" button on decision nodes creates a new child node
- Drag to rearrange choice order within a node
- Color-coded: decision nodes = cyan border, terminal nodes = green/red border based on score

---

## Feature 2: Drag-to-Rank / Drag-to-Match Exercises

### Overview

Interactive drag-and-drop exercises embedded in lesson content. Two variants:

- **Rank**: learner drags items into the correct priority order (e.g., "Rank these backlog items by business value")
- **Match**: learner drags items to match terms with definitions, or concepts with categories (e.g., "Match each AAVA artifact to its purpose")

Auto-graded with partial credit. Uses the existing dnd-kit library (already in the project for quiz question reordering).

**Who it is for:** All learners. Admins author exercises.

**Why it exists:** Ranking and categorization are core PM skills. These exercises test understanding at a deeper level than multiple-choice (which allows guessing) and provide immediate tactile feedback.

### Business Logic

**Rank exercise rules:**
- Admin defines an ordered list of items (the correct order)
- Learner sees the items in a randomized order and drags them into their chosen order
- Scoring: Kendall tau distance or simple positional scoring
  - Positional scoring (simpler, used here): each item in the correct position = `max_points / item_count` points
  - Example: 5 items, 3 in correct position = 60% = 6/10 points
- Minimum 2 items, maximum 12 items
- Each item has a `label` (short text) and optional `description` (tooltip/detail text)

**Match exercise rules:**
- Admin defines pairs: `{ term: string, match: string }`
- Learner sees terms on the left (fixed) and matches on the right (draggable/shuffled)
- Learner drags each match to its corresponding term
- Scoring: each correct pair = `max_points / pair_count` points
- Minimum 2 pairs, maximum 12 pairs
- Each term and match has a short label (max 200 characters)

**Shared rules:**
- `max_points` per exercise block (default: 10)
- Always graded (no ungraded mode -- if admin wants ungraded, set max_points=0)
- Learner can retry unlimited times; best score is kept
- Items are randomized per attempt (shuffled order for rank, shuffled matches for match)
- On submit: show correct answer overlay with green/red indicators per item
- Responses are recorded for analytics

**Admin authoring flow:**
1. Admin inserts `/rank` or `/match` block via slash menu
2. Inline editor appears within the block:
   - Rank: ordered list of items with "Add Item" button, drag to set correct order
   - Match: two-column list of term-match pairs with "Add Pair" button
3. Admin sets `max_points` and optional `instructions` text
4. Preview mode shows the learner view with items shuffled

**Edge cases:**
- Learner submits without moving any items: scored as-is (likely low score)
- Two items in a rank exercise: only two possible orderings, acceptable
- Admin reorders items after learners have already responded: existing responses retain their original score (recalculation not retroactive)

### Technical Details

**Database schema:**

```sql
-- Drag exercise responses (rank and match)
create table public.drag_exercise_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  exercise_block_id text not null,            -- Tiptap node ID
  exercise_type text not null check (exercise_type in ('rank', 'match')),
  submitted_answer jsonb not null,            -- Learner's arrangement
  correct_answer jsonb not null,              -- Snapshot of correct answer at submission time
  score numeric(5,2) not null,
  max_points integer not null,
  completed_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.drag_exercise_responses enable row level security;

create policy "Users can view own drag responses" on public.drag_exercise_responses
  for select using (user_id = auth.uid());

create policy "Users can create own drag responses" on public.drag_exercise_responses
  for insert with check (user_id = auth.uid());

create policy "Admins can manage drag responses" on public.drag_exercise_responses
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create index idx_drag_exercise_responses_lookup
  on public.drag_exercise_responses(user_id, lesson_id, exercise_block_id);
```

**Tiptap node extensions:**

```typescript
// src/components/editor/extensions/RankNode.ts
// {
//   type: 'rankBlock',
//   attrs: {
//     blockId: string,
//     instructions: string,
//     maxPoints: number,
//     items: Array<{
//       id: string,
//       label: string,
//       description?: string
//     }>  // Stored in correct order; shuffled on render for learner
//   }
// }

// src/components/editor/extensions/MatchNode.ts
// {
//   type: 'matchBlock',
//   attrs: {
//     blockId: string,
//     instructions: string,
//     maxPoints: number,
//     pairs: Array<{
//       id: string,
//       term: string,
//       match: string
//     }>  // Matches shuffled on render for learner
//   }
// }
```

**API endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/training/exercises/respond` | Record a learner's exercise response (auto-graded server-side) |
| GET | `/api/training/exercises/responses?lessonId=X` | Get learner's responses for a lesson's exercises |

**Key components:**

| Component | Path | Purpose |
|-----------|------|---------|
| `RankNode.ts` | `src/components/editor/extensions/` | Tiptap node extension |
| `MatchNode.ts` | `src/components/editor/extensions/` | Tiptap node extension |
| `RankEditor.tsx` | `src/components/editor/` | Admin inline rank item editor |
| `MatchEditor.tsx` | `src/components/editor/` | Admin inline match pair editor |
| `RankExercise.tsx` | `src/components/training/` | Learner drag-to-rank interaction |
| `MatchExercise.tsx` | `src/components/training/` | Learner drag-to-match interaction |
| `exerciseGrader.ts` | `src/lib/training/` | Pure function: grade rank/match submissions |

**Grading logic (pure functions in `lib/training/exerciseGrader.ts`):**

```typescript
// Rank: positional scoring
function gradeRank(submitted: string[], correct: string[], maxPoints: number): number {
  let correctCount = 0;
  for (let i = 0; i < correct.length; i++) {
    if (submitted[i] === correct[i]) correctCount++;
  }
  return (correctCount / correct.length) * maxPoints;
}

// Match: pair scoring
function gradeMatch(
  submitted: Record<string, string>,  // termId -> matchId
  correct: Record<string, string>,
  maxPoints: number
): number {
  let correctCount = 0;
  for (const [termId, matchId] of Object.entries(correct)) {
    if (submitted[termId] === matchId) correctCount++;
  }
  return (correctCount / Object.keys(correct).length) * maxPoints;
}
```

**Grading happens server-side** in the API route to prevent answer leakage. The correct answer is never sent to the client before submission. The client sends the learner's arrangement; the server looks up the correct answer from the lesson content JSON, grades, stores the response, and returns the result.

---

## Feature 3: Pre-Test / Post-Test with Knowledge Delta

### Overview

A diagnostic assessment framework that measures learning gain per course. Before starting a course, the learner is prompted to take a short pre-test. After completing the course, they take the same or equivalent post-test. The system calculates and displays the knowledge delta ("You improved from 45% to 92%").

**Who it is for:** All learners. Admins configure pre/post tests per course.

**Why it exists:** Learning gain is the most meaningful metric for training effectiveness. Without it, a 90% post-test score is ambiguous -- did the learner already know the material, or did the course teach them? The delta answers this definitively and gives admins data to improve courses.

### Business Logic

**Pre-test / post-test relationship:**
- Each course can have zero or one pre-test and zero or one post-test
- Pre-test and post-test are quizzes with `quiz_type` set to `'pre_test'` or `'post_test'`
- They use the existing `quizzes` and `questions` tables with a new `quiz_type` column
- Pre-test and post-test should cover the same knowledge areas (admin responsibility to align content)
- Pre-test and post-test can be the same quiz (same questions) or different quizzes (equivalent difficulty)

**Learner flow:**
1. Learner enrolls in a course
2. On first visit to the course page (before any lesson), a prompt appears: "Take a quick diagnostic to measure your starting knowledge" with "Take Pre-Test" and "Skip" buttons
3. If taken: learner completes the pre-test quiz (same quiz UI as lesson quizzes)
4. Pre-test score is recorded but does NOT count toward course completion or final score
5. Learner proceeds through the course normally
6. After completing all lessons and lesson quizzes, the post-test becomes available
7. Learner takes the post-test (same quiz UI)
8. Post-test score IS factored into the course completion score (weighted equally with lesson quizzes)
9. On the course scorecard page, the knowledge delta is displayed

**Scoring and delta calculation:**
- Pre-test score: percentage (0-100)
- Post-test score: percentage (0-100)
- Knowledge delta: `post_test_score - pre_test_score`
- Delta is shown as: absolute improvement ("You improved by 47 points"), percentage display ("45% -> 92%"), and a visual bar chart
- If pre-test was skipped: delta section shows "Pre-test not taken" with a note that baseline data is unavailable
- Pre-test does not affect pass/fail. Post-test is treated like any other quiz for scoring.

**Admin configuration:**
- In the course editor, a new "Assessments" tab alongside "Lessons" and "Settings"
- Admin creates a pre-test quiz and/or post-test quiz from this tab
- Same quiz builder UI as lesson quizzes (question types, points, etc.)
- Admin can optionally mark the pre-test and post-test as "linked" (same question pool, randomized per attempt)

**Attempt rules:**
- Pre-test: exactly 1 attempt (no retakes -- it measures baseline knowledge)
- Post-test: follows course `max_attempts` setting (same as lesson quizzes)
- Pre-test has no time limit by default (admin can set one)
- Post-test follows the same rules as lesson quizzes

**Edge cases:**
- Learner skips pre-test, completes course: scorecard shows post-test results but no delta visualization
- Learner takes pre-test, drops out, re-enrolls: pre-test score is retained (not reset)
- Course has no pre-test or post-test configured: feature is invisible to learners
- Pre-test score higher than post-test: delta is negative, shown honestly (no hiding poor results)
- Admin adds a pre-test to a course after learners have already enrolled: existing learners see the pre-test prompt on their next visit (if they have not started any lessons yet); learners who have already started lessons skip the pre-test

### Technical Details

**Database schema:**

```sql
-- Add quiz_type column to quizzes table
alter table public.quizzes
  add column quiz_type text not null default 'lesson'
  check (quiz_type in ('lesson', 'pre_test', 'post_test'));

-- Add course_id to quizzes for course-level quizzes (pre/post test)
-- Lesson quizzes use lesson_id; course-level quizzes use course_id
alter table public.quizzes
  add column course_id uuid references public.courses(id) on delete cascade;

-- Allow lesson_id to be nullable (course-level quizzes don't belong to a lesson)
alter table public.quizzes
  alter column lesson_id drop not null;

-- Constraint: either lesson_id or course_id must be set, not both
alter table public.quizzes
  add constraint quizzes_scope_check
  check (
    (lesson_id is not null and course_id is null and quiz_type = 'lesson')
    or
    (lesson_id is null and course_id is not null and quiz_type in ('pre_test', 'post_test'))
  );

-- Only one pre-test and one post-test per course
create unique index idx_quizzes_course_pretest
  on public.quizzes(course_id) where quiz_type = 'pre_test';
create unique index idx_quizzes_course_posttest
  on public.quizzes(course_id) where quiz_type = 'post_test';

-- Pre-test skip tracking (stored on enrollment)
alter table public.course_enrollments
  add column pre_test_skipped boolean default false;
alter table public.course_enrollments
  add column pre_test_completed_at timestamptz;
alter table public.course_enrollments
  add column post_test_completed_at timestamptz;

-- Update RLS for course-level quizzes
create policy "Course quizzes visible to enrolled users" on public.quizzes
  for select using (
    course_id is not null and exists (
      select 1 from public.courses c
      where c.id = course_id and c.status = 'published'
    )
  );
```

**API endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/training/courses/[slug]/assessments` | Get pre-test/post-test status for a course |
| POST | `/api/training/courses/[slug]/assessments/skip-pretest` | Mark pre-test as skipped |
| GET | `/api/training/courses/[slug]/delta` | Get knowledge delta data for scorecard |
| POST | `/api/admin/courses/[courseId]/assessments` | Create/update pre-test or post-test quiz |
| GET | `/api/admin/analytics/knowledge-delta?courseId=X` | Admin: aggregate delta stats across learners |

**Key components:**

| Component | Path | Purpose |
|-----------|------|---------|
| `PreTestPrompt.tsx` | `src/components/training/` | "Take diagnostic" prompt shown before first lesson |
| `KnowledgeDelta.tsx` | `src/components/training/` | Delta visualization on scorecard (bar chart + numbers) |
| `AssessmentTab.tsx` | `src/components/admin/` | Admin tab in course editor for pre/post test config |
| `deltaCalculator.ts` | `src/lib/training/` | Pure function: calculate knowledge delta from scores |

**Delta visualization design:**
- Two horizontal bars side by side: pre-test (muted color) and post-test (accent color)
- Large delta number in the center: "+47 points" in green (or red if negative)
- Below: "45% -> 92%" with an arrow
- Uses CSS transitions for animated fill on page load
- If pre-test was skipped: show a single bar for post-test with a note

**Integration with existing scorecard:**
- The `CourseScorecard` component gains a new `KnowledgeDelta` section
- `buildQuizBreakdown()` in `lib/training/completion.ts` is updated to include pre/post test data
- Post-test is included in the final score calculation; pre-test is excluded
- The results API (`GET /api/training/courses/[slug]/results`) returns delta data alongside existing scorecard data

---

## Non-Functional Requirements

### Performance
- Scenario tree rendering: must handle 50 nodes without jank (< 16ms frame time)
- Drag-and-drop: must remain smooth with 12 items on mobile Safari (test with touch events)
- Delta visualization: animated bar fill completes in < 500ms
- All new API routes respond in < 200ms at p95 (no LLM calls in these paths)

### Scale
- Scenario JSON stored inline in lesson content (Tiptap JSON column); no separate table for tree structure. Max scenario JSON size: ~50KB (well within Postgres jsonb limits)
- Exercise responses table will grow linearly with learner count. Index on `(user_id, lesson_id, exercise_block_id)` keeps lookups O(1)
- Pre/post test uses existing quiz infrastructure; no new scale concerns

### Security and Privacy
- Exercise correct answers are never sent to the client before submission
- Scenario optimal paths are not revealed until the learner reaches a terminal node
- All response tables use RLS: users see only their own data, admins see all
- Grading for rank/match exercises happens server-side only
- Pre-test scores are private to the learner (admins can see aggregate deltas, not individual pre-test answers without explicit admin RLS policy)

### Observability
- Log scenario completion events with path length and score for analytics
- Log exercise grading results (score, time to complete) for content quality monitoring
- Track pre-test skip rate per course (high skip rate may indicate UX friction)

### Accessibility
- Drag-and-drop exercises must support keyboard reordering (arrow keys + Enter to pick up/drop)
- Scenario choices must be keyboard-navigable (Tab + Enter)
- All interactive elements must have proper ARIA labels
- Color is never the sole indicator of correctness (use icons and text alongside green/red)

---

## Scope

### In Scope
- Scenario simulation Tiptap block with visual builder and learner player
- Rank and match Tiptap blocks with dnd-kit interaction and server-side grading
- Pre-test / post-test quiz type with knowledge delta visualization
- Response tracking and best-score retention for all three features
- Admin analytics for scenario paths and knowledge deltas
- Integration with existing course scorecard
- Full test coverage (unit, integration, E2E)

### Out of Scope
- AI-generated scenarios (manual authoring only for v1)
- Scenario branching based on learner profile/role (same tree for everyone)
- Adaptive pre-test difficulty (static question set for v1)
- Gamification (points, leaderboards, badges for exercises)
- Collaborative/multiplayer scenarios
- Offline support for drag exercises
- Question bank / question reuse across pre-tests (each course has its own)

---

## Rollout Plan

### Phase 1: Drag-to-Rank / Drag-to-Match (1.5 weeks)
- Lowest risk, self-contained, builds on existing dnd-kit usage
- Ship behind feature flag: `interactive_exercises`
- Kill switch: disable the Tiptap node extensions (exercises render as static text fallback)
- Rollback: remove exercise blocks from lesson content via admin; responses table can be dropped cleanly

### Phase 2: Scenario Simulations (2 weeks)
- More complex authoring UI; ship to admin-only first for content creation
- Ship behind feature flag: `scenario_simulations`
- Kill switch: scenario blocks render as static text (situation + choices listed, no interactivity)
- Rollback: same as Phase 1

### Phase 3: Pre-Test / Post-Test (1.5 weeks)
- Touches existing quiz infrastructure; requires careful migration
- Ship behind feature flag: `pretest_posttest`
- Kill switch: pre-test prompt hidden; post-test treated as regular quiz
- Rollback: revert `quiz_type` column to all 'lesson'; drop enrollment columns

### Guardrails
- Monitor error rates on new API routes for 48 hours after each phase launch
- If exercise grading accuracy < 95% in manual spot checks, pause and investigate
- If pre-test skip rate > 80%, revisit UX prompt design before expanding rollout

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Scenario builder UX too complex for admins | Medium | High | Start with a simple linear branching UI (max 3 choices per node). Expand to full DAG later based on feedback. |
| Drag exercises broken on mobile/touch | Medium | Medium | Test with iOS Safari and Android Chrome early. dnd-kit has touch sensor support but needs testing. |
| Quiz schema migration breaks existing quizzes | Low | High | Migration makes `lesson_id` nullable with a constraint ensuring existing rows are unaffected. Test migration on staging DB snapshot first. |
| Scenario JSON bloats lesson content | Low | Low | 50-node max cap + JSON size validation in the API route. |
| Pre-test adds friction, reduces enrollment | Medium | Medium | Pre-test is optional with a clear "Skip" button. Track skip rate and adjust prompt copy. |
| Correct answers for rank/match leaked via client inspection | Low | High | Correct answers are never sent to client. Grading is server-side. Client sends submission, server responds with result. |

---

## Open Questions

1. **Should scenario scores contribute to course completion?** Current proposal: graded scenarios contribute to final score alongside quizzes. Alternative: scenarios are formative only and never affect pass/fail. Needs product owner decision.
2. **Should pre-test questions be drawn from the post-test pool (identical questions) or separate?** Identical questions give cleaner delta measurement but risk learners memorizing answers. Separate questions require admin to maintain two aligned question sets.
3. **Should we support "guided replay" for scenarios?** After completing a scenario, show the optimal path with explanations. This adds development time but significantly increases learning value.
4. **Match exercise: should we support one-to-many matching?** (One term maps to multiple matches, e.g., categorization.) v1 proposal is 1:1 only. One-to-many adds complexity.

---

## Task Checklist

### Phase 1: Drag-to-Rank / Drag-to-Match Exercises

**Backend:**
- [ ] Create migration: `drag_exercise_responses` table with RLS policies
- [ ] Build `POST /api/training/exercises/respond` route (server-side grading)
- [ ] Build `GET /api/training/exercises/responses` route (learner's responses per lesson)
- [ ] Implement `gradeRank()` and `gradeMatch()` in `lib/training/exerciseGrader.ts`
- [ ] Add Zod validation schemas for exercise submissions

**Frontend - Admin:**
- [ ] Create `RankNode.ts` Tiptap extension
- [ ] Create `MatchNode.ts` Tiptap extension
- [ ] Register `/rank` and `/match` in SlashMenu
- [ ] Build `RankEditor.tsx` inline editor (add/remove/reorder items)
- [ ] Build `MatchEditor.tsx` inline editor (add/remove pairs)
- [ ] Add max_points and instructions fields to both editors

**Frontend - Learner:**
- [ ] Build `RankExercise.tsx` with dnd-kit sortable list
- [ ] Build `MatchExercise.tsx` with dnd-kit draggable matches
- [ ] Add keyboard accessibility (arrow keys for reorder)
- [ ] Build results overlay (correct/incorrect indicators per item)
- [ ] Handle retry flow (re-shuffle, submit again, keep best score)

**Tests:**
- [ ] Unit tests for `gradeRank()` and `gradeMatch()` (edge cases: empty, all correct, all wrong, partial)
- [ ] Unit tests for RankExercise and MatchExercise components (rendering, interaction)
- [ ] Integration tests for exercise respond/responses API routes (auth, validation, grading accuracy)
- [ ] E2E tests for full rank and match exercise flows (admin create, learner interact, score display)

### Phase 2: Scenario Simulations

**Backend:**
- [ ] Create migration: `scenario_responses` table with RLS policies
- [ ] Build `POST /api/training/scenarios/respond` route
- [ ] Build `GET /api/training/scenarios/responses` route
- [ ] Build `GET /api/admin/analytics/scenarios` route (path analytics)
- [ ] Implement scenario validation logic (DAG validation, no cycles, no orphans)
- [ ] Implement scenario scoring logic in `lib/training/scenarioGrader.ts`

**Frontend - Admin:**
- [ ] Create `ScenarioNode.ts` Tiptap extension
- [ ] Register `/scenario` in SlashMenu
- [ ] Build `ScenarioBuilder.tsx` modal with visual tree layout
- [ ] Build `ScenarioNodeEditor.tsx` for editing individual nodes
- [ ] Add node type picker (decision vs terminal)
- [ ] Add choice management (add/remove/reorder choices on decision nodes)
- [ ] Add grading configuration (is_graded toggle, terminal scores, max_points)
- [ ] Add validation feedback (highlight orphan nodes, missing paths)
- [ ] Add preview mode (walk through scenario as learner)

**Frontend - Learner:**
- [ ] Build `ScenarioPlayer.tsx` with step-by-step interaction
- [ ] Render situation text, choice buttons, consequence reveals
- [ ] Terminal node: show outcome, debrief, and score (if graded)
- [ ] Add replay button (re-enter from root, keep best score)
- [ ] Animate transitions between nodes

**Tests:**
- [ ] Unit tests for scenario validation (valid DAG, cycles, orphans, depth limit)
- [ ] Unit tests for scenario scoring (optimal path, suboptimal paths, ungraded)
- [ ] Unit tests for ScenarioPlayer component (navigation, state management)
- [ ] Integration tests for scenario respond/responses API routes
- [ ] Integration tests for admin analytics route
- [ ] E2E tests for scenario builder (create tree, add nodes, set scores)
- [ ] E2E tests for scenario player (make choices, reach terminal, view score)

### Phase 3: Pre-Test / Post-Test with Knowledge Delta

**Backend:**
- [ ] Create migration: add `quiz_type` and `course_id` to quizzes, add enrollment columns
- [ ] Update quizzes RLS policies for course-level quizzes
- [ ] Build `GET /api/training/courses/[slug]/assessments` route
- [ ] Build `POST /api/training/courses/[slug]/assessments/skip-pretest` route
- [ ] Build `GET /api/training/courses/[slug]/delta` route
- [ ] Build `POST /api/admin/courses/[courseId]/assessments` route
- [ ] Build `GET /api/admin/analytics/knowledge-delta` route
- [ ] Implement `calculateDelta()` in `lib/training/deltaCalculator.ts`
- [ ] Update `buildQuizBreakdown()` to include post-test, exclude pre-test from final score
- [ ] Update `isCourseDone()` to require post-test completion (if configured)

**Frontend - Admin:**
- [ ] Build `AssessmentTab.tsx` in course editor (pre-test / post-test quiz builders)
- [ ] Add quiz_type selector when creating course-level quizzes
- [ ] Show delta analytics in admin course detail view

**Frontend - Learner:**
- [ ] Build `PreTestPrompt.tsx` component (shown before first lesson)
- [ ] Integrate pre-test prompt into course page layout
- [ ] Handle skip flow (mark enrollment, hide prompt permanently)
- [ ] Build `KnowledgeDelta.tsx` visualization (dual bar chart + delta number)
- [ ] Integrate delta into `CourseScorecard` component
- [ ] Handle "pre-test not taken" state in scorecard

**Tests:**
- [ ] Unit tests for `calculateDelta()` (positive, negative, zero, missing pre-test)
- [ ] Unit tests for updated `buildQuizBreakdown()` and `isCourseDone()`
- [ ] Unit tests for PreTestPrompt and KnowledgeDelta components
- [ ] Integration tests for assessments API routes (create, skip, delta calculation)
- [ ] Integration tests for quiz schema migration (existing quizzes unaffected)
- [ ] E2E tests for pre-test flow (take pre-test, complete course, view delta)
- [ ] E2E tests for skip pre-test flow (skip, complete course, scorecard shows no delta)
- [ ] E2E tests for admin assessment configuration

### Cross-Cutting

- [ ] Update course scorecard to include scenario scores and exercise scores in final calculation
- [ ] Update `lib/training/completion.ts` to factor in graded scenarios and exercises
- [ ] Add feature flags for all three features
- [ ] Update this feature doc as tasks are completed
- [ ] Final integration test: full course with all element types (video, quiz, scenario, rank, match, pre/post test)
