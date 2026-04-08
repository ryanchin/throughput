-- ============================================================
-- Migration: Add description + deal_id to crm_roles
-- Enables roles to describe what's needed and link back to the
-- deal that created them.
-- ============================================================

ALTER TABLE crm_roles
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES crm_opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS crm_roles_deal_id_idx ON crm_roles (deal_id) WHERE deal_id IS NOT NULL;

-- ============================================================
-- Rollback SQL (reference only)
-- ============================================================
-- ALTER TABLE crm_roles DROP COLUMN IF EXISTS description;
-- ALTER TABLE crm_roles DROP COLUMN IF EXISTS deal_id;
