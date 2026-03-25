-- ============================================================================
-- Company-level audit log for admin actions
-- Run this in the Supabase SQL editor for each environment
-- ============================================================================

CREATE TABLE IF NOT EXISTS company_audit_log (
    log_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID        NOT NULL,
    event_type      TEXT        NOT NULL,   -- e.g. 'playbook_added', 'user_edited'
    event_description TEXT      NOT NULL,
    actor_email     TEXT,
    actor_name      TEXT,
    resource_name   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_audit_log_company
    ON company_audit_log (company_id, created_at DESC);

ALTER TABLE company_audit_log ENABLE ROW LEVEL SECURITY;

-- Active company members can read their own company's audit log
CREATE POLICY "company_members_read_audit_log"
    ON company_audit_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM company_users cu
            WHERE cu.company_id = company_audit_log.company_id
              AND cu.email      = auth.email()
              AND cu.status     = 'active'
        )
    );

-- Active company members can insert audit entries
CREATE POLICY "company_members_insert_audit_log"
    ON company_audit_log FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM company_users cu
            WHERE cu.company_id = company_audit_log.company_id
              AND cu.email      = auth.email()
              AND cu.status     = 'active'
        )
    );
