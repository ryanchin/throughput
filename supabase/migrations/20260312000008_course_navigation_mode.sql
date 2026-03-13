-- Add navigation_mode to courses
-- 'sequential' = lessons locked until prior is complete
-- 'free' = all lessons accessible from enrollment
alter table public.courses
  add column navigation_mode text not null default 'sequential'
  check (navigation_mode in ('sequential', 'free'));

-- Rollback:
-- alter table public.courses drop column navigation_mode;
