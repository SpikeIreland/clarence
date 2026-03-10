// ============================================================================
// FILE: lib/agents/debrief-agent.ts
// PURPOSE: Post-session debrief by Clarence — analyses negotiation performance
//          and updates user training profile
// PATTERN: Agent-based (always uses Claude for analysis)
// ============================================================================

import Anthropic from '@anthropic-ai/sdk'


// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface DebriefInput {
    sessionId: string
    userId: string
    // Session data
    contractType: string
    contractContext: string
    // Agent data
    agentPersona: {
        name: string
        title: string
        company: string
        communicationStyle: string
    }
    agentObjectives: {
        primaryGoal: string
        mustHaves: string[]
        niceToHaves: string[]
        walkAwayPoints: string[]
        batnaDescription: string
    }
    // Leverage
    customerLeverage: number
    providerLeverage: number
    // Clause outcomes
    clauseOutcomes: ClauseOutcome[]
    // Chat history
    chatHighlights: string[]               // Key chat exchanges (summarised)
    // Timing
    sessionDurationMinutes: number
}

export interface ClauseOutcome {
    clauseId: string
    clauseName: string
    clauseCategory: string
    initialCustomerPosition: number | null
    finalCustomerPosition: number
    initialProviderPosition: number | null
    finalProviderPosition: number
    clarencePosition: number | null
    movesCount: number                     // Total position changes
    outcome: 'customer_won' | 'provider_won' | 'compromise' | 'aligned'
}

export interface DebriefResult {
    overallScore: number                   // 0-100
    leverageAwarenessScore: number         // 0-100
    tacticalScore: number                  // 0-100
    clausesWon: number
    clausesLost: number
    clausesCompromised: number
    summary: string                        // Clarence's overall assessment (markdown)
    strengths: DebriefPoint[]              // Top things done well
    improvements: DebriefPoint[]           // Areas for improvement
    teachableMoments: TeachableMoment[]    // Specific learning opportunities
    recommendedFocusAreas: string[]        // Clause categories to practice
    updatedSkillRatings: Record<string, number>  // Updated skill ratings
    updatedExperienceLevel: 'beginner' | 'intermediate' | 'advanced'
}

export interface DebriefPoint {
    title: string
    detail: string
    clauseReference?: string               // Which clause this relates to
}

export interface TeachableMoment {
    clause: string
    whatHappened: string
    whatCouldImprove: string
    leverageContext: string                // How leverage affected this
}


// ============================================================================
// SECTION 2: CLAUDE CLIENT
// ============================================================================

function getClient(): Anthropic | null {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
        console.warn('[DebriefAgent] No ANTHROPIC_API_KEY')
        return null
    }
    return new Anthropic({ apiKey })
}

const MODEL = 'claude-sonnet-4-20250514'


// ============================================================================
// SECTION 3: GENERATE DEBRIEF
// ============================================================================

