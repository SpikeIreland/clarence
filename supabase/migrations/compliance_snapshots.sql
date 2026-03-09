-- ============================================================================
-- PLAYBOOK COMPLIANCE AGENT: Score Tracking Table
-- Run this in the Supabase SQL Editor
-- ============================================================================

CREATE TABLE IF NOT EXISTS compliance_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID,
    contract_id UUID,
    clause_id TEXT NOT NULL,
    clause_name TEXT,
    proposed_position NUMERIC(3,1) NOT NULL,
    previous_position NUMERIC(3,1),
    party TEXT NOT NULL,
    overall_score INTEGER NOT NULL,
    previous_score INTEGER,
    score_delta INTEGER,
    severity TEXT NOT NULL CHECK (severity IN ('clear', 'guidance', 'warning', 'breach', 'deal_breaker')),
    breached_rules JSONB DEFAULT '[]',
    resolved_by TEXT CHECK (resolved_by IN ('static', 'agent')),
    agent_reasoning TEXT,
    requires_approval BOOLEAN DEFAULT false,
    approval_request_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_compliance_snapshots_session ON compliance_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_compliance_snapshots_contract ON compliance_snapshots(contract_id);
CREATE INDEX IF NOT EXISTS idx_compliance_snapshots_created ON compliance_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_snapshots_severity ON compliance_snapshots(severity) WHERE severity != 'clear';
