-- ============================================================================
-- SIGNING CEREMONY — RLS POLICIES FIX
-- Run this AFTER the table creation succeeded.
-- Fixes: qc_recipients uses quick_contract_id, not contract_id.
-- The join goes: qc_recipients → quick_contracts → uploaded_contracts
-- ============================================================================

-- ============================================================================
-- 1. RLS POLICIES FOR signing_confirmations
-- ============================================================================

ALTER TABLE signing_confirmations ENABLE ROW LEVEL SECURITY;

-- Drop if they exist from a previous attempt
DROP POLICY IF EXISTS "Users can view confirmations for their contracts" ON signing_confirmations;
DROP POLICY IF EXISTS "Users can insert their own confirmations" ON signing_confirmations;
DROP POLICY IF EXISTS "Users can update their own confirmations" ON signing_confirmations;

-- SELECT: Users can read confirmations for contracts they uploaded or are recipients of
CREATE POLICY "Users can view confirmations for their contracts"
    ON signing_confirmations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM uploaded_contracts uc
            WHERE uc.contract_id = signing_confirmations.contract_id
            AND uc.uploaded_by_user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM qc_recipients qr
            JOIN quick_contracts qc ON qc.quick_contract_id = qr.quick_contract_id
            WHERE qc.source_contract_id = signing_confirmations.contract_id
            AND qr.user_id = auth.uid()
        )
    );

-- INSERT: Users can insert their own confirmations
CREATE POLICY "Users can insert their own confirmations"
    ON signing_confirmations
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND (
            EXISTS (
                SELECT 1 FROM uploaded_contracts uc
                WHERE uc.contract_id = signing_confirmations.contract_id
                AND uc.uploaded_by_user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM qc_recipients qr
                JOIN quick_contracts qc ON qc.quick_contract_id = qr.quick_contract_id
                WHERE qc.source_contract_id = signing_confirmations.contract_id
                AND qr.user_id = auth.uid()
            )
        )
    );

-- UPDATE: Users can update their own confirmations only
CREATE POLICY "Users can update their own confirmations"
    ON signing_confirmations
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 2. ALTER contract_signatures — add confirmation_id reference
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'contract_signatures'
        AND column_name = 'confirmation_id'
    ) THEN
        ALTER TABLE contract_signatures
            ADD COLUMN confirmation_id UUID REFERENCES signing_confirmations(confirmation_id);
    END IF;
END $$;

-- ============================================================================
-- 3. RLS POLICIES FOR contract_signatures
-- ============================================================================

ALTER TABLE contract_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view signatures for their contracts" ON contract_signatures;
DROP POLICY IF EXISTS "Users can insert their own signatures" ON contract_signatures;

-- SELECT: Users can read signatures for contracts they are party to
CREATE POLICY "Users can view signatures for their contracts"
    ON contract_signatures
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM uploaded_contracts uc
            WHERE uc.contract_id = contract_signatures.contract_id
            AND uc.uploaded_by_user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM qc_recipients qr
            JOIN quick_contracts qc ON qc.quick_contract_id = qr.quick_contract_id
            WHERE qc.source_contract_id = contract_signatures.contract_id
            AND qr.user_id = auth.uid()
        )
    );

-- INSERT: Users can insert their own signatures
CREATE POLICY "Users can insert their own signatures"
    ON contract_signatures
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND (
            EXISTS (
                SELECT 1 FROM uploaded_contracts uc
                WHERE uc.contract_id = contract_signatures.contract_id
                AND uc.uploaded_by_user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM qc_recipients qr
                JOIN quick_contracts qc ON qc.quick_contract_id = qr.quick_contract_id
                WHERE qc.source_contract_id = contract_signatures.contract_id
                AND qr.user_id = auth.uid()
            )
        )
    );

-- ============================================================================
-- 4. INDEXES for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_signing_confirmations_contract
    ON signing_confirmations(contract_id);

CREATE INDEX IF NOT EXISTS idx_signing_confirmations_user
    ON signing_confirmations(user_id);

CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract
    ON contract_signatures(contract_id);

CREATE INDEX IF NOT EXISTS idx_contract_signatures_confirmation
    ON contract_signatures(confirmation_id);
