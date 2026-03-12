-- Docs pages (nested, for knowledge base + public docs)
create table public.docs_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  content jsonb, -- Tiptap JSON content
  parent_id uuid references public.docs_pages(id) on delete set null,
  order_index integer default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  visibility text not null default 'internal' check (visibility in ('public', 'internal')),
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content::text, ''))
  ) stored,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index docs_pages_search_idx on public.docs_pages using gin(search_vector);
create index docs_pages_parent_idx on public.docs_pages(parent_id);
create index docs_pages_slug_idx on public.docs_pages(slug);

alter table public.docs_pages enable row level security;

-- Public pages visible to anyone
create policy "Public docs pages visible to all" on public.docs_pages
  for select using (status = 'published' and visibility = 'public');

-- Internal pages visible to authenticated users
create policy "Internal docs pages visible to authenticated users" on public.docs_pages
  for select using (
    status = 'published' and visibility = 'internal' and auth.uid() is not null
  );

-- Admins can manage all docs
create policy "Admins can manage docs pages" on public.docs_pages
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
