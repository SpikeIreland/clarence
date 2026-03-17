-- ============================================================================
-- SCHEDULE REVIEW PHASE A: Schedule Detection Tables
-- Run this migration to enable contract schedule detection and tracking.
-- ============================================================================

-- 1. Detected schedules per uploaded contract
CREATE TABLE IF NOT EXISTS contract_schedules (
    schedule_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES uploaded_contracts(contract_id) ON DELETE CASCADE,
    schedule_type TEXT NOT NULL,
    schedule_label TEXT NOT NULL,
    detection_method TEXT DEFAULT 'ai'
        CHECK (detection_method IN ('ai', 'manual', 'keyword')),
    confidence_score NUMERIC(3,2)
        CHECK (confidence_score >= 0 AND confidence_score <= 1),
    start_position INTEGER,
    end_position INTEGER,
    extracted_text TEXT,
    summary TEXT,
    status TEXT DEFAULT 'detected'
        CHECK (status IN ('detected', 'confirmed', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_schedules_contract
    ON contract_schedules(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_schedules_type
    ON contract_schedules(schedule_type);

-- 2. Add schedule detection metadata to uploaded_contracts
ALTER TABLE uploaded_contracts
    ADD COLUMN IF NOT EXISTS schedule_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS schedule_detection_status TEXT DEFAULT NULL
        CHECK (schedule_detection_status IN ('pending', 'processing', 'complete', 'failed'));

-- 3. Enable RLS (match existing table policies pattern)
ALTER TABLE contract_schedules ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write their own contract schedules
CREATE POLICY "Users can view schedules for their contracts"
    ON contract_schedules FOR SELECT
    USING (
        contract_id IN (
            SELECT contract_id FROM uploaded_contracts
            WHERE uploaded_by_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert schedules for their contracts"
    ON contract_schedules FOR INSERT
    WITH CHECK (
        contract_id IN (
            SELECT contract_id FROM uploaded_contracts
            WHERE uploaded_by_user_id = auth.uid()
        )
    );

-- Service role (n8n) can do everything
CREATE POLICY "Service role full access to contract_schedules"
    ON contract_schedules
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
