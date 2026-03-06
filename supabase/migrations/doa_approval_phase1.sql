-- ============================================================================
-- DELEGATION OF AUTHORITY (DoA) — PHASE 1 MIGRATION
-- ============================================================================
-- Adds approval roles to company users, approval settings to companies,
-- and extends internal_approval_requests with negotiation approval support.
-- Run this in the Supabase SQL Editor.
-- ============================================================================


-- ============================================================================
-- 1. ADD approval_role TO company_users
-- ============================================================================
-- Scoped per-company (a person can be approver in one company, negotiator in another)

ALTER TABLE company_users
ADD COLUMN IF NOT EXISTS approval_role TEXT
    NOT NULL DEFAULT 'negotiator'
    CHECK (approval_role IN ('negotiator', 'approver', 'admin'));


-- ============================================================================
-- 2. ADD APPROVAL SETTINGS TO companies
-- ============================================================================

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS require_contract_approval BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS contract_approval_threshold NUMERIC(12,2) DEFAULT NULL;
-- threshold: deal value above which approval is required (NULL = all contracts when enabled)


-- ============================================================================
-- 3. EXTEND internal_approval_requests
-- ============================================================================
-- Adds negotiation-specific fields. Existing document approval rows will have
-- NULL in these columns — the approval page handles this gracefully.

ALTER TABLE internal_approval_requests
ADD COLUMN IF NOT EXISTS request_category TEXT
    CHECK (request_category IN ('document', 'clause', 'contract')),
ADD COLUMN IF NOT EXISTS clause_id UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS clause_name TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS approval_context JSONB DEFAULT NULL;
-- approval_context stores: clause position, assessment excerpt, deal value, etc.


-- ============================================================================
-- 4. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_approval_requests_category
    ON internal_approval_requests(request_category);

CREATE INDEX IF NOT EXISTS idx_approval_requests_clause_id
    ON internal_approval_requests(clause_id);

CREATE INDEX IF NOT EXISTS idx_company_users_approval_role
    ON company_users(company_id, approval_role);


-- ============================================================================
-- 5. FUTURE: APPROVER DASHBOARD POLICY (non-breaking, add now for later use)
-- ============================================================================
-- Allows approvers to view requests for their company.
-- Currently the token-based flow uses service role so this isn't needed yet,
-- but adding now avoids a future migration.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'internal_approval_requests'
        AND policyname = 'Approvers can view company approval requests'
    ) THEN
        CREATE POLICY "Approvers can view company approval requests"
            ON internal_approval_requests FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM company_users cu
                    JOIN company_users cu2 ON cu2.company_id = cu.company_id
                    WHERE cu.user_id = auth.uid()
                    AND cu.approval_role IN ('approver', 'admin')
                    AND cu2.user_id = internal_approval_requests.requested_by_user_id
                )
            );
    END IF;
END $$;
