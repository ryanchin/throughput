-- Add max_attempts to quizzes (null = unlimited)
alter table public.quizzes
  add column max_attempts integer default null;

-- Rollback:
-- alter table public.quizzes drop column max_attempts;
