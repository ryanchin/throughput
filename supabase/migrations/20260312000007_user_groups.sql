-- User groups for knowledge base access control
create table public.user_groups (
  user_id uuid references public.profiles(id) on delete cascade,
  group_name text not null,
  added_by uuid references public.profiles(id),
  added_at timestamptz default now(),
  primary key (user_id, group_name)
);

alter table public.user_groups enable row level security;

create policy "Users can view own groups" on public.user_groups
  for select using (user_id = auth.uid());

create policy "Admins can manage user groups" on public.user_groups
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
