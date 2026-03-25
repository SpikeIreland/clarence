-- ============================================================================
-- PLAYBOOK RULE → TEMPLATE CLAUSE MAPPING
-- Creates the table that links playbook rules to specific clauses in a
-- company template, and the function that auto-populates it.
--
-- Called from: company-admin mapping page + company-admin template list
--   supabase.rpc('map_playbook_rules_to_template_clauses', {
--       template_id, playbook_id, replace_existing
--   })
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: playbook_rule_clause_map
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.playbook_rule_clause_map (
    mapping_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id         UUID        NOT NULL REFERENCES public.contract_templates(template_id)   ON DELETE CASCADE,
    playbook_id         UUID        NOT NULL REFERENCES public.company_playbooks(playbook_id)    ON DELETE CASCADE,
    playbook_rule_id    UUID        NOT NULL REFERENCES public.playbook_rules(rule_id)           ON DELETE CASCADE,
    template_clause_id  UUID        NOT NULL REFERENCES public.template_clauses(template_clause_id) ON DELETE CASCADE,
    -- auto_exact | auto_containment | auto_category | manual
    match_method        VARCHAR     NOT NULL DEFAULT 'manual',
    -- 0–100
    match_confidence    INTEGER     NOT NULL DEFAULT 100,
    match_reason        TEXT,
    -- unconfirmed | confirmed | rejected | remapped
    status              VARCHAR     NOT NULL DEFAULT 'unconfirmed',
    confirmed_by        UUID        REFERENCES public.users(user_id),
    confirmed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active mapping per rule per template (allow multiple rows, but only one non-rejected)
CREATE INDEX IF NOT EXISTS idx_prcm_template_playbook
    ON public.playbook_rule_clause_map(template_id, playbook_id);

CREATE INDEX IF NOT EXISTS idx_prcm_rule
    ON public.playbook_rule_clause_map(playbook_rule_id);

-- ----------------------------------------------------------------------------
-- FUNCTION: map_playbook_rules_to_template_clauses
--
-- Matches playbook rules to template clauses using three tiers:
--   1. Exact name match        (confidence 100, method auto_exact)
--   2. Name containment match  (confidence 75,  method auto_containment)
--   3. Category match          (confidence 50,  method auto_category)
--
-- Skips rules that already have a non-rejected mapping unless replace_existing=true.
-- Returns one summary row.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.map_playbook_rules_to_template_clauses(
    p_template_id       UUID,
    p_playbook_id       UUID,
    p_replace_existing  BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    rules_total         INT,
    rules_mapped        INT,
    rules_unmapped      INT,
    exact_matches       INT,
    containment_matches INT,
    category_matches    INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exact       INT := 0;
    v_containment INT := 0;
    v_category    INT := 0;
    v_total       INT;
    v_mapped      INT;
BEGIN
    -- Optionally clear unconfirmed/unconfirmed mappings before re-running
    IF p_replace_existing THEN
        DELETE FROM public.playbook_rule_clause_map
        WHERE template_id  = p_template_id
          AND playbook_id  = p_playbook_id
          AND status NOT IN ('confirmed');
    END IF;

    -- -------------------------------------------------------------------------
    -- TIER 1: Exact name match
    -- -------------------------------------------------------------------------
    INSERT INTO public.playbook_rule_clause_map (
        template_id, playbook_id, playbook_rule_id, template_clause_id,
        match_method, match_confidence, match_reason, status
    )
    SELECT
        p_template_id,
        p_playbook_id,
        r.rule_id,
        tc.template_clause_id,
        'auto_exact',
        100,
        'Exact clause name match',
        'unconfirmed'
    FROM public.playbook_rules r
    JOIN public.template_clauses tc
        ON tc.template_id = p_template_id
       AND LOWER(TRIM(r.clause_name)) = LOWER(TRIM(tc.clause_name))
    WHERE r.playbook_id = p_playbook_id
      AND r.is_active   = TRUE
      AND NOT EXISTS (
          SELECT 1
          FROM public.playbook_rule_clause_map m
          WHERE m.template_id      = p_template_id
            AND m.playbook_rule_id = r.rule_id
            AND m.status          != 'rejected'
      );

    GET DIAGNOSTICS v_exact = ROW_COUNT;

    -- -------------------------------------------------------------------------
    -- TIER 2: Name containment — one best match per rule
    -- -------------------------------------------------------------------------
    INSERT INTO public.playbook_rule_clause_map (
        template_id, playbook_id, playbook_rule_id, template_clause_id,
        match_method, match_confidence, match_reason, status
    )
    SELECT
        p_template_id,
        p_playbook_id,
        best.rule_id,
        best.template_clause_id,
        'auto_containment',
        best.confidence,
        best.reason,
        'unconfirmed'
    FROM (
        SELECT DISTINCT ON (r.rule_id)
            r.rule_id,
            tc.template_clause_id,
            CASE
                WHEN LOWER(tc.clause_name) LIKE '%' || LOWER(r.clause_name) || '%' THEN 75
                ELSE 70
            END AS confidence,
            CASE
                WHEN LOWER(tc.clause_name) LIKE '%' || LOWER(r.clause_name) || '%'
                    THEN 'Template clause name contains rule name'
                ELSE 'Rule name contains template clause name'
            END AS reason
        FROM public.playbook_rules r
        JOIN public.template_clauses tc
            ON tc.template_id = p_template_id
           AND LENGTH(TRIM(r.clause_name)) >= 3
           AND LOWER(TRIM(r.clause_name)) != LOWER(TRIM(tc.clause_name))  -- exclude exact matches
           AND (
               LOWER(tc.clause_name) LIKE '%' || LOWER(r.clause_name) || '%'
               OR LOWER(r.clause_name) LIKE '%' || LOWER(tc.clause_name) || '%'
           )
        WHERE r.playbook_id = p_playbook_id
          AND r.is_active   = TRUE
          AND NOT EXISTS (
              SELECT 1
              FROM public.playbook_rule_clause_map m
              WHERE m.template_id      = p_template_id
                AND m.playbook_rule_id = r.rule_id
                AND m.status          != 'rejected'
          )
        ORDER BY r.rule_id,
                 -- prefer template-contains-rule over rule-contains-template
                 CASE WHEN LOWER(tc.clause_name) LIKE '%' || LOWER(r.clause_name) || '%' THEN 0 ELSE 1 END,
                 tc.display_order
    ) best;

    GET DIAGNOSTICS v_containment = ROW_COUNT;

    -- -------------------------------------------------------------------------
    -- TIER 3: Category match — one best match per rule (lowest display_order)
    -- -------------------------------------------------------------------------
    INSERT INTO public.playbook_rule_clause_map (
        template_id, playbook_id, playbook_rule_id, template_clause_id,
        match_method, match_confidence, match_reason, status
    )
    SELECT
        p_template_id,
        p_playbook_id,
        best.rule_id,
        best.template_clause_id,
        'auto_category',
        50,
        'Matching clause category',
        'unconfirmed'
    FROM (
        SELECT DISTINCT ON (r.rule_id)
            r.rule_id,
            tc.template_clause_id
        FROM public.playbook_rules r
        JOIN public.template_clauses tc
            ON tc.template_id  = p_template_id
           AND tc.category     IS NOT NULL
           AND r.category      IS NOT NULL
           AND LOWER(TRIM(r.category)) = LOWER(TRIM(tc.category))
           AND (tc.is_header IS NULL OR tc.is_header = FALSE)
        WHERE r.playbook_id = p_playbook_id
          AND r.is_active   = TRUE
          AND NOT EXISTS (
              SELECT 1
              FROM public.playbook_rule_clause_map m
              WHERE m.template_id      = p_template_id
                AND m.playbook_rule_id = r.rule_id
                AND m.status          != 'rejected'
          )
        ORDER BY r.rule_id, tc.display_order
    ) best;

    GET DIAGNOSTICS v_category = ROW_COUNT;

    -- -------------------------------------------------------------------------
    -- Summary
    -- -------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_total
    FROM public.playbook_rules
    WHERE playbook_id = p_playbook_id
      AND is_active   = TRUE;

    SELECT COUNT(DISTINCT playbook_rule_id) INTO v_mapped
    FROM public.playbook_rule_clause_map
    WHERE template_id = p_template_id
      AND playbook_id = p_playbook_id
      AND status     != 'rejected';

    RETURN QUERY SELECT
        v_total,
        v_mapped,
        v_total - v_mapped,
        v_exact,
        v_containment,
        v_category;
END;
$$;

-- Allow authenticated users to call the function
GRANT EXECUTE ON FUNCTION public.map_playbook_rules_to_template_clauses(UUID, UUID, BOOLEAN)
    TO authenticated;
