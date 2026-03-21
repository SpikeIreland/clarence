-- Migration: Relax playbook uniqueness from "one active per type" to "unique name per company"
--
-- Previously, uix_company_playbooks_active_type prevented more than one active playbook
-- per contract type per company. This is too restrictive — a company legitimately needs
-- multiple active playbooks of the same type (e.g. Service Agreement as Provider vs Customer,
-- or different industry variants). The new constraint requires only that playbook names are
-- unique within a company.
--
-- Run this in the Supabase SQL editor.

-- Step 1: Drop the old constraint
ALTER TABLE company_playbooks
    DROP CONSTRAINT IF EXISTS uix_company_playbooks_active_type;

-- Step 2: If any duplicate names exist (from before this migration), make them distinct
-- by appending the playbook_id suffix before adding the new constraint.
-- This UPDATE is a no-op if all names are already unique.
UPDATE company_playbooks pb
SET playbook_name = pb.playbook_name || ' (' || left(pb.playbook_id::text, 8) || ')'
WHERE (pb.company_id, pb.playbook_name) IN (
    SELECT company_id, playbook_name
    FROM company_playbooks
    GROUP BY company_id, playbook_name
    HAVING count(*) > 1
)
AND pb.playbook_id NOT IN (
    -- Keep the earliest record of each duplicate group unchanged
    SELECT min(playbook_id::text)::uuid
    FROM company_playbooks
    GROUP BY company_id, playbook_name
    HAVING count(*) > 1
);

-- Step 3: Add the new constraint — names must be unique per company
ALTER TABLE company_playbooks
    ADD CONSTRAINT uix_company_playbooks_name UNIQUE (company_id, playbook_name);
