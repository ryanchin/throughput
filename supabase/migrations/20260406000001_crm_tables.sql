-- CRM Tables Migration
-- AI-First, company-first CRM for Throughput admin section
-- Accessible to admin + sales roles

-- Enable trigram extension for fuzzy entity matching in NL parse
create extension if not exists pg_trgm;

-- ============================================================
-- Companies (top-level entity)
-- ============================================================
create table crm_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  industry text,
  company_size text check (company_size in ('1-10','11-50','51-200','201-500','501-1000','1000+')),
  status text not null default 'prospect' check (status in ('prospect','active','churned','partner')),
  notes text,
  tags text[] default '{}',
  ai_enriched boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index crm_companies_name_lower_idx on crm_companies (lower(name));
create index crm_companies_status_idx on crm_companies (status);
create index crm_companies_name_trgm_idx on crm_companies using gin (name gin_trgm_ops);

-- ============================================================
-- Contacts (optional, belong to a company)
-- ============================================================
create table crm_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references crm_companies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  title text,
  linkedin_url text,
  is_primary boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index crm_contacts_company_id_idx on crm_contacts (company_id);
-- Enforce at most one primary contact per company
create unique index crm_contacts_primary_idx on crm_contacts (company_id) where is_primary = true;

-- ============================================================
-- Opportunities (belong to a company, optionally to a contact)
-- ============================================================
create table crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references crm_companies(id) on delete cascade,
  contact_id uuid references crm_contacts(id) on delete set null,
  title text not null,
  value numeric(12,2),
  stage text not null default 'lead' check (stage in ('lead','qualified','proposal','negotiation','closed_won','closed_lost')),
  probability integer default 10 check (probability >= 0 and probability <= 100),
  expected_close_date date,
  close_reason text,
  ai_score integer check (ai_score is null or (ai_score >= 0 and ai_score <= 100)),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index crm_opportunities_company_id_idx on crm_opportunities (company_id);
create index crm_opportunities_stage_idx on crm_opportunities (stage);

-- ============================================================
-- Activities (linked to company; optionally contact/opportunity)
-- ============================================================
create table crm_activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references crm_companies(id) on delete cascade,
  contact_id uuid references crm_contacts(id) on delete set null,
  opportunity_id uuid references crm_opportunities(id) on delete set null,
  type text not null check (type in ('call','email','meeting','note','task')),
  subject text not null,
  description text,
  activity_date timestamptz default now(),
  completed boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create index crm_activities_company_id_idx on crm_activities (company_id);
create index crm_activities_opportunity_id_idx on crm_activities (opportunity_id);
create index crm_activities_activity_date_idx on crm_activities (activity_date desc);

-- ============================================================
-- NL Parse Log (accuracy tracking for natural language input)
-- ============================================================
create table crm_nl_parse_log (
  id uuid primary key default gen_random_uuid(),
  raw_input text not null,
  parsed_actions jsonb not null,
  accepted boolean,
  modified_actions jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- Pipeline Snapshots (weekly trend tracking)
-- ============================================================
create table crm_pipeline_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  total_pipeline_value numeric(14,2),
  weighted_pipeline_value numeric(14,2),
  deal_count integer,
  stage_breakdown jsonb,
  won_count integer default 0,
  won_value numeric(14,2) default 0,
  lost_count integer default 0,
  created_at timestamptz default now()
);

create unique index crm_pipeline_snapshots_date_idx on crm_pipeline_snapshots (snapshot_date);

-- ============================================================
-- RLS Policies
-- Admin + Sales for read/write, Admin-only for delete
-- ============================================================
alter table crm_companies enable row level security;
alter table crm_contacts enable row level security;
alter table crm_opportunities enable row level security;
alter table crm_activities enable row level security;
alter table crm_nl_parse_log enable row level security;
alter table crm_pipeline_snapshots enable row level security;

-- Companies: admin+sales read/write, admin-only delete
create policy "crm_companies_select" on crm_companies for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);
create policy "crm_companies_insert" on crm_companies for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);
create policy "crm_companies_update" on crm_companies for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);
create policy "crm_companies_delete" on crm_companies for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Contacts: admin+sales read/write, admin-only delete
create policy "crm_contacts_select" on crm_contacts for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);
create policy "crm_contacts_insert" on crm_contacts for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);
create policy "crm_contacts_update" on crm_contacts for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);
create policy "crm_contacts_delete" on crm_contacts for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Opportunities: admin+sales for all operations
create policy "crm_opportunities_select" on crm_opportunities for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);
create policy "crm_opportunities_insert" on crm_opportunities for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);
create policy "crm_opportunities_update" on crm_opportunities for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);
create policy "crm_opportunities_delete" on crm_opportunities for delete using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);

-- Activities: admin+sales for all operations
create policy "crm_activities_select" on crm_activities for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);
create policy "crm_activities_insert" on crm_activities for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);
create policy "crm_activities_update" on crm_activities for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);

-- NL Parse Log: admin+sales for all operations
create policy "crm_nl_log_all" on crm_nl_parse_log for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);

-- Pipeline Snapshots: admin+sales for all operations
create policy "crm_snapshots_all" on crm_pipeline_snapshots for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'sales'))
);

-- ============================================================
-- Updated_at Triggers
-- ============================================================
create or replace function update_crm_companies_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_crm_companies_updated_at
  before update on crm_companies
  for each row execute function update_crm_companies_updated_at();

create or replace function update_crm_contacts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_crm_contacts_updated_at
  before update on crm_contacts
  for each row execute function update_crm_contacts_updated_at();

create or replace function update_crm_opportunities_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_crm_opportunities_updated_at
  before update on crm_opportunities
  for each row execute function update_crm_opportunities_updated_at();

-- ============================================================
-- Rollback SQL
-- ============================================================
-- drop trigger if exists trg_crm_opportunities_updated_at on crm_opportunities;
-- drop function if exists update_crm_opportunities_updated_at();
-- drop trigger if exists trg_crm_contacts_updated_at on crm_contacts;
-- drop function if exists update_crm_contacts_updated_at();
-- drop trigger if exists trg_crm_companies_updated_at on crm_companies;
-- drop function if exists update_crm_companies_updated_at();
-- drop table if exists crm_pipeline_snapshots;
-- drop table if exists crm_nl_parse_log;
-- drop table if exists crm_activities;
-- drop table if exists crm_opportunities;
-- drop table if exists crm_contacts;
-- drop table if exists crm_companies;
