-- ============================================================
-- Migration: Teams conversation references for proactive messaging
-- Stores the conversation ID + service URL needed to DM users via Teams.
-- Populated when a user first messages the bot.
-- ============================================================

CREATE TABLE crm_teams_conversations (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id text NOT NULL,
  service_url text NOT NULL,
  teams_user_id text NOT NULL,
  teams_user_name text,
  registered_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE crm_teams_conversations ENABLE ROW LEVEL SECURITY;

-- Service role handles all operations (bot runs as service)
CREATE POLICY "teams_conv_admin" ON crm_teams_conversations FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- Rollback SQL (reference only)
-- ============================================================
-- DROP TABLE IF EXISTS crm_teams_conversations;
