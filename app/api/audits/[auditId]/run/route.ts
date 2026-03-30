// ============================================================================
// FILE: app/api/audits/[auditId]/run/route.ts
// PURPOSE: Runs an alignment audit — calculates compliance + generates AI narratives
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAlignmentAudit, type AlignmentReportResult } from '@/lib/alignment-engine'
import { normaliseCategory, type PlaybookRule, type ContractClause } from '@/lib/playbook-compliance'

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

        // 5. Filter rules to focus categories
        const focusCategories: string[] = audit.focus_categories || []
        const focusSet = new Set(focusCategories)
        const allRules = rulesData as PlaybookRule[]
        const filteredRules = focusSet.size > 0
            ? allRules.filter(r => focusSet.has(normaliseCategory(r.category)))
            : allRules

        // 6. Load template clauses
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

        const clauses: ContractClause[] = clausesData.map(normaliseClauseRow)

        // 7. Run the alignment engine (with AI narratives)
        console.log(`[Audit Run] Starting audit ${auditId}: ${filteredRules.length} rules, ${clauses.length} clauses, ${focusCategories.length} focus categories`)

        let result: AlignmentReportResult
        try {
            result = await runAlignmentAudit(
                filteredRules,
                clauses,
                focusCategories,
                perspective,
                audit.audit_name
            )
        } catch (engineError) {
            console.error('[Audit Run] Engine error, falling back to static:', engineError)
            // Fallback to static-only if AI fails
            result = await runAlignmentAudit(
                filteredRules,
                clauses,
                focusCategories,
                perspective,
                audit.audit_name,
                { skipAI: true }
            )
        }

        console.log(`[Audit Run] Complete: score=${result.compliance.overallScore}%, ${result.narratives.length} narratives generated`)

        // 8. Save results
        const { error: updateError } = await supabase
            .from('alignment_audits')
            .update({
                status: 'complete',
                overall_score: result.compliance.overallScore,
                results: result as unknown as Record<string, unknown>,
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
            overallScore: result.compliance.overallScore,
            categoriesAssessed: result.narratives.length,
            alignedCount: result.alignedCount,
            partialCount: result.partialCount,
            materialGapCount: result.materialGapCount,
            executiveSummary: result.executiveSummary,
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
