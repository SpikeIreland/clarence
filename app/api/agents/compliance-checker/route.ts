// ============================================================================
// FILE: app/api/agents/compliance-checker/route.ts
// PURPOSE: API endpoint for the Playbook Compliance Agent
// PATTERN: Follows existing /api/agents/* route conventions
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkCompliance, type ComplianceCheckInput } from '@/lib/agents/compliance-checker'
import { findActivePlaybook } from '@/lib/playbook-loader'
import type { PlaybookRule } from '@/lib/playbook-compliance'


// ============================================================================
// SECTION 1: POST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
    try {
        const body: ComplianceCheckInput = await request.json()

        if (!body.clauseId || body.proposedPosition === undefined || !body.companyId) {
            return NextResponse.json(
                { error: 'clauseId, proposedPosition, and companyId are required', success: false },
                { status: 400 }
            )
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json(
                { error: 'Database configuration missing', success: false },
                { status: 500 }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        // Load active playbook for this company
        const playbook = await findActivePlaybook(body.companyId, body.contractTypeKey || null)

        if (!playbook) {
            // No playbook → always clear
            return NextResponse.json({
                success: true,
                result: {
                    severity: 'clear',
                    overallScore: 100,
                    previousScore: 100,
                    scoreDelta: 0,
                    breachedRules: [],
                    guidanceTips: [],
                    requiresApproval: false,
                    escalationContact: null,
                    escalationContactEmail: null,
                    resolvedBy: 'static',
                },
            })
        }

        // Fetch playbook rules
        const { data: rules, error: rulesError } = await supabase
            .from('playbook_rules')
            .select('*')
            .eq('playbook_id', playbook.playbook_id)
            .eq('is_active', true)

        if (rulesError || !rules || rules.length === 0) {
            console.warn('[ComplianceChecker API] No rules found for playbook:', playbook.playbook_id)
            return NextResponse.json({
                success: true,
                result: {
                    severity: 'clear',
                    overallScore: 100,
                    previousScore: 100,
                    scoreDelta: 0,
                    breachedRules: [],
                    guidanceTips: [],
                    requiresApproval: false,
                    escalationContact: null,
                    escalationContactEmail: null,
                    resolvedBy: 'static',
                },
            })
        }

        // Pass playbook perspective through to the compliance engine
        body.perspective = playbook.playbook_perspective || 'customer'

        console.log(`[ComplianceChecker API] Checking compliance for clause ${body.clauseId}`)
        console.log(`  Playbook: ${playbook.playbook_name} (${rules.length} rules, perspective: ${body.perspective})`)
        console.log(`  Proposed position: ${body.proposedPosition}, Current: ${body.currentPosition}`)

        const result = await checkCompliance(body, rules as PlaybookRule[])

        console.log(`[ComplianceChecker API] Result: severity=${result.severity}, score=${result.overallScore}, delta=${result.scoreDelta}`)

        // Persist compliance snapshot (non-blocking)
        supabase
            .from('compliance_snapshots')
            .insert({
                session_id: body.sessionId || null,
                contract_id: body.contractId || null,
                clause_id: body.clauseId,
                clause_name: body.clauseName,
                proposed_position: body.proposedPosition,
                previous_position: body.currentPosition,
                party: body.party,
                overall_score: result.overallScore,
                previous_score: result.previousScore,
                score_delta: result.scoreDelta,
                severity: result.severity,
                breached_rules: result.breachedRules,
                resolved_by: result.resolvedBy,
                agent_reasoning: result.reasoning || null,
                requires_approval: result.requiresApproval,
            })
            .then(({ error }) => {
                if (error) console.warn('[ComplianceChecker API] Snapshot insert failed:', error.message)
            })

        return NextResponse.json({ success: true, result })

    } catch (error) {
        console.error('[ComplianceChecker API] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error', success: false },
            { status: 500 }
        )
    }
}


// ============================================================================
// SECTION 2: OPTIONS HANDLER (CORS)
// ============================================================================

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    })
}
