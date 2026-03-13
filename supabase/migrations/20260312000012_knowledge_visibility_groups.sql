-- Extend docs_pages visibility to support group-based access
-- Current values: 'public', 'internal'
-- New: also allows 'group:<name>' pattern (e.g. 'group:sales', 'group:leadership')

-- Drop the existing check constraint and replace with a more flexible one
alter table public.docs_pages drop constraint if exists docs_pages_visibility_check;
alter table public.docs_pages add constraint docs_pages_visibility_check
  check (visibility in ('public', 'internal') or visibility like 'group:%');

-- Add RLS policy for group-based visibility
-- Group pages are visible to users who belong to the matching group
create policy "Group docs pages visible to group members" on public.docs_pages
  for select using (
    status = 'published'
    and visibility like 'group:%'
    and exists (
      select 1 from public.user_groups
      where user_groups.user_id = auth.uid()
        and user_groups.group_name = substring(docs_pages.visibility from 7)
    )
  );

-- Rollback:
-- drop policy if exists "Group docs pages visible to group members" on public.docs_pages;
-- alter table public.docs_pages drop constraint if exists docs_pages_visibility_check;
-- alter table public.docs_pages add constraint docs_pages_visibility_check check (visibility in ('public', 'internal'));
