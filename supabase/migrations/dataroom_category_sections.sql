-- ============================================================================
-- DATA ROOM CATEGORY SECTIONS MIGRATION
-- Adds section grouping to categories and new categories based on the Bible
-- Also adds source column to expenses for future API integration
-- ============================================================================

-- Add section column to categories
ALTER TABLE dataroom_categories
  ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'the_investment_case'
    CHECK (section IN (
      'the_investment_case', 'the_company', 'the_product',
      'legal_corporate', 'full_disclosure', 'internal'
    ));

-- Add internal-only flag
ALTER TABLE dataroom_categories
  ADD COLUMN IF NOT EXISTS is_internal_only BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- Update existing categories with section assignments
-- ============================================================================

-- Section 1: The Investment Case
UPDATE dataroom_categories SET section = 'the_investment_case', display_order = 1 WHERE slug = 'executive-summary';
UPDATE dataroom_categories SET section = 'the_investment_case', display_order = 2 WHERE slug = 'pitch-deck';
UPDATE dataroom_categories SET section = 'the_investment_case', display_order = 3 WHERE slug = 'financial-model';
UPDATE dataroom_categories SET section = 'the_investment_case', display_order = 4 WHERE slug = 'founders';

-- Section 2: The Company
UPDATE dataroom_categories SET section = 'the_company', display_order = 6 WHERE slug = 'go-to-market';
UPDATE dataroom_categories SET section = 'the_company', display_order = 7 WHERE slug = 'market-analysis';
UPDATE dataroom_categories SET section = 'the_company', display_order = 8 WHERE slug = 'client-interest';

-- Section 3: The Product
UPDATE dataroom_categories SET section = 'the_product', display_order = 10 WHERE slug = 'the-bible';
UPDATE dataroom_categories SET section = 'the_product', display_order = 11 WHERE slug = 'technical-architecture';
UPDATE dataroom_categories SET section = 'the_product', display_order = 12 WHERE slug = 'the-algorithm';
UPDATE dataroom_categories SET section = 'the_product', display_order = 13 WHERE slug = 'features-register';
UPDATE dataroom_categories SET section = 'the_product', display_order = 14 WHERE slug = 'product-demo';

-- Section 4: Legal & Corporate
UPDATE dataroom_categories SET section = 'legal_corporate', display_order = 17 WHERE slug = 'incorporation';
UPDATE dataroom_categories SET section = 'legal_corporate', display_order = 18 WHERE slug = 'articles';
UPDATE dataroom_categories SET section = 'legal_corporate', display_order = 19 WHERE slug = 'ip-register';
UPDATE dataroom_categories SET section = 'legal_corporate', display_order = 20 WHERE slug = 'partnerships';

-- Section 5: Full Disclosure
UPDATE dataroom_categories SET section = 'full_disclosure', display_order = 22 WHERE slug = 'shareholder-agreement';
UPDATE dataroom_categories SET section = 'full_disclosure', display_order = 23 WHERE slug = 'advisory';

-- ============================================================================
-- Insert new categories
-- ============================================================================

-- The Clarence Charter (Section 2: The Company)
INSERT INTO dataroom_categories (name, slug, description, display_order, min_tier, section)
VALUES ('The Clarence Charter', 'the-charter', 'Identity, values, purpose — Chapter 1 of the Bible', 5, 'all', 'the_company')
ON CONFLICT (slug) DO NOTHING;

-- Technology Stack (Section 3: The Product)
INSERT INTO dataroom_categories (name, slug, description, display_order, min_tier, section)
VALUES ('Technology Stack', 'technology-stack', 'Next.js, Supabase, N8N, Claude, Vercel, Antigravity', 15, 'tier_2', 'the_product')
ON CONFLICT (slug) DO NOTHING;

-- Focus Area Documents (Internal only)
INSERT INTO dataroom_categories (name, slug, description, display_order, min_tier, section, is_internal_only)
VALUES ('Focus Area Documents', 'focus-areas', 'The 24 FOCUS documents for platform capability tracking', 25, 'tier_3', 'internal', true)
ON CONFLICT (slug) DO NOTHING;

-- Handover Documents (Internal only)
INSERT INTO dataroom_categories (name, slug, description, display_order, min_tier, section, is_internal_only)
VALUES ('Handover Documents', 'handovers', 'Handover documentation for continuity', 26, 'tier_3', 'internal', true)
ON CONFLICT (slug) DO NOTHING;

-- N8N Workflow Registry (Internal only)
INSERT INTO dataroom_categories (name, slug, description, display_order, min_tier, section, is_internal_only)
VALUES ('N8N Workflow Registry', 'n8n-workflows', 'Workflow documentation and configurations', 27, 'tier_3', 'internal', true)
ON CONFLICT (slug) DO NOTHING;

-- Operational Playbooks (Internal only)
INSERT INTO dataroom_categories (name, slug, description, display_order, min_tier, section, is_internal_only)
VALUES ('Operational Playbooks', 'operational-playbooks', 'Internal processes and procedures', 28, 'tier_3', 'internal', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Add source column to expenses for future API integration
-- ============================================================================

ALTER TABLE dataroom_expenses
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'claude_api', 'vercel', 'supabase', 'n8n', 'resend'));
