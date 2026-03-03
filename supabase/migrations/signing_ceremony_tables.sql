-- ============================================================================
-- SIGNING CEREMONY MIGRATION
-- Run this in the Supabase SQL Editor
-- Creates: signing_confirmations table
-- Alters:  contract_signatures table (adds confirmation_id)
-- ============================================================================

-- ============================================================================
-- 1. CREATE signing_confirmations TABLE
-- Captures entity confirmation step (Step 1 of signing ceremony).
-- Both parties must complete this before signing can begin.
-- ============================================================================

CREATE TABLE IF NOT EXISTS signing_confirmations (
    confirmation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES uploaded_contracts(contract_id),
    user_id UUID NOT NULL,
    party_role TEXT NOT NULL CHECK (party_role IN ('initiator', 'respondent')),

    -- Entity details (confirmed by the party)
    entity_name TEXT NOT NULL,
    registration_number TEXT,
    jurisdiction TEXT,
    registered_address TEXT,

    -- Signatory details
    signatory_name TEXT NOT NULL,
    signatory_title TEXT NOT NULL,
    signatory_email TEXT NOT NULL,

    -- Metadata
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,

    -- Constraints: one confirmation per party per contract
    UNIQUE(contract_id, party_role)
);

-- ============================================================================
-- 2. RLS POLICIES FOR signing_confirmations
-- Users can only see/insert confirmations for contracts they are party to.
-- ============================================================================

ALTER TABLE signing_confirmations ENABLE ROW LEVEL SECURITY;

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
-- 3. ALTER contract_signatures — add confirmation_id reference
-- Links each signature back to the entity confirmation that preceded it.
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
-- 4. RLS POLICIES FOR contract_signatures (if not already set)
-- ============================================================================

ALTER TABLE contract_signatures ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
-- (wrapped in DO block to avoid errors if they don't exist)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view signatures for their contracts" ON contract_signatures;
    DROP POLICY IF EXISTS "Users can insert their own signatures" ON contract_signatures;
END $$;

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
-- 5. INDEXES for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_signing_confirmations_contract
    ON signing_confirmations(contract_id);

CREATE INDEX IF NOT EXISTS idx_signing_confirmations_user
    ON signing_confirmations(user_id);

CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract
    ON contract_signatures(contract_id);

CREATE INDEX IF NOT EXISTS idx_contract_signatures_confirmation
    ON contract_signatures(confirmation_id);
