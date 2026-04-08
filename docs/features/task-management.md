# Feature: Task Management System

**Status:** Complete
**Zone:** admin (CRM)
**Last Updated:** 2026-04-07

## Overview

A first-class task management system within the CRM that surfaces the existing task infrastructure (due dates, priorities, statuses, assignees) that was already in the database but had no UI. Gives salespeople and recruiters a "My Tasks" view, overdue detection, assignment workflow, quick-create from any context, auto-task creation on deal stage changes, and AI-suggested follow-ups after logging activities.

## Business Logic

- Tasks are `crm_activities` records where `type = 'task'`. No separate table needed.
- "My Tasks" = tasks where current user is in `crm_action_owners` OR `created_by = current_user`.
- Overdue = tasks where `due_date < today` AND `status != 'Completed'`.
- Due today = tasks where `due_date = today` AND `status != 'Completed'`.
- When a deal moves to certain stages, auto-create follow-up tasks assigned to the user who changed the stage.
- After logging a non-task activity (call, email, meeting, note), AI suggests 2-3 follow-up tasks.
- Tasks can be assigned to any user with admin or sales role.

### Stage-to-Task Mapping

| Stage | Auto-created Task | Due | Priority |
|-------|-------------------|-----|----------|
| 4. Proposal Creation | Send proposal to {company} | +5 days | High (1) |
| 5. Proposal Presentation | Schedule proposal presentation with {company} | +3 days | High (1) |
| 6. Negotiation/ Review | Follow up on negotiation with {company} | +7 days | Normal (2) |
| 7a. Closed Won | Kick off onboarding for {company} | +3 days | High (1) |

## Technical Details

### Data Model
Reuses `crm_activities` table (type='task') with existing columns: `due_date`, `status`, `priority`, `category`. Assignment via `crm_action_owners` M2M table (activity_id -> user_id).

### API Endpoints
- `GET /api/admin/crm/tasks` — List with tab filter (my/overdue/all)
- `POST /api/admin/crm/tasks` — Create task with assignees
- `GET /api/admin/crm/tasks/:id` — Task detail
- `PATCH /api/admin/crm/tasks/:id` — Update task
- `GET /api/admin/crm/tasks/stats` — Overdue count, due today count
- `POST /api/admin/crm/ai/suggest-tasks` — AI follow-up suggestions

### Files Created/Modified
- NEW: `src/app/api/admin/crm/tasks/route.ts`
- NEW: `src/app/api/admin/crm/tasks/[taskId]/route.ts`
- NEW: `src/app/api/admin/crm/tasks/stats/route.ts`
- NEW: `src/app/api/admin/crm/ai/suggest-tasks/route.ts`
- NEW: `src/app/(app)/admin/crm/tasks/page.tsx`
- NEW: `src/components/admin/crm/TaskForm.tsx`
- NEW: `src/components/admin/crm/TasksView.tsx`
- NEW: `src/components/admin/crm/AiTaskSuggestions.tsx`
- MODIFY: `src/components/app-sidebar.tsx`
- MODIFY: `src/components/admin/crm/PipelineStats.tsx`
- MODIFY: `src/app/api/admin/crm/opportunities/[opportunityId]/route.ts`
- MODIFY: `src/components/admin/crm/CompanyDetail.tsx`
- MODIFY: `src/components/admin/crm/OpportunityDetail.tsx`
- MODIFY: `src/components/admin/crm/ConsultantDetail.tsx`
- MODIFY: `src/components/admin/crm/ActivityForm.tsx`
- MODIFY: `src/lib/crm/schemas.ts`
- MODIFY: `src/lib/crm/types.ts`

## Task Checklist

- [x] Task API endpoints (CRUD + stats)
- [x] TaskForm component (due date, priority, status, assignee)
- [x] TasksView component (My Tasks / Overdue / All tabs)
- [x] Tasks page (server component)
- [x] Sidebar: Tasks nav item + overdue badge
- [x] Auto-create tasks on deal stage changes
- [x] Dashboard stat cards (Overdue + Due Today)
- [x] Quick-create "Add follow-up" on detail pages
- [x] AI-suggested tasks after logging activities
- [x] Unit tests (40 tests)
- [x] Integration tests (34 tests)
- [ ] E2E tests (deferred — requires running dev server + Playwright setup)

## Test Coverage

- Unit: `tests/unit/crm/task-helpers.test.ts` — 40 tests (schema validation, edge cases)
- Integration: `tests/integration/admin/tasks-crud.test.ts` — 34 tests (API CRUD, auth, filters, assignees, stats)
- E2E: deferred (requires Playwright browser setup)

## Known Limitations / Future Work

- Rolloff auto-tasks deferred (auto-create "Plan backfill" when consultant within 30d of rolloff — needs dedup logic)
- No email notifications for overdue tasks (in-app only for v1)
- No recurring tasks
- No task templates
