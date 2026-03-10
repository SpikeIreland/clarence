// ============================================================================
// FILE: app/api/agents/debrief/route.ts
// PURPOSE: API endpoint for post-session debrief by Clarence
// PATTERN: Follows existing /api/agents/* route conventions
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    generateDebrief,
    type DebriefInput,
    type ClauseOutcome,
} from '@/lib/agents/debrief-agent'


// ============================================================================
// SECTION 1: POST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { sessionId, userId } = body

        if (!sessionId || !userId) {
            return NextResponse.json(
                { error: 'sessionId and userId are required', success: false },
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

        console.log(`[Debrief API] Generating debrief for session ${sessionId}, user ${userId}`)

        // Load session data
        const { data: session, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('session_id', sessionId)
            .single()

        if (sessionError || !session) {
            return NextResponse.json(
                { error: 'Session not found', success: false },
                { status: 404 }
            )
        }

        // Load generated agent for this session
        const { data: agent } = await supabase
            .from('generated_agents')
            .select('*')
            .eq('session_id', sessionId)
            .single()

        // Load clause positions
        const { data: clauses } = await supabase
            .from('session_clause_positions')
            .select('*')
            .eq('session_id', sessionId)

        // Load user's existing training profile
        const { data: profile } = await supabase
            .from('user_training_profiles')
            .select('skill_ratings')
            .eq('user_id', userId)
            .single()

        const existingSkillRatings = profile?.skill_ratings || {}

        // Build clause outcomes
        const clauseOutcomes: ClauseOutcome[] = (clauses || []).map(c => {
            const custPos = c.customer_position ?? c.initiator_position ?? 5
            const provPos = c.provider_position ?? c.respondent_position ?? 5
            const diff = Math.abs(custPos - provPos)

            let outcome: ClauseOutcome['outcome'] = 'compromise'
            if (diff <= 1) outcome = 'aligned'
            else if (custPos > provPos + 1) outcome = 'customer_won'
            else if (provPos > custPos + 1) outcome = 'provider_won'

            return {
                clauseId: c.clause_id,
                clauseName: c.clause_name || c.clause_id,
                clauseCategory: c.category || 'general',
                initialCustomerPosition: null,     // Could be tracked with move history
                finalCustomerPosition: custPos,
                initialProviderPosition: null,
                finalProviderPosition: provPos,
                clarencePosition: c.clarence_position ?? null,
                movesCount: 0,                     // Could be tracked with move history
                outcome,
            }
        })

        // Build debrief input
        const debriefInput: DebriefInput = {
            sessionId,
            userId,
            contractType: session.contract_type || 'service_agreement',
            contractContext: session.notes || 'Training negotiation',
            agentPersona: agent?.persona || {
                name: session.provider_company || 'AI Counterpart',
                title: 'Negotiator',
                company: session.provider_company || 'Provider',
                communicationStyle: 'balanced',
            },
            agentObjectives: agent?.objectives || {
                primaryGoal: 'Secure favourable contract terms',
                mustHaves: [],
                niceToHaves: [],
                walkAwayPoints: [],
                batnaDescription: 'Unknown',
            },
            customerLeverage: session.customer_leverage || 50,
            providerLeverage: session.provider_leverage || 50,
            clauseOutcomes,
            chatHighlights: [],                 // Could be populated from chat history
            sessionDurationMinutes: session.updated_at && session.created_at
                ? Math.round((new Date(session.updated_at).getTime() - new Date(session.created_at).getTime()) / 60000)
                : 30,
        }

        const debrief = await generateDebrief(debriefInput, existingSkillRatings)

        console.log(`[Debrief API] Debrief complete: score=${debrief.overallScore}, won=${debrief.clausesWon}, lost=${debrief.clausesLost}`)

        // Store debrief result (non-blocking)
        supabase
            .from('training_session_results')
            .insert({
                session_id: sessionId,
                user_id: userId,
                opponent_agent_id: agent?.agent_id || null,
                overall_score: debrief.overallScore,
                clauses_won: debrief.clausesWon,
                clauses_lost: debrief.clausesLost,
                clauses_compromised: debrief.clausesCompromised,
                leverage_awareness_score: debrief.leverageAwarenessScore,
                tactical_score: debrief.tacticalScore,
                debrief_text: debrief.summary,
                debrief_highlights: debrief.teachableMoments,
            })
            .then(({ error }) => {
                if (error) console.warn('[Debrief API] Result insert failed:', error.message)
            })

        // Update user training profile (non-blocking)
        supabase
            .from('user_training_profiles')
            .update({
                skill_ratings: debrief.updatedSkillRatings,
                strengths: Object.entries(debrief.updatedSkillRatings)
                    .filter(([, v]) => v >= 7)
                    .map(([k]) => k),
                weaknesses: Object.entries(debrief.updatedSkillRatings)
                    .filter(([, v]) => v <= 4)
                    .map(([k]) => k),
                experience_level: debrief.updatedExperienceLevel,
                last_debrief_summary: debrief.summary,
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
            .then(({ error }) => {
                if (error) console.warn('[Debrief API] Profile update failed:', error.message)
            })

        // Increment session counters via RPC or separate update (non-blocking)
        supabase.rpc('increment_training_counters', {
            p_user_id: userId,
        }).then(({ error }: { error: { message: string } | null }) => {
            if (error) console.warn('[Debrief API] Counter increment failed:', error.message)
        })

        return NextResponse.json({
            success: true,
            debrief: {
                overallScore: debrief.overallScore,
                leverageAwarenessScore: debrief.leverageAwarenessScore,
                tacticalScore: debrief.tacticalScore,
                clausesWon: debrief.clausesWon,
                clausesLost: debrief.clausesLost,
                clausesCompromised: debrief.clausesCompromised,
                summary: debrief.summary,
                strengths: debrief.strengths,
                improvements: debrief.improvements,
                teachableMoments: debrief.teachableMoments,
                recommendedFocusAreas: debrief.recommendedFocusAreas,
            },
        })

    } catch (error) {
        console.error('[Debrief API] Error:', error)
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
