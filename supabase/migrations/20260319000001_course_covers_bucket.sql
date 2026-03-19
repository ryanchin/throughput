-- Storage bucket for course cover images
insert into storage.buckets (id, name, public)
values ('course-covers', 'course-covers', true)
on conflict (id) do nothing;

-- Public read access (covers are displayed to all learners)
create policy "public_read_course_covers" on storage.objects
  for select to public
  using (bucket_id = 'course-covers');

-- Admin write access
create policy "admin_write_course_covers" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'course-covers'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

create policy "admin_delete_course_covers" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'course-covers'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Rollback:
-- delete from storage.objects where bucket_id = 'course-covers';
-- delete from storage.buckets where id = 'course-covers';
