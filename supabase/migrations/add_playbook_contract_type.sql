-- ============================================================================
-- MULTI-PLAYBOOK: Add contract_type_key to company_playbooks
-- Run this in the Supabase SQL Editor
-- ============================================================================

-- Step 1: Add the column (nullable for backward compatibility)
-- NULL = general/unassigned playbook (applies to all contract types as fallback)
-- Valid values: 'bpo', 'saas', 'nda', 'msa', 'employment', 'it_services', 'consulting', 'custom'
ALTER TABLE company_playbooks
ADD COLUMN IF NOT EXISTS contract_type_key TEXT DEFAULT NULL;

-- Step 2: Enforce uniqueness — only ONE active playbook per contract type per company.
-- Uses a partial unique index so it only applies when is_active = true.
-- NULL contract_type_key values are exempt (multiple general playbooks allowed).
CREATE UNIQUE INDEX IF NOT EXISTS uix_company_playbooks_active_type
ON company_playbooks (company_id, contract_type_key)
WHERE is_active = true AND contract_type_key IS NOT NULL;
