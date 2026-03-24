-- Add explicit playbook link to contract_templates
-- This allows admins to pin a template to a specific playbook for compliance checking,
-- replacing the unreliable contract-type-key matching fallback.

ALTER TABLE contract_templates
    ADD COLUMN IF NOT EXISTS linked_playbook_id UUID
        REFERENCES company_playbooks(playbook_id) ON DELETE SET NULL;

COMMENT ON COLUMN contract_templates.linked_playbook_id IS
    'Explicit playbook used for template compliance checking. Overrides contract-type key matching.';
