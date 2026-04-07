-- ============================================================
-- Migration: Resources Module — consultants, candidates, assignments
-- Spec: RESOURCES_SPEC.md §2 and §3
--
-- Adds three new tables for resource/placement management.
-- Uses CHECK constraints (not Postgres enums) per codebase convention.
-- FK mappings: accounts → crm_companies, deals → crm_opportunities,
--              roles → crm_roles, users → profiles
-- ============================================================


-- ============================================================
-- 1. Add user_role to profiles (spec §4.1)
--    Existing `role` column controls platform access (employee/sales/admin/public).
--    `user_role` tracks organizational role (admin/staff/consultant).
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS user_role text NOT NULL DEFAULT 'staff'
    CHECK (user_role IN ('admin', 'staff', 'consultant'));

-- Backfill: all existing rows get 'staff' (the DEFAULT handles this for NOT NULL + ADD COLUMN)


-- ============================================================
-- 2. crm_consultants (spec §2.1)
--    Forward-declare without promoted_from_candidate_id FK;
--    add it after crm_candidates exists.
-- ============================================================

CREATE TABLE crm_consultants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity link (1:1 with profiles)
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

  -- Resource fields
  function text NOT NULL
    CHECK (function IN ('Program', 'Product', 'Engineering')),
  seniority text
    CHECK (seniority IS NULL OR seniority IN ('Junior', 'Mid', 'Senior', 'Principal', 'Director')),
  skills text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'Active - Bench'
    CHECK (status IN ('Active - Placed', 'Active - Bench', 'On Leave', 'Offboarded')),

  -- Current placement (denormalized from active assignment)
  current_account_id uuid REFERENCES crm_companies(id) ON DELETE SET NULL,
  current_deal_id uuid REFERENCES crm_opportunities(id) ON DELETE SET NULL,
  start_date date,
  expected_end_date date,

  -- Rates
  bill_rate numeric(10,2),
  cost_rate numeric(10,2),

  -- Metadata
  hire_date date,
  location varchar,
  notes text,

  -- Set after crm_candidates is created (ALTER TABLE below)
  promoted_from_candidate_id uuid,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX crm_consultants_status_idx ON crm_consultants (status);
CREATE INDEX crm_consultants_function_idx ON crm_consultants (function);
CREATE INDEX crm_consultants_current_account_idx ON crm_consultants (current_account_id) WHERE current_account_id IS NOT NULL;
CREATE INDEX crm_consultants_expected_end_date_idx ON crm_consultants (expected_end_date) WHERE expected_end_date IS NOT NULL;
CREATE INDEX crm_consultants_user_id_idx ON crm_consultants (user_id);


-- ============================================================
-- 3. crm_candidates (spec §2.2)
-- ============================================================

CREATE TABLE crm_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  first_name varchar NOT NULL,
  last_name varchar NOT NULL,
  email varchar,
  phone varchar,

  function text NOT NULL
    CHECK (function IN ('Program', 'Product', 'Engineering')),
  seniority text
    CHECK (seniority IS NULL OR seniority IN ('Junior', 'Mid', 'Senior', 'Principal', 'Director')),
  skills text[] DEFAULT '{}',

  status text NOT NULL DEFAULT 'New'
    CHECK (status IN ('New', 'Screening', 'Interviewing', 'Offer Extended', 'Hired', 'Rejected', 'Withdrawn')),

  source varchar,

  -- Target placement
  target_role_id uuid REFERENCES crm_roles(id) ON DELETE SET NULL,
  target_account_id uuid REFERENCES crm_companies(id) ON DELETE SET NULL,

  resume_url varchar,
  interview_notes text,
  date_added date NOT NULL DEFAULT current_date,

  -- Set when promoted to consultant
  promoted_to_consultant_id uuid REFERENCES crm_consultants(id) ON DELETE SET NULL,

  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX crm_candidates_status_idx ON crm_candidates (status);
CREATE INDEX crm_candidates_function_idx ON crm_candidates (function);
CREATE INDEX crm_candidates_target_account_idx ON crm_candidates (target_account_id) WHERE target_account_id IS NOT NULL;
CREATE INDEX crm_candidates_target_role_idx ON crm_candidates (target_role_id) WHERE target_role_id IS NOT NULL;


-- ============================================================
-- 3b. Add deferred FK: crm_consultants.promoted_from_candidate_id → crm_candidates
-- ============================================================

