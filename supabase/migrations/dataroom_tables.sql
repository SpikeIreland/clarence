-- ============================================================================
-- DATA ROOM MIGRATION
-- Creates all tables for the Investment Data Room feature
-- ============================================================================

-- ============================================================================
-- 1. dataroom_investors
-- Investor profiles linked to auth.users
-- ============================================================================

CREATE TABLE IF NOT EXISTS dataroom_investors (
    investor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company_name TEXT,
    tier TEXT NOT NULL DEFAULT 'all' CHECK (tier IN ('all', 'tier_2', 'tier_3')),
    status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended', 'revoked')),
    invited_by UUID REFERENCES auth.users(id),
    notes TEXT,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================================================
-- 2. dataroom_categories
-- Document categories with display ordering
-- ============================================================================

CREATE TABLE IF NOT EXISTS dataroom_categories (
    category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    min_tier TEXT NOT NULL DEFAULT 'all' CHECK (min_tier IN ('all', 'tier_2', 'tier_3')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. dataroom_documents
-- Document metadata (files stored in Supabase Storage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS dataroom_documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES dataroom_categories(category_id),
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size_bytes BIGINT,
    version INTEGER NOT NULL DEFAULT 1,
    visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'investor')),
    uploaded_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. dataroom_investor_access
-- Granular access control: which investors can see which categories
-- ============================================================================

CREATE TABLE IF NOT EXISTS dataroom_investor_access (
    access_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES dataroom_investors(investor_id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES dataroom_categories(category_id) ON DELETE CASCADE,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE(investor_id, category_id)
);

-- ============================================================================
-- 5. dataroom_access_logs
-- Audit trail: every view and download tracked
-- ============================================================================

CREATE TABLE IF NOT EXISTS dataroom_access_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES dataroom_investors(investor_id),
    document_id UUID REFERENCES dataroom_documents(document_id),
    action TEXT NOT NULL CHECK (action IN ('viewed', 'downloaded', 'login', 'logout')),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. dataroom_sessions
-- Investor visit sessions for engagement tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS dataroom_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES dataroom_investors(investor_id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    documents_viewed INTEGER NOT NULL DEFAULT 0,
    total_time_seconds INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================================
-- 7. dataroom_expense_categories
-- Categories for expense tracking (internal tool)
-- ============================================================================

CREATE TABLE IF NOT EXISTS dataroom_expense_categories (
    expense_category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. dataroom_expenses
-- Individual expense entries (internal only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS dataroom_expenses (
    expense_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_category_id UUID NOT NULL REFERENCES dataroom_expense_categories(expense_category_id),
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'GBP',
    description TEXT NOT NULL,
    expense_date DATE NOT NULL,
    receipt_path TEXT,
    entered_by UUID NOT NULL REFERENCES auth.users(id),
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    recurring_frequency TEXT CHECK (recurring_frequency IN ('monthly', 'quarterly', 'annually')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 9. dataroom_financial_entries
-- Curated financial model data (investor-facing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS dataroom_financial_entries (
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_type TEXT NOT NULL CHECK (entry_type IN (
        'revenue_projection', 'cost_projection', 'unit_economics',
        'runway', 'use_of_funds', 'kpi', 'custom'
    )),
    label TEXT NOT NULL,
    period TEXT,
    value DECIMAL(15,2),
    unit TEXT,
    notes TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_visible_to_investors BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE dataroom_investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataroom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataroom_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataroom_investor_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataroom_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataroom_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataroom_expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataroom_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataroom_financial_entries ENABLE ROW LEVEL SECURITY;

-- Investors can view their own profile
CREATE POLICY "Investors can view own profile"
    ON dataroom_investors FOR SELECT
    USING (user_id = auth.uid());

-- Anyone can view active categories
CREATE POLICY "Anyone can view active categories"
    ON dataroom_categories FOR SELECT
    USING (is_active = true);

-- Investors see documents in categories they have access to
CREATE POLICY "Investors can view accessible documents"
    ON dataroom_documents FOR SELECT
    USING (
        visibility = 'investor'
        AND is_active = true
        AND EXISTS (
            SELECT 1 FROM dataroom_investor_access dia
            JOIN dataroom_investors di ON di.investor_id = dia.investor_id
            WHERE dia.category_id = dataroom_documents.category_id
            AND di.user_id = auth.uid()
            AND di.status = 'active'
            AND (dia.expires_at IS NULL OR dia.expires_at > NOW())
        )
    );

-- Investors can view their own access grants
CREATE POLICY "Investors can view own access"
    ON dataroom_investor_access FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM dataroom_investors
            WHERE investor_id = dataroom_investor_access.investor_id
            AND user_id = auth.uid()
        )
    );

-- Investors can insert their own access logs
CREATE POLICY "Investors can insert own access logs"
    ON dataroom_access_logs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM dataroom_investors
            WHERE investor_id = dataroom_access_logs.investor_id
            AND user_id = auth.uid()
        )
    );

-- Investors can manage their own sessions
CREATE POLICY "Investors can view own sessions"
    ON dataroom_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM dataroom_investors
            WHERE investor_id = dataroom_sessions.investor_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Investors can insert own sessions"
    ON dataroom_sessions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM dataroom_investors
            WHERE investor_id = dataroom_sessions.investor_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Investors can update own sessions"
    ON dataroom_sessions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM dataroom_investors
            WHERE investor_id = dataroom_sessions.investor_id
            AND user_id = auth.uid()
        )
    );

-- Investors can view published financial entries
CREATE POLICY "Investors can view published financial entries"
    ON dataroom_financial_entries FOR SELECT
    USING (
        is_visible_to_investors = true
        AND EXISTS (
            SELECT 1 FROM dataroom_investors
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

-- Expense tables: no public policies (admin uses service role client)

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_dataroom_investors_user_id ON dataroom_investors(user_id);
CREATE INDEX IF NOT EXISTS idx_dataroom_investors_status ON dataroom_investors(status);
CREATE INDEX IF NOT EXISTS idx_dataroom_documents_category ON dataroom_documents(category_id);
CREATE INDEX IF NOT EXISTS idx_dataroom_documents_visibility ON dataroom_documents(visibility);
CREATE INDEX IF NOT EXISTS idx_dataroom_investor_access_investor ON dataroom_investor_access(investor_id);
CREATE INDEX IF NOT EXISTS idx_dataroom_investor_access_category ON dataroom_investor_access(category_id);
CREATE INDEX IF NOT EXISTS idx_dataroom_access_logs_investor ON dataroom_access_logs(investor_id);
CREATE INDEX IF NOT EXISTS idx_dataroom_access_logs_document ON dataroom_access_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_dataroom_access_logs_created ON dataroom_access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_dataroom_sessions_investor ON dataroom_sessions(investor_id);
CREATE INDEX IF NOT EXISTS idx_dataroom_expenses_category ON dataroom_expenses(expense_category_id);
CREATE INDEX IF NOT EXISTS idx_dataroom_expenses_date ON dataroom_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_dataroom_financial_entries_type ON dataroom_financial_entries(entry_type);

-- ============================================================================
-- SEED DATA: Default expense categories
-- ============================================================================

INSERT INTO dataroom_expense_categories (name, description, display_order) VALUES
    ('Claude API', 'Anthropic API usage costs', 1),
    ('Hosting', 'Vercel, Supabase, domain costs', 2),
    ('Development', 'Development tools, licenses, contractors', 3),
    ('Legal', 'Legal fees, company formation, IP protection', 4),
    ('Marketing', 'Marketing and outreach costs', 5),
    ('Operations', 'General operational expenses', 6),
    ('N8N', 'N8N workflow hosting and usage', 7),
    ('Resend', 'Email service costs', 8),
    ('Other', 'Miscellaneous expenses', 9)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SEED DATA: Default document categories
-- ============================================================================

INSERT INTO dataroom_categories (name, slug, description, display_order, min_tier) VALUES
    ('Executive Summary', 'executive-summary', 'One-page company overview', 1, 'all'),
    ('Pitch Deck', 'pitch-deck', 'Investor presentation', 2, 'all'),
    ('Financial Model', 'financial-model', 'Revenue projections and unit economics', 3, 'all'),
    ('Go-To-Market Strategy', 'go-to-market', 'Market entry and growth strategy', 4, 'all'),
    ('Product Demo', 'product-demo', 'Product walkthrough and recordings', 5, 'all'),
    ('The Clarence Bible', 'the-bible', 'Governing architecture document', 6, 'tier_2'),
    ('Technical Architecture', 'technical-architecture', 'System design and engineering', 7, 'tier_2'),
    ('The Algorithm', 'the-algorithm', 'Negotiation algorithm specification', 8, 'tier_2'),
    ('Features Register', 'features-register', 'Complete feature catalogue', 9, 'tier_2'),
    ('Certificate of Incorporation', 'incorporation', 'Companies House documents', 10, 'tier_2'),
    ('Articles of Association', 'articles', 'Company articles', 11, 'tier_2'),
    ('IP Register', 'ip-register', 'Intellectual property assets', 12, 'tier_2'),
    ('Shareholder Agreement', 'shareholder-agreement', 'Shareholder terms', 13, 'tier_3'),
    ('Market Analysis', 'market-analysis', 'Legal tech market sizing', 14, 'all'),
    ('Client Interest', 'client-interest', 'Traction and pipeline evidence', 15, 'tier_2'),
    ('Partnership Opportunities', 'partnerships', 'Strategic relationships', 16, 'tier_2'),
    ('Founder Profiles', 'founders', 'Team backgrounds', 17, 'all'),
    ('Advisory Board', 'advisory', 'Advisory board members', 18, 'tier_2')
ON CONFLICT (slug) DO NOTHING;
