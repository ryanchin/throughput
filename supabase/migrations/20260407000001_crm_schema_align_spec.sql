-- ============================================================
-- Migration: Align CRM schema with CRM_Functional_Spec.md
--
-- All tables are empty (0 rows) so constraint changes are safe.
-- Does NOT drop any existing columns or tables — only add/alter.
-- ============================================================


-- ============================================================
-- 1. crm_companies — Add spec §2.1 fields (Accounts)
-- ============================================================

ALTER TABLE crm_companies
  ADD COLUMN IF NOT EXISTS segment text
    CHECK (segment IS NULL OR segment IN ('Flagship','Existing','Small','Nitor','Large','International')),
  ADD COLUMN IF NOT EXISTS parent_customer boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS arr numeric(14,2),
  ADD COLUMN IF NOT EXISTS health text
    CHECK (health IS NULL OR health IN ('G','Y','R')),
  ADD COLUMN IF NOT EXISTS renewal_date date,
  ADD COLUMN IF NOT EXISTS champion text,
  ADD COLUMN IF NOT EXISTS expansion_potential numeric(14,2),
  ADD COLUMN IF NOT EXISTS next_exec_touch_date date,
  ADD COLUMN IF NOT EXISTS last_meaningful_touch date,
  ADD COLUMN IF NOT EXISTS top_risk text,
  ADD COLUMN IF NOT EXISTS next_action text;

CREATE INDEX IF NOT EXISTS crm_companies_health_idx ON crm_companies (health) WHERE health IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_companies_segment_idx ON crm_companies (segment) WHERE segment IS NOT NULL;


-- ============================================================
-- 2. crm_opportunities — Fix stages + probability, add spec §2.2 fields
-- ============================================================

-- 2a. Replace stage check constraint with spec §3.4 stages
ALTER TABLE crm_opportunities DROP CONSTRAINT IF EXISTS crm_opportunities_stage_check;
ALTER TABLE crm_opportunities
  ADD CONSTRAINT crm_opportunities_stage_check
  CHECK (stage IN (
    '1. Inquiry',
    '2. Investigation & Analysis',
    '3. Qualification',
    '4. Proposal Creation',
    '5. Proposal Presentation',
    '6. Negotiation/ Review',
    '7a. Closed Won',
    '7b. Closed Lost',
    '7c. Shelf'
  ));
ALTER TABLE crm_opportunities ALTER COLUMN stage SET DEFAULT '1. Inquiry';

-- 2b. Fix probability: spec uses decimal 0–1, DB had integer 0–100
ALTER TABLE crm_opportunities DROP CONSTRAINT IF EXISTS crm_opportunities_probability_check;
ALTER TABLE crm_opportunities ALTER COLUMN probability TYPE numeric(3,2) USING probability::numeric / 100.0;
ALTER TABLE crm_opportunities ALTER COLUMN probability SET DEFAULT 0;
ALTER TABLE crm_opportunities
  ADD CONSTRAINT crm_opportunities_probability_check
  CHECK (probability >= 0 AND probability <= 1);

-- 2c. Add missing deal columns
ALTER TABLE crm_opportunities
  ADD COLUMN IF NOT EXISTS agentic_type text
    CHECK (agentic_type IS NULL OR agentic_type IN ('AAVA','Non-Agentic','Agentic, Non-Aava')),
  ADD COLUMN IF NOT EXISTS segment text
    CHECK (segment IS NULL OR segment IN ('Flagship','Existing','Small','Nitor','Large','International')),
  ADD COLUMN IF NOT EXISTS deal_type text,
  ADD COLUMN IF NOT EXISTS source text
    CHECK (source IS NULL OR source IN ('Parent','Moodys New','Nitor')),
  ADD COLUMN IF NOT EXISTS target_close_date date,
  ADD COLUMN IF NOT EXISTS actual_close_date date,
  ADD COLUMN IF NOT EXISTS last_activity_date timestamptz,
  ADD COLUMN IF NOT EXISTS next_step text,
  ADD COLUMN IF NOT EXISTS next_step_date date,
  ADD COLUMN IF NOT EXISTS stalled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ceo_ask text;

CREATE INDEX IF NOT EXISTS crm_opportunities_agentic_type_idx ON crm_opportunities (agentic_type) WHERE agentic_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_opportunities_target_close_idx ON crm_opportunities (target_close_date) WHERE target_close_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_opportunities_stalled_idx ON crm_opportunities (stalled) WHERE stalled = true;


-- ============================================================
-- 3. crm_roles — Hiring Pipeline (spec §2.3)
--    Created BEFORE crm_activities alter so role_id FK works.
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  account_id uuid REFERENCES crm_companies(id) ON DELETE SET NULL,
  function text CHECK (function IN ('Program','Product','Engineering')),
  priority integer CHECK (priority IS NULL OR priority IN (1, 2)),
  status text NOT NULL DEFAULT 'Open'
    CHECK (status IN ('Open','Filled','Filled- External','Fulfilled','Cancelled')),
  open_date date,
  target_fill_date date,
  role_stage text
    CHECK (role_stage IS NULL OR role_stage IN (
      '1. Sourcing',
      '2. Internal Interview',
      '3. Client Interviews',
      '4. Final Interview',
      '5. Offer Extended',
      '6a. Offer Accepted',
      '6b. Offer Rejected',
      '7. Pending Start Date Confirm',
      '8. Start Date Confirmed',
      '9. Active, Billing'
    )),
  next_step text,
  next_step_due date,
  blocker text,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_roles_status_idx ON crm_roles (status);
