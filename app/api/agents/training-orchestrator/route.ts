// ============================================================================
// FILE: app/api/agents/training-orchestrator/route.ts
// PURPOSE: API endpoint for the Training Orchestrator agent
// PATTERN: Follows existing /api/agents/* route conventions
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    assessUser,
    designScenario,
    generateAgent,
    type UserTrainingProfile,
    type TrainingSessionResult,
    type PlaybookContext,
} from '@/lib/agents/training-orchestrator'


// ============================================================================
// SECTION 1: POST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { action, userId, companyId, preferences } = body

        if (!action || !userId) {
            return NextResponse.json(
                { error: 'action and userId are required', success: false },
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

        // ------------------------------------------------------------------
        // ACTION: assess — Analyse user and return greeting + recommendation
        // ------------------------------------------------------------------
        if (action === 'assess') {
            console.log(`[TrainingOrchestrator API] Assessing user ${userId}`)

            const profile = await loadUserProfile(supabase, userId)
            const recentResults = await loadRecentResults(supabase, userId)

            const assessment = await assessUser(profile, recentResults)

            console.log(`[TrainingOrchestrator API] Assessment complete: level=${assessment.profileSummary.level}, suggested=${assessment.suggestedContractType}`)

            return NextResponse.json({ success: true, assessment })
        }

        // ------------------------------------------------------------------
        // ACTION: design — Design a scenario based on user profile
        // ------------------------------------------------------------------
        if (action === 'design') {
            console.log(`[TrainingOrchestrator API] Designing scenario for user ${userId}`)

            const profile = await loadUserProfile(supabase, userId)

            // Load playbook context if playbookId provided
            const enrichedPreferences = preferences ? { ...preferences } : {}
            if (body.playbookId) {
                const playbookContext = await loadPlaybookContext(supabase, body.playbookId)
                if (playbookContext) {
                    enrichedPreferences.playbookContext = playbookContext
                }
            }

            const scenario = await designScenario(profile, enrichedPreferences)

            console.log(`[TrainingOrchestrator API] Scenario designed: ${scenario.counterpartyCompany.name}, ${scenario.contractType}`)

            return NextResponse.json({ success: true, scenario })
        }

        // ------------------------------------------------------------------
        // ACTION: generate — Design scenario + generate full agent config
        // ------------------------------------------------------------------
        if (action === 'generate') {
            console.log(`[TrainingOrchestrator API] Full generation for user ${userId}`)

            const profile = await loadUserProfile(supabase, userId)

            // Load playbook context if playbookId provided
            const enrichedPreferences = preferences ? { ...preferences } : {}
            if (body.playbookId) {
                const playbookContext = await loadPlaybookContext(supabase, body.playbookId)
                if (playbookContext) {
                    enrichedPreferences.playbookContext = playbookContext
                    console.log(`[TrainingOrchestrator API] Playbook context loaded: ${playbookContext.playbookName} (${playbookContext.rules.length} rules)`)
                }
            }

            const scenario = await designScenario(profile, enrichedPreferences)
            const agentConfig = await generateAgent(scenario)

            // Store generated agent in database
            const { data: agentRow, error: insertError } = await supabase
                .from('generated_agents')
                .insert({
                    session_id: body.sessionId || '00000000-0000-0000-0000-000000000000', // Placeholder until session is created
                    persona: agentConfig.persona,
                    objectives: agentConfig.objectives,
                    leverage_inputs: agentConfig.leverageInputs,
                    leverage_result: agentConfig.leverageResult,
                    personality_traits: agentConfig.personalityTraits,
                    system_prompt: agentConfig.systemPrompt,
                    initial_positions: agentConfig.initialPositions,
                })
                .select('agent_id')
                .single()

            if (insertError) {
                console.error('[TrainingOrchestrator API] Failed to store agent:', insertError.message)
            } else {
                agentConfig.agentId = agentRow.agent_id
            }

            // Ensure/update user training profile
            await ensureUserProfile(supabase, userId, companyId)

            console.log(`[TrainingOrchestrator API] Agent generated: ${agentConfig.persona.name} (${agentConfig.personalityTraits.style}), agent_id=${agentConfig.agentId}`)

            return NextResponse.json({
                success: true,
                scenario,
                agentConfig: {
                    agentId: agentConfig.agentId,
                    persona: agentConfig.persona,
                    objectives: agentConfig.objectives,
                    leverageResult: agentConfig.leverageResult,
                    personalityTraits: agentConfig.personalityTraits,
                    initialPositions: agentConfig.initialPositions,
                    greetingMessage: agentConfig.greetingMessage,
                    // Exclude systemPrompt from client response (kept server-side)
                },
            })
        }

        // ------------------------------------------------------------------
        // ACTION: link — Link a generated agent to a session + write leverage
        // ------------------------------------------------------------------
        if (action === 'link') {
            const { agentId, sessionId, leverageResult } = body

            if (!agentId || !sessionId) {
                return NextResponse.json(
                    { error: 'agentId and sessionId are required', success: false },
                    { status: 400 }
                )
            }

            // Link the agent to the session
            const { error: linkError } = await supabase
                .from('generated_agents')
                .update({ session_id: sessionId })
                .eq('agent_id', agentId)

            if (linkError) {
                console.error('[TrainingOrchestrator API] Failed to link agent:', linkError.message)
                return NextResponse.json(
                    { error: 'Failed to link agent to session', success: false },
                    { status: 500 }
                )
            }

            // Write leverage scores if provided
            if (leverageResult?.customerLeverage != null) {
                const custLev = Math.round(leverageResult.customerLeverage)
                const provLev = Math.round(leverageResult.providerLeverage)

                // Update session baseline leverage
                await supabase
                    .from('sessions')
                    .update({
                        customer_leverage: custLev,
                        provider_leverage: provLev,
                        leverage_tracker_customer: custLev,
                        leverage_tracker_provider: provLev,
                    })
                    .eq('session_id', sessionId)

                // Insert leverage_calculations row so contract-studio API picks it up
                await supabase
                    .from('leverage_calculations')
                    .upsert({
                        session_id: sessionId,
                        bid_id: sessionId, // Use session_id as bid_id for training
                        leverage_type: 'master',
                        customer_leverage: custLev,
                        provider_leverage: provLev,
                        alignment_percentage: 0,
                        is_aligned: false,
                        leverage_factors_breakdown: leverageResult.breakdown || {},
                        calculated_at: new Date().toISOString(),
                        version: 1,
                        calculation_trigger: 'training_orchestrator',
                    }, { onConflict: 'session_id,bid_id,leverage_type' })

                console.log(`[TrainingOrchestrator API] Leverage written: ${custLev}/${provLev}`)
            }

            console.log(`[TrainingOrchestrator API] Agent ${agentId} linked to session ${sessionId}`)
            return NextResponse.json({ success: true })
        }

        // ------------------------------------------------------------------
        // ACTION: delete-session — Delete a training session and all related data
        // ------------------------------------------------------------------
        if (action === 'delete-session') {
            const { sessionId } = body

            if (!sessionId) {
                return NextResponse.json(
                    { error: 'sessionId is required', success: false },
                    { status: 400 }
                )
            }

            // Verify the session belongs to this user
            const { data: sessionCheck } = await supabase
                .from('sessions')
                .select('session_id')
                .eq('session_id', sessionId)
                .eq('customer_id', userId)
                .single()

            if (!sessionCheck) {
                return NextResponse.json(
                    { error: 'Session not found or not owned by user', success: false },
                    { status: 404 }
                )
            }

            // Delete related records then the session
            await supabase.from('training_session_results').delete().eq('session_id', sessionId)
            await supabase.from('generated_agents').delete().eq('session_id', sessionId)
            await supabase.from('leverage_calculations').delete().eq('session_id', sessionId)
            await supabase.from('session_clause_positions').delete().eq('session_id', sessionId)
            await supabase.from('session_clauses').delete().eq('session_id', sessionId)
            await supabase.from('party_chat_messages').delete().eq('session_id', sessionId)
            await supabase.from('sessions').delete().eq('session_id', sessionId)

            console.log(`[TrainingOrchestrator API] Deleted training session ${sessionId}`)
            return NextResponse.json({ success: true })
        }

        return NextResponse.json(
            { error: `Unknown action: ${action}. Valid actions: assess, design, generate, link, delete-session`, success: false },
            { status: 400 }
        )

    } catch (error) {
        console.error('[TrainingOrchestrator API] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error', success: false },
            { status: 500 }
        )
    }
}