ALTER TABLE crm_consultants
  ADD CONSTRAINT crm_consultants_promoted_from_candidate_fk
  FOREIGN KEY (promoted_from_candidate_id) REFERENCES crm_candidates(id) ON DELETE SET NULL;


-- ============================================================
-- 4. crm_assignments (spec §2.3)
-- ============================================================

CREATE TABLE crm_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  consultant_id uuid NOT NULL REFERENCES crm_consultants(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES crm_companies(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES crm_opportunities(id) ON DELETE SET NULL,
  role_id uuid REFERENCES crm_roles(id) ON DELETE SET NULL,

  start_date date NOT NULL,
  expected_end_date date,
  actual_end_date date,

  bill_rate numeric(10,2),

  status text NOT NULL DEFAULT 'Planned'
    CHECK (status IN ('Planned', 'Active', 'Completed', 'Cancelled')),

  end_reason text
    CHECK (end_reason IS NULL OR end_reason IN (
      'Contract End', 'Client Request', 'Consultant Resignation',
      'Replaced', 'Project Cancelled', 'Mutual Agreement'
    )),

  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX crm_assignments_consultant_idx ON crm_assignments (consultant_id);
CREATE INDEX crm_assignments_account_idx ON crm_assignments (account_id);
CREATE INDEX crm_assignments_deal_idx ON crm_assignments (deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX crm_assignments_status_idx ON crm_assignments (status);
CREATE INDEX crm_assignments_expected_end_idx ON crm_assignments (expected_end_date) WHERE expected_end_date IS NOT NULL AND status = 'Active';


-- ============================================================
-- 5. RLS Policies — admin + sales read/write, admin-only delete
-- ============================================================

ALTER TABLE crm_consultants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_consultants_select" ON crm_consultants FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);
CREATE POLICY "crm_consultants_insert" ON crm_consultants FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);
CREATE POLICY "crm_consultants_update" ON crm_consultants FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);
CREATE POLICY "crm_consultants_delete" ON crm_consultants FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE crm_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_candidates_select" ON crm_candidates FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);
CREATE POLICY "crm_candidates_insert" ON crm_candidates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);
CREATE POLICY "crm_candidates_update" ON crm_candidates FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);
CREATE POLICY "crm_candidates_delete" ON crm_candidates FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE crm_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_assignments_select" ON crm_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);
CREATE POLICY "crm_assignments_insert" ON crm_assignments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);
CREATE POLICY "crm_assignments_update" ON crm_assignments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);
CREATE POLICY "crm_assignments_delete" ON crm_assignments FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);


-- ============================================================
-- 6. Updated_at Triggers
-- ============================================================

CREATE OR REPLACE FUNCTION update_crm_consultants_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crm_consultants_updated_at
  BEFORE UPDATE ON crm_consultants
  FOR EACH ROW EXECUTE FUNCTION update_crm_consultants_updated_at();

CREATE OR REPLACE FUNCTION update_crm_candidates_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crm_candidates_updated_at
  BEFORE UPDATE ON crm_candidates
  FOR EACH ROW EXECUTE FUNCTION update_crm_candidates_updated_at();

CREATE OR REPLACE FUNCTION update_crm_assignments_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crm_assignments_updated_at
  BEFORE UPDATE ON crm_assignments
  FOR EACH ROW EXECUTE FUNCTION update_crm_assignments_updated_at();


-- ============================================================
-- Rollback SQL (do not run — reference only)
-- ============================================================
-- DROP TRIGGER IF EXISTS trg_crm_assignments_updated_at ON crm_assignments;
-- DROP FUNCTION IF EXISTS update_crm_assignments_updated_at();
-- DROP TRIGGER IF EXISTS trg_crm_candidates_updated_at ON crm_candidates;
-- DROP FUNCTION IF EXISTS update_crm_candidates_updated_at();
-- DROP TRIGGER IF EXISTS trg_crm_consultants_updated_at ON crm_consultants;
-- DROP FUNCTION IF EXISTS update_crm_consultants_updated_at();
-- DROP TABLE IF EXISTS crm_assignments;
-- ALTER TABLE crm_consultants DROP CONSTRAINT IF EXISTS crm_consultants_promoted_from_candidate_fk;
-- DROP TABLE IF EXISTS crm_candidates;
-- DROP TABLE IF EXISTS crm_consultants;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS user_role;
