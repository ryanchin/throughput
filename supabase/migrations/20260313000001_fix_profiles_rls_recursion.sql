-- Fix infinite recursion in profiles RLS policies.
-- The admin policies query the profiles table to check if the current user
-- is an admin, which triggers the same RLS policies again → recursion.
-- Fix: use a security definer function that bypasses RLS for the role check.

-- Create a helper function that bypasses RLS to check the user's role
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Drop the old recursive policies
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;

-- Recreate admin policies using the helper function (no recursion)
create policy "Admins can view all profiles" on public.profiles
  for select using (
    public.get_my_role() = 'admin'
  );

create policy "Admins can update all profiles" on public.profiles
  for update using (
    public.get_my_role() = 'admin'
  );

-- ROLLBACK:
-- drop policy if exists "Admins can view all profiles" on public.profiles;
-- drop policy if exists "Admins can update all profiles" on public.profiles;
-- create policy "Admins can view all profiles" on public.profiles
--   for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
-- create policy "Admins can update all profiles" on public.profiles
--   for update using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
-- drop function if exists public.get_my_role();
