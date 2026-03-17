-- ============================================================================
-- SCHEDULE REVIEW PHASE C: Schedule Checklist System
-- Run this migration to enable checklist-style completeness checking per schedule.
-- ============================================================================

-- 1. Template questions per contract type per schedule type
CREATE TABLE IF NOT EXISTS schedule_checklist_templates (
    template_item_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_type_key TEXT NOT NULL,
    schedule_type TEXT NOT NULL,
    check_question TEXT NOT NULL,
    check_category TEXT DEFAULT 'completeness'
        CHECK (check_category IN ('completeness', 'commercial', 'operational', 'legal')),
    importance_level INTEGER DEFAULT 5
        CHECK (importance_level >= 1 AND importance_level <= 10),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_lookup
    ON schedule_checklist_templates(contract_type_key, schedule_type)
    WHERE is_active = TRUE;

-- 2. Per-contract checklist results (one row per question per schedule)
CREATE TABLE IF NOT EXISTS contract_schedule_checklist (
    result_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES uploaded_contracts(contract_id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL REFERENCES contract_schedules(schedule_id) ON DELETE CASCADE,
    template_item_id UUID REFERENCES schedule_checklist_templates(template_item_id),
    check_question TEXT NOT NULL,
    check_category TEXT DEFAULT 'completeness'
        CHECK (check_category IN ('completeness', 'commercial', 'operational', 'legal')),
    check_result TEXT DEFAULT 'unchecked'
        CHECK (check_result IN ('present', 'absent', 'partial', 'unchecked')),
    ai_evidence TEXT,
    ai_confidence NUMERIC(3,2)
        CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
    manual_override TEXT
        CHECK (manual_override IS NULL OR manual_override IN ('present', 'absent', 'partial')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_checklist_contract
    ON contract_schedule_checklist(contract_id);
CREATE INDEX IF NOT EXISTS idx_schedule_checklist_schedule
    ON contract_schedule_checklist(schedule_id);

-- 3. Add checklist status to contract_schedules
ALTER TABLE contract_schedules
    ADD COLUMN IF NOT EXISTS checklist_status TEXT DEFAULT NULL
        CHECK (checklist_status IS NULL OR checklist_status IN ('pending', 'processing', 'complete', 'failed')),
    ADD COLUMN IF NOT EXISTS checklist_score NUMERIC(5,2) DEFAULT NULL;

-- 4. Enable RLS
ALTER TABLE schedule_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_schedule_checklist ENABLE ROW LEVEL SECURITY;

-- Templates are read-only for authenticated users
CREATE POLICY "Authenticated users can view checklist templates"
    ON schedule_checklist_templates FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Service role full access to checklist templates"
    ON schedule_checklist_templates
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Checklist results scoped to user's contracts
CREATE POLICY "Users can view checklist results for their contracts"
    ON contract_schedule_checklist FOR SELECT
    USING (
        contract_id IN (
            SELECT contract_id FROM uploaded_contracts
            WHERE uploaded_by_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update checklist results for their contracts"
    ON contract_schedule_checklist FOR UPDATE
    USING (
        contract_id IN (
            SELECT contract_id FROM uploaded_contracts
            WHERE uploaded_by_user_id = auth.uid()
        )
    );

CREATE POLICY "Service role full access to schedule checklist"
    ON contract_schedule_checklist
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
