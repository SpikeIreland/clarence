// ============================================================================
// FILE: lib/agents/opponent-agent.ts
// PURPOSE: Live AI opponent for training negotiations — replaces static
//          position offsets with reasoned, in-character responses
// PATTERN: Agent-based (always uses Claude for live responses)
// ============================================================================

import Anthropic from '@anthropic-ai/sdk'


// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface OpponentAgentInput {
    agentId: string
    systemPrompt: string
}

export interface ClauseContext {
    clauseId: string
    clauseName: string
    clauseCategory: string
    customerPosition: number | null        // User's current position
    providerPosition: number | null        // Opponent's current position
    clarencePosition: number | null        // Clarence's recommendation
    proposedPosition: number               // What the user just proposed
}

export interface MoveHistoryEntry {
    clauseId: string
    clauseName: string
    party: 'customer' | 'provider'
    fromPosition: number | null
    toPosition: number
    timestamp: string
}

export interface NegotiationState {
    totalClauses: number
    agreedClauses: number                  // Clauses where positions match
    customerLeverage: number               // Overall leverage %
    providerLeverage: number
    sessionProgress: number                // 0-100
}

export interface CounterMoveResult {
    counterPosition: number                // 1-10
    reasoning: string                      // In-character explanation (shown in chat)
    internalReasoning: string              // Strategic reasoning (for debrief only)
    action: 'accept' | 'counter' | 'hold' | 'reject'
    willingness: number                    // 1-10 how willing to move further
}

export interface ChatMessage {
    sender: 'user' | 'opponent'
    message: string
    timestamp?: string
}

export interface ChatResponse {
    message: string                        // In-character reply
    sentiment: 'positive' | 'neutral' | 'firm' | 'frustrated'
}


// ============================================================================
// SECTION 2: CLAUDE CLIENT
// ============================================================================

function getClient(): Anthropic | null {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
        console.warn('[OpponentAgent] No ANTHROPIC_API_KEY')
        return null
    }
    return new Anthropic({ apiKey })
}

const MODEL = 'claude-sonnet-4-20250514'


// ============================================================================
// SECTION 3: GENERATE COUNTER-MOVE
// ============================================================================

export async function generateCounterMove(
    agent: OpponentAgentInput,
    clause: ClauseContext,
    moveHistory: MoveHistoryEntry[],
    negotiationState: NegotiationState
): Promise<CounterMoveResult> {
    const client = getClient()
    if (!client) {
        return buildFallbackCounterMove(clause)
    }

    // Build context about recent moves on this clause
    const clauseMoves = moveHistory
        .filter(m => m.clauseId === clause.clauseId)
        .slice(-5)

    const userPrompt = `The customer has proposed a position on this clause. Decide your response.

## Clause
Name: ${clause.clauseName}
Category: ${clause.clauseCategory}

## Current Positions
Customer's position: ${clause.proposedPosition} (just moved${clause.customerPosition ? ` from ${clause.customerPosition}` : ''})
Your current position: ${clause.providerPosition ?? 'not yet set'}
Clarence's recommendation: ${clause.clarencePosition ?? 'not available'}

## Position Scale Reminder
1 = Best for you (provider). 10 = Best for customer.
Customer proposing ${clause.proposedPosition} means they want ${clause.proposedPosition >= 7 ? 'strong customer protection' : clause.proposedPosition <= 3 ? 'surprisingly favourable terms for you' : 'a balanced position'}.

## Move History on This Clause
${clauseMoves.length > 0 ? clauseMoves.map(m => `${m.party} moved from ${m.fromPosition ?? 'initial'} to ${m.toPosition}`).join('\n') : 'No previous moves'}

## Overall Negotiation Status
Progress: ${negotiationState.sessionProgress}% (${negotiationState.agreedClauses}/${negotiationState.totalClauses} clauses aligned)
Leverage: You ${negotiationState.providerLeverage}% vs Customer ${negotiationState.customerLeverage}%

Decide: Accept their position, counter-propose, hold your current position, or reject outright.

Return ONLY valid JSON (no markdown, no backticks):
{
    "counterPosition": number (1-10),
    "reasoning": "What you SAY to the customer (in character, 1-2 sentences)",
    "internalReasoning": "Your strategic thinking (not shared, for analysis only)",
    "action": "accept" | "counter" | "hold" | "reject",
    "willingness": number (1-10, how willing to move further on this clause)
}`

    try {
        const response = await client.messages.create({
            model: MODEL,
            max_tokens: 400,
            temperature: 0.3,
            system: agent.systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        })

        const textBlock = response.content.find(b => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') {
            return buildFallbackCounterMove(clause)
        }

        return JSON.parse(textBlock.text) as CounterMoveResult
    } catch (error) {
        console.error('[OpponentAgent] generateCounterMove error:', error)
        return buildFallbackCounterMove(clause)
    }
}


