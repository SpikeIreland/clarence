-- ============================================================================
-- PLAYBOOK PERSPECTIVE: Add perspective field to company_playbooks
-- Run this in the Supabase SQL Editor
-- ============================================================================
-- Determines whether the playbook is written from the customer's or
-- provider's perspective, which affects how positions are interpreted.

ALTER TABLE company_playbooks
ADD COLUMN IF NOT EXISTS playbook_perspective TEXT DEFAULT 'customer'
CHECK (playbook_perspective IN ('customer', 'provider'));

COMMENT ON COLUMN company_playbooks.playbook_perspective IS
  'Which party perspective this playbook is written from: customer or provider';
