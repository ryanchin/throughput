-- Course enrollments
create table public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz default now(),
  completed_at timestamptz,
  unique(user_id, course_id)
);

alter table public.course_enrollments enable row level security;

create policy "Users can view own enrollments" on public.course_enrollments
  for select using (user_id = auth.uid());

create policy "Users can enroll themselves" on public.course_enrollments
  for insert with check (user_id = auth.uid());

create policy "Admins can manage enrollments" on public.course_enrollments
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Lesson progress
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  started_at timestamptz default now(),
  completed_at timestamptz,
  unique(user_id, lesson_id)
);

alter table public.lesson_progress enable row level security;

create policy "Users can view own lesson progress" on public.lesson_progress
  for select using (user_id = auth.uid());

create policy "Users can track own lesson progress" on public.lesson_progress
  for insert with check (user_id = auth.uid());

create policy "Users can update own lesson progress" on public.lesson_progress
  for update using (user_id = auth.uid());

create policy "Admins can manage lesson progress" on public.lesson_progress
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Quiz attempts
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  attempt_number integer default 1,
  score numeric(5,2),
  passed boolean,
  started_at timestamptz default now(),
  submitted_at timestamptz
);

alter table public.quiz_attempts enable row level security;

create policy "Users can view own quiz attempts" on public.quiz_attempts
  for select using (user_id = auth.uid());

create policy "Users can create own quiz attempts" on public.quiz_attempts
  for insert with check (user_id = auth.uid());

create policy "Admins can manage quiz attempts" on public.quiz_attempts
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Question responses
create table public.question_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  user_answer text,
  is_correct boolean,
  points_earned numeric(5,2) default 0,
  llm_feedback text, -- For open-ended LLM grading
  graded_at timestamptz,
  created_at timestamptz default now()
);

alter table public.question_responses enable row level security;

create policy "Users can view own responses" on public.question_responses
  for select using (
    exists (select 1 from public.quiz_attempts where id = attempt_id and user_id = auth.uid())
  );

-- Service role inserts responses during grading (no user insert policy needed)

create policy "Admins can manage responses" on public.question_responses
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
