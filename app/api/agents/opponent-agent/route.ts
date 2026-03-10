// ============================================================================
// FILE: app/api/agents/opponent-agent/route.ts
// PURPOSE: API endpoint for the live AI opponent agent
// PATTERN: Follows existing /api/agents/* route conventions
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    generateCounterMove,
    generateChatResponse,
    type ClauseContext,
    type MoveHistoryEntry,
    type NegotiationState,
    type ChatMessage,
} from '@/lib/agents/opponent-agent'


// ============================================================================
// SECTION 1: POST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { action, agentId, sessionId } = body

        if (!action || !agentId) {
            return NextResponse.json(
                { error: 'action and agentId are required', success: false },
                { status: 400 }
            )
        }

        // Load agent system prompt from database
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json(
                { error: 'Database configuration missing', success: false },
                { status: 500 }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        const { data: agentRow, error: agentError } = await supabase
            .from('generated_agents')
            .select('system_prompt')
            .eq('agent_id', agentId)
            .single()

        if (agentError || !agentRow) {
            return NextResponse.json(
                { error: `Agent not found: ${agentId}`, success: false },
                { status: 404 }
            )
        }

        const agentInput = {
            agentId,
            systemPrompt: agentRow.system_prompt,
        }

        // ------------------------------------------------------------------
        // ACTION: counter-move — Respond to a user's position proposal
        // ------------------------------------------------------------------
        if (action === 'counter-move') {
            const clause: ClauseContext = body.clause
            const moveHistory: MoveHistoryEntry[] = body.moveHistory || []
            const negotiationState: NegotiationState = body.negotiationState

            if (!clause || !negotiationState) {
                return NextResponse.json(
                    { error: 'clause and negotiationState are required for counter-move', success: false },
                    { status: 400 }
                )
            }

            console.log(`[OpponentAgent API] Counter-move for clause ${clause.clauseName}, proposed=${clause.proposedPosition}`)

            const result = await generateCounterMove(agentInput, clause, moveHistory, negotiationState)

            console.log(`[OpponentAgent API] Result: action=${result.action}, counter=${result.counterPosition}`)

            return NextResponse.json({ success: true, result })
        }

        // ------------------------------------------------------------------
        // ACTION: chat — Respond to a user's chat message
        // ------------------------------------------------------------------
        if (action === 'chat') {
            const { userMessage, chatHistory, negotiationState } = body

            if (!userMessage || !negotiationState) {
                return NextResponse.json(
                    { error: 'userMessage and negotiationState are required for chat', success: false },
                    { status: 400 }
                )
            }

            console.log(`[OpponentAgent API] Chat response for agent ${agentId}`)

            const chatMessages: ChatMessage[] = (chatHistory || []).map((msg: { sender: string; message: string }) => ({
                sender: msg.sender === 'user' ? 'user' as const : 'opponent' as const,
                message: msg.message,
            }))

            const result = await generateChatResponse(agentInput, userMessage, chatMessages, negotiationState)

            console.log(`[OpponentAgent API] Chat sentiment: ${result.sentiment}`)

            return NextResponse.json({ success: true, result })
        }

        return NextResponse.json(
            { error: `Unknown action: ${action}. Valid actions: counter-move, chat`, success: false },
            { status: 400 }
        )

    } catch (error) {
        console.error('[OpponentAgent API] Error:', error)
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
