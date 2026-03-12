-- Quizzes
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text,
  passing_score integer default 70,
  created_at timestamptz default now()
);

alter table public.quizzes enable row level security;

create policy "Quizzes visible with lesson access" on public.quizzes
  for select using (
    exists (
      select 1 from public.lessons l
      join public.courses c on c.id = l.course_id
      where l.id = lesson_id and l.status = 'published' and c.status = 'published'
    )
  );

create policy "Admins can manage quizzes" on public.quizzes
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Questions
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_text text not null,
  question_type text not null check (question_type in ('multiple_choice', 'true_false', 'open_ended')),
  options jsonb, -- [{text, is_correct}] for MC/TF
  correct_answer text,
  rubric text, -- For open_ended LLM grading
  max_points integer default 10,
  order_index integer default 0,
  created_at timestamptz default now()
);

alter table public.questions enable row level security;

create policy "Questions visible with quiz access" on public.questions
  for select using (
    exists (
      select 1 from public.quizzes q
      join public.lessons l on l.id = q.lesson_id
      join public.courses c on c.id = l.course_id
      where q.id = quiz_id and l.status = 'published' and c.status = 'published'
    )
  );

create policy "Admins can manage questions" on public.questions
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
