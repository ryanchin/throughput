-- Generation logs for AI content generation audit trail
create table generation_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references profiles(id),
  generation_type text not null,         -- 'course' | 'lesson' | 'certification'
  inputs jsonb not null default '{}',    -- sanitized inputs (instructions, preset, course_ids, file_name)
  output_summary text,                   -- brief summary of what was generated
  model text not null default 'openai/gpt-oss-120b',
  tokens_used integer,
  duration_ms integer,
  status text not null default 'success', -- 'success' | 'error'
  error_message text,
  created_at timestamptz default now()
);

create index idx_generation_logs_admin on generation_logs(admin_id);
create index idx_generation_logs_type on generation_logs(generation_type);
create index idx_generation_logs_created on generation_logs(created_at desc);

alter table generation_logs enable row level security;

-- Admin only: full access
create policy "admin_all" on generation_logs
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

-- Rollback:
-- drop table if exists generation_logs cascade;
