-- Sales Enablement Materials Library
-- Adds tables for prospect-facing collateral that sales reps can browse, search, and share.

-- ============================================================
-- 1. sales_material_categories (controlled vocabulary)
-- ============================================================
create table sales_material_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  slug text unique not null,
  order_index integer default 0,
  created_at timestamptz default now()
);

create index idx_smc_order on sales_material_categories(order_index);

alter table sales_material_categories enable row level security;

-- Readable by sales + admin
create policy "categories_read" on sales_material_categories
  for select to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('sales', 'admin')
    )
  );

-- Writable by admin
create policy "categories_admin" on sales_material_categories
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

-- ============================================================
-- 2. sales_materials
-- ============================================================
create table sales_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  material_type text not null,
  category text,
  tags text[] default '{}',
  content jsonb,
  file_path text,
  file_name text,
  file_size_bytes bigint,
  file_mime_type text,
  shareable boolean default false,
  share_token text unique,
  status text not null default 'draft',
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Full-text search (same pattern as docs_pages)
alter table sales_materials add column search_vector tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored;

-- Indexes
create index idx_sales_materials_status on sales_materials(status);
create index idx_sales_materials_type on sales_materials(material_type);
create index idx_sales_materials_category on sales_materials(category);
create index idx_sales_materials_share_token on sales_materials(share_token) where share_token is not null;
create index idx_sales_materials_search on sales_materials using gin(search_vector);
create index idx_sales_materials_updated on sales_materials(updated_at desc);

-- Auto-update updated_at
create or replace function update_sales_materials_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_sales_materials_updated_at
  before update on sales_materials
  for each row execute function update_sales_materials_updated_at();

alter table sales_materials enable row level security;

-- Sales + admin: read published materials
create policy "sales_read_published" on sales_materials
  for select to authenticated
  using (
    status = 'published'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('sales', 'admin')
    )
  );

-- Admin: full CRUD (all statuses)
create policy "admin_all" on sales_materials
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

-- Public (anon): read shareable published materials by share_token
create policy "public_share_read" on sales_materials
  for select to anon
  using (
    shareable = true
    and status = 'published'
  );

-- ============================================================
-- 3. Storage bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('sales-materials', 'sales-materials', false)
on conflict (id) do nothing;

-- ============================================================
-- Rollback SQL (run manually if needed):
--
-- drop trigger if exists trg_sales_materials_updated_at on sales_materials;
-- drop function if exists update_sales_materials_updated_at();
-- drop table if exists sales_materials cascade;
-- drop table if exists sales_material_categories cascade;
-- delete from storage.buckets where id = 'sales-materials';
-- ============================================================
