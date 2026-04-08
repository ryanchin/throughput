-- ============================================================
-- Migration: Daily Digest tables
-- Preferences, logs, and action tokens for the CRM digest email.
-- ============================================================

-- Digest preferences per user
CREATE TABLE crm_digest_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  send_time time NOT NULL DEFAULT '08:00',
  timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE crm_digest_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "digest_prefs_select" ON crm_digest_preferences FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "digest_prefs_insert" ON crm_digest_preferences FOR INSERT WITH CHECK (
  auth.uid() = user_id
);
CREATE POLICY "digest_prefs_update" ON crm_digest_preferences FOR UPDATE USING (
  auth.uid() = user_id
);

-- Digest send logs
CREATE TABLE crm_digest_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sent_at timestamptz DEFAULT now(),
  items_count integer DEFAULT 0,
  clicked_items jsonb DEFAULT '[]',
  delivery_status text NOT NULL DEFAULT 'sent'
    CHECK (delivery_status IN ('sent', 'failed', 'bounced')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX crm_digest_logs_user_idx ON crm_digest_logs (user_id);
CREATE INDEX crm_digest_logs_sent_at_idx ON crm_digest_logs (sent_at DESC);

ALTER TABLE crm_digest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "digest_logs_select" ON crm_digest_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);
CREATE POLICY "digest_logs_insert" ON crm_digest_logs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales'))
);

-- Action tokens for one-click email links
CREATE TABLE crm_action_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type text NOT NULL
    CHECK (action_type IN ('update_stage', 'mark_complete', 'add_note', 'view')),
  entity_type text NOT NULL
    CHECK (entity_type IN ('opportunity', 'task', 'activity', 'role', 'consultant')),
  entity_id uuid NOT NULL,
  payload jsonb,
  used boolean DEFAULT false,
  clicked_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX crm_action_tokens_expires_idx ON crm_action_tokens (expires_at) WHERE used = false;
CREATE INDEX crm_action_tokens_user_idx ON crm_action_tokens (user_id);

ALTER TABLE crm_action_tokens ENABLE ROW LEVEL SECURITY;

-- Service role handles token operations (bypass RLS via createServiceClient)
-- Users can read their own tokens for the action handler
CREATE POLICY "action_tokens_select" ON crm_action_tokens FOR SELECT USING (
  auth.uid() = user_id
);

-- ============================================================
-- Seed default digest preferences for existing CRM users
-- ============================================================
INSERT INTO crm_digest_preferences (user_id, enabled, send_time, timezone)
SELECT id, true, '08:00', 'America/Los_Angeles'
FROM profiles
WHERE role IN ('admin', 'sales')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- Rollback SQL (reference only)
-- ============================================================
-- DROP TABLE IF EXISTS crm_action_tokens;
-- DROP TABLE IF EXISTS crm_digest_logs;
-- DROP TABLE IF EXISTS crm_digest_preferences;