// ============================================================================
// SECTION 2: DATABASE HELPERS
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadUserProfile(
    supabase: any,
    userId: string
): Promise<UserTrainingProfile | null> {
    const { data, error } = await supabase
        .from('user_training_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

    if (error || !data) return null

    return {
        profileId: data.profile_id,
        userId: data.user_id,
        companyId: data.company_id,
        totalSessions: data.total_sessions,
        completedSessions: data.completed_sessions,
        skillRatings: data.skill_ratings || {},
        strengths: data.strengths || [],
        weaknesses: data.weaknesses || [],
        preferredContractTypes: data.preferred_contract_types || [],
        experienceLevel: data.experience_level || 'beginner',
        lastDebriefSummary: data.last_debrief_summary,
    }
}

async function loadRecentResults(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    userId: string
): Promise<TrainingSessionResult[]> {
    const { data, error } = await supabase
        .from('training_session_results')
        .select('session_id, overall_score, clauses_won, clauses_lost, clauses_compromised, leverage_awareness_score, tactical_score, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

    if (error || !data) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((row: any) => ({
        sessionId: row.session_id,
        overallScore: row.overall_score,
        clausesWon: row.clauses_won,
        clausesLost: row.clauses_lost,
        clausesCompromised: row.clauses_compromised,
        leverageAwarenessScore: row.leverage_awareness_score,
        tacticalScore: row.tactical_score,
        createdAt: row.created_at,
    }))
}

async function ensureUserProfile(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    userId: string,
    companyId?: string
): Promise<void> {
    const { data: existing } = await supabase
        .from('user_training_profiles')
        .select('profile_id')
        .eq('user_id', userId)
        .single()

    if (!existing) {
        await supabase
            .from('user_training_profiles')
            .insert({
                user_id: userId,
                company_id: companyId || null,
            })
    }
}

async function loadPlaybookContext(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    playbookId: string
): Promise<PlaybookContext | null> {
    // Load the playbook
    const { data: playbook, error: pbError } = await supabase
        .from('company_playbooks')
        .select('playbook_id, playbook_name, contract_type_key, playbook_perspective')
        .eq('playbook_id', playbookId)
        .eq('is_active', true)
        .single()

    if (pbError || !playbook) return null

    // Load active rules
    const { data: rules, error: rulesError } = await supabase
        .from('playbook_rules')
        .select('clause_name, category, ideal_position, minimum_position, maximum_position, fallback_position, is_deal_breaker, is_non_negotiable, importance_level, rationale, negotiation_tips')
        .eq('playbook_id', playbookId)
        .eq('is_active', true)
        .order('display_order')

    if (rulesError || !rules) return null

    return {
        playbookId: playbook.playbook_id,
        playbookName: playbook.playbook_name,
        contractType: playbook.contract_type_key || null,
        perspective: playbook.playbook_perspective || 'customer',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rules: rules.map((r: any) => ({
            clauseName: r.clause_name,
            category: r.category,
            idealPosition: r.ideal_position,
            minimumPosition: r.minimum_position,
            maximumPosition: r.maximum_position,
            fallbackPosition: r.fallback_position,
            isDealBreaker: r.is_deal_breaker,
            isNonNegotiable: r.is_non_negotiable,
            importanceLevel: r.importance_level,
            rationale: r.rationale,
            negotiationTips: r.negotiation_tips,
        })),
    }
}


// ============================================================================
// SECTION 3: OPTIONS HANDLER (CORS)
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
