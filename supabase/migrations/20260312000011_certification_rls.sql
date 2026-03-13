-- Migration: RLS policies for certification tables
-- Enables public read access for published tracks and questions
-- Uses DROP IF EXISTS to be idempotent with any pre-existing policies

-- Enable RLS on certification tables (idempotent)
alter table certification_tracks enable row level security;
alter table cert_questions enable row level security;
alter table cert_attempts enable row level security;
alter table certificates enable row level security;

-- Drop existing policies if any
drop policy if exists "Anyone can read published cert tracks" on certification_tracks;
drop policy if exists "Admins can manage cert tracks" on certification_tracks;
drop policy if exists "Anyone can read cert questions for published tracks" on cert_questions;
drop policy if exists "Admins can manage cert questions" on cert_questions;
drop policy if exists "Users can read own cert attempts" on cert_attempts;
drop policy if exists "Admins can read all cert attempts" on cert_attempts;
drop policy if exists "Anyone can read certificates" on certificates;
drop policy if exists "Admins can manage certificates" on certificates;

-- Certification tracks: anyone can read published tracks
create policy "Anyone can read published cert tracks"
  on certification_tracks for select
  using (status = 'published');

-- Certification tracks: admins can do everything
create policy "Admins can manage cert tracks"
  on certification_tracks for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Cert questions: anyone can read questions for published tracks
create policy "Anyone can read cert questions for published tracks"
  on cert_questions for select
  using (
    exists (
      select 1 from certification_tracks
      where certification_tracks.id = cert_questions.track_id
        and certification_tracks.status = 'published'
    )
  );

-- Cert questions: admins can manage
create policy "Admins can manage cert questions"
  on cert_questions for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Cert attempts: users can read their own attempts
create policy "Users can read own cert attempts"
  on cert_attempts for select
  using (user_id = auth.uid());

-- Cert attempts: admins can read all
create policy "Admins can read all cert attempts"
  on cert_attempts for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Certificates: anyone can read (public verification)
create policy "Anyone can read certificates"
  on certificates for select
  using (true);

-- Certificates: admins can manage
create policy "Admins can manage certificates"
  on certificates for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Rollback SQL:
-- drop policy if exists "Anyone can read published cert tracks" on certification_tracks;
-- drop policy if exists "Admins can manage cert tracks" on certification_tracks;
-- drop policy if exists "Anyone can read cert questions for published tracks" on cert_questions;
-- drop policy if exists "Admins can manage cert questions" on cert_questions;
-- drop policy if exists "Users can read own cert attempts" on cert_attempts;
-- drop policy if exists "Admins can read all cert attempts" on cert_attempts;
-- drop policy if exists "Anyone can read certificates" on certificates;
-- drop policy if exists "Admins can manage certificates" on certificates;
