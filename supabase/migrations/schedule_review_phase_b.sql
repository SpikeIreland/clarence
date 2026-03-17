-- ============================================================================
-- SCHEDULE REVIEW PHASE B: Schedule-Specific Playbook Rules
-- Run this migration to enable schedule-aware playbook rules.
-- ============================================================================

-- Extend playbook_rules with schedule_type (nullable = main body rule)
ALTER TABLE playbook_rules
    ADD COLUMN IF NOT EXISTS schedule_type TEXT DEFAULT NULL;

-- Add check constraint for valid schedule types
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_playbook_rule_schedule_type'
    ) THEN
        ALTER TABLE playbook_rules
        ADD CONSTRAINT chk_playbook_rule_schedule_type CHECK (
            schedule_type IS NULL OR schedule_type IN (
                'scope_of_work', 'pricing', 'service_levels',
                'data_processing', 'governance', 'exit_transition',
                'insurance', 'change_control', 'disaster_recovery',
                'security', 'benchmarking', 'subcontracting', 'other'
            )
        );
    END IF;
END $$;

-- Index for efficient filtering of schedule rules
CREATE INDEX IF NOT EXISTS idx_playbook_rules_schedule_type
    ON playbook_rules(playbook_id, schedule_type)
    WHERE schedule_type IS NOT NULL;

COMMENT ON COLUMN playbook_rules.schedule_type IS
    'NULL = main body clause rule. Non-null = rule applies to a specific schedule type (e.g. service_levels, pricing).';
