-- ============================================================================
-- INTERNAL APPROVALS MIGRATION
-- ============================================================================
-- Run this in the Supabase SQL Editor.
-- Creates: internal_approval_requests, internal_approval_responses tables
-- Enables: Token-based internal document approval workflow
-- ============================================================================


-- ============================================================================
-- 1. CREATE internal_approval_requests TABLE
-- ============================================================================
-- Tracks approval requests: which document, who requested, current status.

CREATE TABLE IF NOT EXISTS internal_approval_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Context: what contract/session this belongs to
    contract_id UUID REFERENCES uploaded_contracts(contract_id),
    session_id UUID,
    source_type TEXT NOT NULL CHECK (source_type IN ('quick_contract', 'mediation')),

    -- What document is being approved
    document_type TEXT NOT NULL,
    document_name TEXT NOT NULL,
    document_url TEXT,

    -- Who requested it
    requested_by_user_id UUID NOT NULL,
    requested_by_name TEXT NOT NULL,
    requested_by_email TEXT NOT NULL,

    -- Request metadata
    message TEXT,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    requires_all_approvers BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);


-- ============================================================================
-- 2. CREATE internal_approval_responses TABLE
-- ============================================================================
-- One row per approver per request. Each approver gets a unique access_token.

CREATE TABLE IF NOT EXISTS internal_approval_responses (
    response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES internal_approval_requests(request_id) ON DELETE CASCADE,

    -- Approver details
    approver_email TEXT NOT NULL,
    approver_name TEXT NOT NULL,
    approver_company TEXT,
    approver_user_id UUID,

    -- Response state
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'viewed', 'approved', 'rejected')),
    decision_note TEXT,
    access_token TEXT NOT NULL UNIQUE,

    -- Tracking timestamps
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,

    -- Metadata for audit
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(request_id, approver_email)
);


-- ============================================================================
-- 3. ROW LEVEL SECURITY — internal_approval_requests
-- ============================================================================

ALTER TABLE internal_approval_requests ENABLE ROW LEVEL SECURITY;

-- Requesters can view their own requests
CREATE POLICY "Users can view their own approval requests"
    ON internal_approval_requests FOR SELECT
    USING (requested_by_user_id = auth.uid());

-- Requesters can create approval requests
CREATE POLICY "Users can insert approval requests"
    ON internal_approval_requests FOR INSERT
    WITH CHECK (requested_by_user_id = auth.uid());

-- Requesters can update (cancel) their own requests
CREATE POLICY "Users can update their own approval requests"
    ON internal_approval_requests FOR UPDATE
    USING (requested_by_user_id = auth.uid());


-- ============================================================================
-- 4. ROW LEVEL SECURITY — internal_approval_responses
-- ============================================================================

ALTER TABLE internal_approval_responses ENABLE ROW LEVEL SECURITY;

-- Requesters can view all responses for their requests
CREATE POLICY "Requesters can view responses for their requests"
    ON internal_approval_responses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM internal_approval_requests iar
            WHERE iar.request_id = internal_approval_responses.request_id
            AND iar.requested_by_user_id = auth.uid()
        )
    );

-- Approvers can view their own responses (if they have a CLARENCE account)
CREATE POLICY "Approvers can view their own responses"
    ON internal_approval_responses FOR SELECT
    USING (approver_user_id = auth.uid());

-- Requesters can insert responses (when creating a request)
CREATE POLICY "Requesters can insert responses for their requests"
    ON internal_approval_responses FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM internal_approval_requests iar
            WHERE iar.request_id = internal_approval_responses.request_id
            AND iar.requested_by_user_id = auth.uid()
        )
    );

-- Note: Approver updates (approve/reject) go through an API route using
-- the service role key, since approvers access via token (not Supabase auth).


-- ============================================================================
-- 5. INDEXES
-- ============================================================================

CREATE INDEX idx_approval_requests_contract ON internal_approval_requests(contract_id);
CREATE INDEX idx_approval_requests_session ON internal_approval_requests(session_id);
CREATE INDEX idx_approval_requests_user ON internal_approval_requests(requested_by_user_id);
CREATE INDEX idx_approval_responses_request ON internal_approval_responses(request_id);
CREATE INDEX idx_approval_responses_token ON internal_approval_responses(access_token);