CREATE INDEX IF NOT EXISTS crm_roles_account_id_idx ON crm_roles (account_id);
CREATE INDEX IF NOT EXISTS crm_roles_name_trgm_idx ON crm_roles USING gin (name gin_trgm_ops);

CREATE OR REPLACE FUNCTION update_crm_roles_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crm_roles_updated_at
  BEFORE UPDATE ON crm_roles
  FOR EACH ROW EXECUTE FUNCTION update_crm_roles_updated_at();

ALTER TABLE crm_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_roles_select" ON crm_roles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);
CREATE POLICY "crm_roles_insert" ON crm_roles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);
CREATE POLICY "crm_roles_update" ON crm_roles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);
CREATE POLICY "crm_roles_delete" ON crm_roles FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);


-- ============================================================
-- 4. crm_activities — Add spec §2.4 fields (Actions)
--    Now safe to reference crm_roles.
-- ============================================================

ALTER TABLE crm_activities
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IS NULL OR category IN ('Follow-up','Meeting','Task','Presentation')),
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'Not Started'
    CHECK (status IS NULL OR status IN ('Completed','In Progress','Not Started','On Hold')),
  ADD COLUMN IF NOT EXISTS priority integer
    CHECK (priority IS NULL OR priority IN (1, 2)),
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES crm_roles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS crm_activities_role_id_idx ON crm_activities (role_id) WHERE role_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_activities_due_date_idx ON crm_activities (due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_activities_status_idx ON crm_activities (status);


-- ============================================================
-- 5. crm_consultant_plan — Weekly Headcount Tracker (spec §2.5)
--    ending_hc, target_hc, gap are computed at query time.
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_consultant_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL UNIQUE,
  starting_hc integer NOT NULL DEFAULT 0,
  hires integer DEFAULT 0,
  attrition integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_consultant_plan_week_idx ON crm_consultant_plan (week_start);

ALTER TABLE crm_consultant_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_consultant_plan_select" ON crm_consultant_plan FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);
CREATE POLICY "crm_consultant_plan_insert" ON crm_consultant_plan FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);
CREATE POLICY "crm_consultant_plan_update" ON crm_consultant_plan FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);
CREATE POLICY "crm_consultant_plan_delete" ON crm_consultant_plan FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);


-- ============================================================
-- 6. crm_config — Global Settings (spec §2.6)
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  description text,
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE crm_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_config_select" ON crm_config FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);
CREATE POLICY "crm_config_insert" ON crm_config FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "crm_config_update" ON crm_config FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "crm_config_delete" ON crm_config FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Seed default config values from spec §2.6
INSERT INTO crm_config (key, value, description) VALUES
  ('target_date', '2026-06-30', 'End of current planning period'),
  ('current_consultant_count', '45', 'Active consultants today'),
  ('target_consultant_count', '120', 'Hiring goal by target date'),
  ('monthly_attrition_pct', '0.02', 'Expected monthly attrition rate (decimal)'),
  ('avg_onboarding_ramp_weeks', '4', 'Weeks for new hire to reach full productivity')
ON CONFLICT (key) DO NOTHING;

-- Stage→probability defaults (spec §3.4)
INSERT INTO crm_config (key, value, description) VALUES
  ('stage_prob:1. Inquiry', '0', 'Default probability for stage'),
  ('stage_prob:2. Investigation & Analysis', '0.1', 'Default probability for stage'),
  ('stage_prob:3. Qualification', '0.2', 'Default probability for stage'),
  ('stage_prob:4. Proposal Creation', '0.3', 'Default probability for stage'),
  ('stage_prob:5. Proposal Presentation', '0.5', 'Default probability for stage'),
  ('stage_prob:6. Negotiation/ Review', '0.8', 'Default probability for stage'),
  ('stage_prob:7a. Closed Won', '1', 'Default probability for stage'),
  ('stage_prob:7b. Closed Lost', '0', 'Default probability for stage'),
  ('stage_prob:7c. Shelf', '0', 'Default probability for stage')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- 7. Owner Join Tables (M2M: entity → profiles)
-- ============================================================

-- 7a. Account Owners
CREATE TABLE IF NOT EXISTS crm_account_owners (
  account_id uuid NOT NULL REFERENCES crm_companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  PRIMARY KEY (account_id, user_id)
);

ALTER TABLE crm_account_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_account_owners_all" ON crm_account_owners FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

-- 7b. Deal Owners
CREATE TABLE IF NOT EXISTS crm_deal_owners (
  opportunity_id uuid NOT NULL REFERENCES crm_opportunities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  PRIMARY KEY (opportunity_id, user_id)
);

ALTER TABLE crm_deal_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_deal_owners_all" ON crm_deal_owners FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

-- 7c. Role Owners
CREATE TABLE IF NOT EXISTS crm_role_owners (
  role_id uuid NOT NULL REFERENCES crm_roles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  PRIMARY KEY (role_id, user_id)
);

ALTER TABLE crm_role_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_role_owners_all" ON crm_role_owners FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

-- 7d. Action Owners
CREATE TABLE IF NOT EXISTS crm_action_owners (
  activity_id uuid NOT NULL REFERENCES crm_activities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  PRIMARY KEY (activity_id, user_id)
);

ALTER TABLE crm_action_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_action_owners_all" ON crm_action_owners FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);
