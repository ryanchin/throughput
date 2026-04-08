# Prompt Tracking

Log of all significant prompts used in the Throughput platform.

## Prompts

| Name | Location | Purpose | Last Updated |
|------|----------|---------|--------------|
| Course Generator System Prompt | `src/app/api/admin/generate/course/route.ts` | Generates structured course outlines from plain-language descriptions | 2026-03-12 |
| LLM Grader Prompt | `src/lib/openrouter/grader.ts` | Grades open-ended quiz responses | 2026-03-12 |
| CRM Company Enrichment | `src/app/api/admin/crm/ai/enrich/route.ts` | AI-enriches company data (industry, size, description) from name/URL | 2026-04-06 |
| CRM NL Deal Update Parser | `src/app/api/admin/crm/ai/parse/route.ts` | Parses natural language sales updates into structured CRM actions | 2026-04-06 |
| CRM Next Action Suggestions | `src/app/api/admin/crm/ai/suggest-actions/route.ts` | Suggests 2-3 next actions after logging a sales activity | 2026-04-06 |
| CRM Deal Scoring | `src/app/api/admin/crm/ai/score/route.ts` | AI-predicted close probability for opportunities | 2026-04-06 |
| CRM Weekly Digest | `src/app/api/admin/crm/ai/digest/route.ts` | Monday pipeline briefing summarizing changes and attention items | 2026-04-06 |
| Task Follow-up Suggestions | `src/app/api/admin/crm/ai/suggest-tasks/route.ts` | Suggests 2-3 follow-up tasks after logging any non-task activity | 2026-04-07 |

*Update this file whenever a prompt is added, modified, or removed.*