// ============================================================================
// SECTION 4: GENERATE CHAT RESPONSE
// ============================================================================

export async function generateChatResponse(
    agent: OpponentAgentInput,
    userMessage: string,
    chatHistory: ChatMessage[],
    negotiationState: NegotiationState
): Promise<ChatResponse> {
    const client = getClient()
    if (!client) {
        return buildFallbackChatResponse()
    }

    // Build chat context from recent history
    const recentHistory = chatHistory.slice(-10).map(msg =>
        `${msg.sender === 'user' ? 'Customer' : 'You'}: ${msg.message}`
    ).join('\n')

    const userPrompt = `The customer has sent you a message in the negotiation chat. Respond in character.

## Conversation History
${recentHistory || 'No previous messages'}

## Customer's Latest Message
"${userMessage}"

## Negotiation Status
Progress: ${negotiationState.sessionProgress}% (${negotiationState.agreedClauses}/${negotiationState.totalClauses} clauses aligned)
Leverage: You ${negotiationState.providerLeverage}% vs Customer ${negotiationState.customerLeverage}%

Respond naturally, in character. Keep it concise (2-4 sentences). Reference the negotiation context where relevant.

Return ONLY valid JSON (no markdown, no backticks):
{
    "message": "Your in-character response",
    "sentiment": "positive" | "neutral" | "firm" | "frustrated"
}`

    try {
        const response = await client.messages.create({
            model: MODEL,
            max_tokens: 300,
            temperature: 0.4,
            system: agent.systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        })

        const textBlock = response.content.find(b => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') {
            return buildFallbackChatResponse()
        }

        return JSON.parse(textBlock.text) as ChatResponse
    } catch (error) {
        console.error('[OpponentAgent] generateChatResponse error:', error)
        return buildFallbackChatResponse()
    }
}


// ============================================================================
// SECTION 5: FALLBACKS
// ============================================================================

function buildFallbackCounterMove(clause: ClauseContext): CounterMoveResult {
    const proposed = clause.proposedPosition
    const current = clause.providerPosition ?? 4

    // Simple fallback: if customer wants high (customer-favourable), counter lower
    if (proposed >= 7) {
        return {
            counterPosition: Math.max(current, proposed - 2),
            reasoning: "That's quite a strong position. I think we can find something more balanced here.",
            internalReasoning: 'Customer pushed hard. Counter with moderate resistance.',
            action: 'counter',
            willingness: 4,
        }
    }

    if (proposed >= 4 && proposed <= 6) {
        return {
            counterPosition: proposed,
            reasoning: "That seems like a reasonable position. I can work with that.",
            internalReasoning: 'Balanced position — accept to build goodwill.',
            action: 'accept',
            willingness: 8,
        }
    }

    // Customer proposing low position (provider-favourable) — accept
    return {
        counterPosition: proposed,
        reasoning: "I appreciate the flexibility here. That works for us.",
        internalReasoning: 'Customer offered favourable terms. Accept immediately.',
        action: 'accept',
        willingness: 10,
    }
}

function buildFallbackChatResponse(): ChatResponse {
    return {
        message: "I understand your point. Let me consider that and we can discuss further as we work through the clauses.",
        sentiment: 'neutral',
    }
}
