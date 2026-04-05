// ============================================================================
// FILE: app/api/audits/[auditId]/run/route.ts
// PURPOSE: Runs an alignment audit — clause-centric compliance + AI narratives
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    runAlignmentAudit,
    runClauseCentricAlignmentAudit,
    type AlignmentReportResult,
    type ClauseCentricAlignmentResult,
} from '@/lib/alignment-engine'
import {
    normaliseCategory,
    type PlaybookRule,
    type ContractClause,
    type AuditClause,
} from '@/lib/playbook-compliance'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseClauseRow(raw: Record<string, any>): ContractClause {
    return {
        clause_id: raw.template_clause_id || raw.id || '',
        clause_name: raw.clause_name || 'Untitled',
        category: raw.category_name || raw.category || 'Other',
        clarence_position: raw.clarence_position ?? null,
        initiator_position: raw.default_customer_position_override ?? null,
        respondent_position: raw.default_provider_position_override ?? null,
        customer_position: raw.default_customer_position_override ?? null,
        is_header: false,
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseAuditClauseRow(raw: Record<string, any>): AuditClause {
    return {
        clause_id: raw.template_clause_id || raw.id || '',
        clause_number: raw.clause_number || null,
        clause_name: raw.clause_name || 'Untitled',
        category: raw.category_name || raw.category || 'Other',
        content: raw.default_text || null,
        clarence_position: raw.clarence_position ?? null,
        clarence_assessment: raw.clarence_assessment || null,
        clarence_summary: raw.clarence_summary || null,
        clarence_fairness: raw.clarence_fairness || null,
        range_mapping: raw.range_mapping || null,
        is_header: raw.is_header || false,
        display_order: raw.display_order ?? null,
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ auditId: string }> }
) {
    const { auditId } = await params

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    try {
        // 1. Fetch the audit record
        const { data: audit, error: auditError } = await supabase
            .from('alignment_audits')
            .select('*')
            .eq('audit_id', auditId)
            .single()

        if (auditError || !audit) {
            return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
        }

        // 2. Mark as running
        await supabase
            .from('alignment_audits')
            .update({ status: 'running', started_at: new Date().toISOString() })
            .eq('audit_id', auditId)

        // 3. Load playbook metadata
        const { data: playbook } = await supabase
            .from('company_playbooks')
            .select('playbook_perspective')
            .eq('playbook_id', audit.playbook_id)
            .single()

        const perspective = playbook?.playbook_perspective || 'customer'

        // 4. Load playbook rules
        const { data: rulesData, error: rulesError } = await supabase
            .from('playbook_rules')
            .select('*')
            .eq('playbook_id', audit.playbook_id)
            .eq('is_active', true)
            .order('category')
            .order('display_order', { ascending: true })

        if (rulesError || !rulesData || rulesData.length === 0) {
            await supabase
                .from('alignment_audits')
                .update({
                    status: 'failed',
                    error_message: 'No active playbook rules found',
                })
                .eq('audit_id', auditId)
            return NextResponse.json({ error: 'No active playbook rules found' }, { status: 400 })
        }

        // 5. Focus categories
        const focusCategories: string[] = audit.focus_categories || []
        const allRules = rulesData as PlaybookRule[]

        // 6. Load template clauses (full data for clause-centric audit)
        const { data: clausesData, error: clausesError } = await supabase
            .from('template_clauses')
            .select('*')
            .eq('template_id', audit.template_id)
            .order('display_order', { ascending: true })

        if (clausesError || !clausesData || clausesData.length === 0) {
            await supabase
                .from('alignment_audits')
                .update({
                    status: 'failed',
                    error_message: 'No template clauses found',
                })
                .eq('audit_id', auditId)
            return NextResponse.json({ error: 'No template clauses found' }, { status: 400 })
        }

        // 7. Load existing clause-rule mappings from playbook_rule_clause_map
        // Use .neq('status', 'rejected') instead of .in() for broader compatibility
        const { data: existingMappings, error: mappingsError } = await supabase
            .from('playbook_rule_clause_map')
            .select('playbook_rule_id, template_clause_id, match_method, match_confidence, match_reason')
            .eq('template_id', audit.template_id)
            .eq('playbook_id', audit.playbook_id)
            .neq('status', 'rejected')

        if (mappingsError) {
            console.error(`[Audit Run] Mappings query error:`, mappingsError)
        }
        console.log(`[Audit Run] Loaded ${existingMappings?.length ?? 0} existing mappings for template=${audit.template_id}`)

        // 8. If no mappings exist, try to generate them via the RPC function
        let mappingsToUse = existingMappings || []
        if (mappingsToUse.length === 0) {
            console.log(`[Audit Run] No existing mappings — invoking map_playbook_rules_to_template_clauses RPC`)
            try {
                const { data: rpcResult } = await supabase.rpc('map_playbook_rules_to_template_clauses', {
                    p_template_id: audit.template_id,
                    p_playbook_id: audit.playbook_id,
                })
                if (rpcResult && Array.isArray(rpcResult)) {
                    mappingsToUse = rpcResult
                } else {
                    // Re-fetch from table in case the RPC inserted them
                    const { data: freshMappings, error: freshError } = await supabase
                        .from('playbook_rule_clause_map')
                        .select('playbook_rule_id, template_clause_id, match_method, match_confidence, match_reason')
                        .eq('template_id', audit.template_id)
                        .eq('playbook_id', audit.playbook_id)
                        .neq('status', 'rejected')
                    if (freshError) console.error(`[Audit Run] Fresh mappings query error:`, freshError)
                    mappingsToUse = freshMappings || []
                }
            } catch (rpcError) {
                console.warn('[Audit Run] RPC mapping failed, falling back to dynamic matching:', rpcError)
                // Dynamic matching will happen inside runClauseCentricAudit
            }
        }

        // 9. Build AuditClause array (rich clause data) and legacy ContractClause array
        const auditClauses: AuditClause[] = clausesData.map(normaliseAuditClauseRow)
        const legacyClauses: ContractClause[] = clausesData.map(normaliseClauseRow)

        // 10. Run the clause-centric alignment engine
        console.log(`[Audit Run] Starting clause-centric audit ${auditId}: ${allRules.length} rules, ${auditClauses.length} clauses, ${mappingsToUse.length} pre-existing mappings`)

        let clauseCentricResult: ClauseCentricAlignmentResult
        try {
            clauseCentricResult = await runClauseCentricAlignmentAudit(
                auditClauses,
                allRules,
                focusCategories,
                perspective,
                audit.audit_name,
                mappingsToUse.length > 0 ? mappingsToUse : undefined
            )
        } catch (engineError) {
            console.error('[Audit Run] Clause-centric engine error, falling back to static:', engineError)
            clauseCentricResult = await runClauseCentricAlignmentAudit(
                auditClauses,
                allRules,
                focusCategories,
                perspective,
                audit.audit_name,
                mappingsToUse.length > 0 ? mappingsToUse : undefined,
                { skipAI: true }
            )
        }

        // 11. Also run the legacy category-based engine (for backward compatibility)
        const focusSet = new Set(focusCategories)
        const filteredRules = focusSet.size > 0
            ? allRules.filter(r => focusSet.has(normaliseCategory(r.category)))
            : allRules

        let legacyResult: AlignmentReportResult
        try {
            legacyResult = await runAlignmentAudit(
                filteredRules,
                legacyClauses,
                focusCategories,
                perspective,
                audit.audit_name,
                { skipAI: true } // Skip AI for legacy — clause-centric has the narratives
            )
        } catch {
            // Legacy failure is non-critical
            legacyResult = await runAlignmentAudit(
                filteredRules,
                legacyClauses,
                focusCategories,
                perspective,
                audit.audit_name,
                { skipAI: true }
            )
        }

        const { auditSummary } = clauseCentricResult

        console.log(`[Audit Run] Complete: clauseScore=${auditSummary.overallScore}%, ${auditSummary.clausesAssessed} clauses assessed, ${clauseCentricResult.clauseNarratives.length} narratives`)

        // 12. Save results — store both clause-centric and legacy for transition
        const combinedResults = {
            // New clause-centric data (primary)
            clauseCentric: clauseCentricResult,
            // Legacy category data (backward compat)
            legacy: legacyResult,
            // Use clause-centric score as the canonical score
            overallScore: auditSummary.overallScore,
        }

        const { error: updateError } = await supabase
            .from('alignment_audits')
            .update({
                status: 'complete',
                overall_score: auditSummary.overallScore,
                results: combinedResults as unknown as Record<string, unknown>,
                completed_at: new Date().toISOString(),
            })
            .eq('audit_id', auditId)

        if (updateError) {
            console.error('[Audit Run] Failed to save results:', updateError)
            return NextResponse.json({ error: 'Failed to save results' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            auditId,
            overallScore: auditSummary.overallScore,
            clausesAssessed: auditSummary.clausesAssessed,
            totalClauses: auditSummary.totalClauses,
            totalRules: auditSummary.totalRules,
            alignedCount: auditSummary.alignedCount,
            partialCount: auditSummary.partialCount,
            materialGapCount: auditSummary.materialGapCount,
            redLineBreaches: auditSummary.redLineBreaches,
            unmatchedClauses: auditSummary.unmatchedClauses.length,
            unmatchedRules: auditSummary.unmatchedRules.length,
            executiveSummary: clauseCentricResult.executiveSummary,
        })

    } catch (error) {
        console.error('[Audit Run] Unhandled error:', error)

        // Mark as failed
        await supabase
            .from('alignment_audits')
            .update({
                status: 'failed',
                error_message: error instanceof Error ? error.message : 'Unknown error',
            })
            .eq('audit_id', auditId)

        return NextResponse.json({ error: 'Audit run failed' }, { status: 500 })
    }
}
