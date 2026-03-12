-- Certification tracks
create table public.certification_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  tier integer not null check (tier between 1 and 3),
  domain text, -- null for tiered, 'sprint_planning' etc for domain
  description text,
  prerequisite_track_id uuid references public.certification_tracks(id),
  passing_score integer default 80,
  exam_duration_minutes integer default 60,
  question_pool_size integer default 50,
  questions_per_exam integer default 30,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz default now()
);

alter table public.certification_tracks enable row level security;

-- Published tracks visible to anyone (public certifications)
create policy "Published cert tracks visible to all" on public.certification_tracks
  for select using (status = 'published');

create policy "Admins can manage cert tracks" on public.certification_tracks
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Certification question pool
create table public.cert_questions (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.certification_tracks(id) on delete cascade,
  question_text text not null,
  question_type text not null check (question_type in ('multiple_choice', 'open_ended')),
  options jsonb,
  correct_answer text,
  rubric text,
  max_points integer default 10,
  difficulty text default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  tags text[],
  created_at timestamptz default now()
);

alter table public.cert_questions enable row level security;

-- Questions only visible to admins (never exposed directly to users)
create policy "Admins can manage cert questions" on public.cert_questions
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Certification attempts
create table public.cert_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  track_id uuid not null references public.certification_tracks(id),
  attempt_number integer default 1,
  question_ids uuid[], -- Randomly selected question set
  score numeric(5,2),
  passed boolean,
  started_at timestamptz default now(),
  submitted_at timestamptz,
  expires_at timestamptz -- 24h cooldown window
);

alter table public.cert_attempts enable row level security;

create policy "Users can view own cert attempts" on public.cert_attempts
  for select using (user_id = auth.uid());

create policy "Users can create cert attempts" on public.cert_attempts
  for insert with check (user_id = auth.uid());

create policy "Admins can manage cert attempts" on public.cert_attempts
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Earned certificates
create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  track_id uuid not null references public.certification_tracks(id),
  attempt_id uuid references public.cert_attempts(id),
  cert_number text unique not null, -- AAVA-2024-XXXXXX
  verification_hash text unique not null, -- SHA-256
  issued_at timestamptz default now(),
  expires_at timestamptz, -- null = no expiry
  revoked boolean default false,
  revoked_at timestamptz
);

alter table public.certificates enable row level security;

-- Certificates are publicly viewable (for verification)
create policy "Certificates are publicly viewable" on public.certificates
  for select using (true);

create policy "Admins can manage certificates" on public.certificates
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
