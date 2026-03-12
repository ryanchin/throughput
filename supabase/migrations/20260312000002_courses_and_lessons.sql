-- Courses
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  slug text unique not null,
  zone text not null default 'training' check (zone in ('training', 'sales')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  cover_image_url text,
  learning_objectives text[],
  passing_score integer default 70,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.courses enable row level security;

-- Published courses: employees see training, sales see training+sales
create policy "Published courses visible to authorized users" on public.courses
  for select using (
    status = 'published' and (
      zone = 'training' and exists (
        select 1 from public.profiles where id = auth.uid() and role in ('employee', 'sales', 'admin')
      )
      or
      zone = 'sales' and exists (
        select 1 from public.profiles where id = auth.uid() and role in ('sales', 'admin')
      )
    )
  );

-- Admins see all courses (including drafts)
create policy "Admins can manage all courses" on public.courses
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Lessons
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  slug text not null,
  content jsonb, -- Tiptap JSON content
  order_index integer default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  video_ids text[] default '{}',
  duration_minutes integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(course_id, slug)
);

alter table public.lessons enable row level security;

-- Published lessons in published courses visible to authorized users
create policy "Published lessons visible to authorized users" on public.lessons
  for select using (
    status = 'published' and exists (
      select 1 from public.courses c
      where c.id = course_id and c.status = 'published' and (
        c.zone = 'training' and exists (
          select 1 from public.profiles where id = auth.uid() and role in ('employee', 'sales', 'admin')
        )
        or
        c.zone = 'sales' and exists (
          select 1 from public.profiles where id = auth.uid() and role in ('sales', 'admin')
        )
      )
    )
  );

-- Admins see all lessons
create policy "Admins can manage all lessons" on public.lessons
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