export async function generateDebrief(
    input: DebriefInput,
    existingSkillRatings: Record<string, number>
): Promise<DebriefResult> {
    // Calculate basic metrics
    const clausesWon = input.clauseOutcomes.filter(c => c.outcome === 'customer_won').length
    const clausesLost = input.clauseOutcomes.filter(c => c.outcome === 'provider_won').length
    const clausesCompromised = input.clauseOutcomes.filter(c => c.outcome === 'compromise').length
    const clausesAligned = input.clauseOutcomes.filter(c => c.outcome === 'aligned').length

    const client = getClient()
    if (!client) {
        return buildFallbackDebrief(input, clausesWon, clausesLost, clausesCompromised, existingSkillRatings)
    }

    const systemPrompt = `You are CLARENCE — The Honest Broker. You have just observed a training negotiation and are now debriefing the user.

You speak in first person as their trusted mentor. You are honest, constructive, and specific. You reference actual clause outcomes and leverage dynamics. You never patronise — you give genuine, actionable feedback.

## Scoring Guidelines
- overallScore: 0-100 based on outcomes relative to leverage position
  - If user had strong leverage (>55%): 70+ requires winning most clauses, 50-69 means they underperformed
  - If leverage was balanced: 60+ for reasonable outcomes
  - If user had weak leverage (<45%): 50+ shows skill, 70+ is excellent
- leverageAwarenessScore: Did the user push where they had leverage and concede where they didn't?
- tacticalScore: Quality of the user's approach — timing, trading, consistency

## Skill Rating Updates
Update each clause category's skill rating (1-10) based on this session. Existing ratings should shift incrementally (±1-2 points max) based on this session's performance.

Return ONLY valid JSON (no markdown, no backticks):
{
    "overallScore": number,
    "leverageAwarenessScore": number,
    "tacticalScore": number,
    "summary": "2-3 paragraph markdown assessment by Clarence in first person",
    "strengths": [{ "title": "short title", "detail": "1-2 sentences", "clauseReference": "clause name or null" }],
    "improvements": [{ "title": "short title", "detail": "1-2 sentences", "clauseReference": "clause name or null" }],
    "teachableMoments": [{ "clause": "name", "whatHappened": "...", "whatCouldImprove": "...", "leverageContext": "..." }],
    "recommendedFocusAreas": ["category1", "category2"],
    "updatedSkillRatings": { "category": rating, ... },
    "updatedExperienceLevel": "beginner" | "intermediate" | "advanced"
}`

    const userPrompt = `Debrief this training negotiation session.

## Session Context
Contract: ${input.contractType} — ${input.contractContext}
Duration: ${input.sessionDurationMinutes} minutes
Counterparty: ${input.agentPersona.name} (${input.agentPersona.title} at ${input.agentPersona.company})
Style: ${input.agentPersona.communicationStyle}

## Leverage Balance
Customer (user): ${input.customerLeverage}%
Provider (AI): ${input.providerLeverage}%

## Counterparty Objectives (hidden from user during negotiation)
Primary goal: ${input.agentObjectives.primaryGoal}
Must-haves: ${input.agentObjectives.mustHaves.join('; ')}
Nice-to-haves: ${input.agentObjectives.niceToHaves.join('; ')}
Walk-away points: ${input.agentObjectives.walkAwayPoints.join('; ')}
BATNA: ${input.agentObjectives.batnaDescription}

## Clause Outcomes
${input.clauseOutcomes.map(c =>
    `- ${c.clauseName} [${c.clauseCategory}]: Customer ${c.initialCustomerPosition ?? '?'} → ${c.finalCustomerPosition}, Provider ${c.initialProviderPosition ?? '?'} → ${c.finalProviderPosition} (${c.movesCount} moves, outcome: ${c.outcome})`
).join('\n')}

## Summary Statistics
Won: ${clausesWon}, Lost: ${clausesLost}, Compromised: ${clausesCompromised}, Aligned: ${clausesAligned}

## Key Chat Moments
${input.chatHighlights.length > 0 ? input.chatHighlights.join('\n') : 'No chat highlights recorded'}

## Existing Skill Ratings (to update incrementally)
${JSON.stringify(existingSkillRatings)}

Generate a thorough debrief. Be specific — reference actual clause names and positions.`

    try {
        const response = await client.messages.create({
            model: MODEL,
            max_tokens: 2000,
            temperature: 0.2,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        })

        const textBlock = response.content.find(b => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') {
            return buildFallbackDebrief(input, clausesWon, clausesLost, clausesCompromised, existingSkillRatings)
        }

        const parsed = JSON.parse(textBlock.text)
        return {
            ...parsed,
            clausesWon,
            clausesLost,
            clausesCompromised,
        }
    } catch (error) {
        console.error('[DebriefAgent] generateDebrief error:', error)
        return buildFallbackDebrief(input, clausesWon, clausesLost, clausesCompromised, existingSkillRatings)
    }
}


// ============================================================================
// SECTION 4: FALLBACK
// ============================================================================

function buildFallbackDebrief(
    input: DebriefInput,
    clausesWon: number,
    clausesLost: number,
    clausesCompromised: number,
    existingSkillRatings: Record<string, number>
): DebriefResult {
    const total = input.clauseOutcomes.length || 1
    const winRate = clausesWon / total
    const overallScore = Math.round((winRate * 50) + (clausesCompromised / total * 30) + 20)

    return {
        overallScore: Math.min(100, overallScore),
        leverageAwarenessScore: 50,
        tacticalScore: 50,
        clausesWon,
        clausesLost,
        clausesCompromised,
        summary: `You completed a ${input.contractType} negotiation against ${input.agentPersona.name} from ${input.agentPersona.company}. Of ${total} clauses, you won ${clausesWon}, lost ${clausesLost}, and reached compromise on ${clausesCompromised}. I'll have more detailed feedback available once the analysis system is fully configured.`,
        strengths: [{ title: 'Session completed', detail: 'You engaged with the full negotiation process.', clauseReference: undefined }],
        improvements: [{ title: 'Review leverage dynamics', detail: `Your leverage was ${input.customerLeverage}% — consider how this should inform your approach to each clause.`, clauseReference: undefined }],
        teachableMoments: [],
        recommendedFocusAreas: input.clauseOutcomes.filter(c => c.outcome === 'provider_won').map(c => c.clauseCategory).slice(0, 3),
        updatedSkillRatings: existingSkillRatings,
        updatedExperienceLevel: 'beginner',
    }
}
