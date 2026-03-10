// ============================================================================
// FILE: lib/agents/training-orchestrator.ts
// PURPOSE: Clarence as Training Orchestrator — assesses users, designs
//          scenarios, and generates dynamic AI opponent agents
// PATTERN: Agent-based (always uses Claude for generation)
// ============================================================================

import Anthropic from '@anthropic-ai/sdk'
import { calculateLeverage, type LeverageInputs } from '@/lib/calculateLeverage'
import { CONTRACT_TYPE_DEFINITIONS } from '@/lib/role-matrix'


// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface UserTrainingProfile {
    profileId: string
    userId: string
    companyId: string | null
    totalSessions: number
    completedSessions: number
    skillRatings: Record<string, number>       // { "liability": 7, "indemnity": 4 }
    strengths: string[]
    weaknesses: string[]
    preferredContractTypes: string[]
    experienceLevel: 'beginner' | 'intermediate' | 'advanced'
    lastDebriefSummary: string | null
}

export interface TrainingSessionResult {
    sessionId: string
    overallScore: number | null
    clausesWon: number
    clausesLost: number
    clausesCompromised: number
    leverageAwarenessScore: number | null
    tacticalScore: number | null
    createdAt: string
}

export interface UserAssessment {
    greeting: string                            // Clarence's personalised greeting
    recommendation: string                      // What Clarence recommends next
    suggestedContractType: string | null         // e.g. 'service_agreement'
    suggestedFocusAreas: string[]               // clause categories to focus on
    suggestedDifficulty: 'beginner' | 'intermediate' | 'advanced'
    profileSummary: {
        level: string
        sessionsCompleted: number
        topStrengths: string[]
        areasToImprove: string[]
    }
}

export interface ScenarioDesign {
    narrative: string                           // The scenario story
    counterpartyCompany: {
        name: string
        industry: string
        size: string                            // 'startup' | 'mid-market' | 'enterprise'
        situation: string                       // Why they need this deal
    }
    contractType: string                        // contractTypeKey
    contractContext: string                      // What the deal is about
    dealValue: number
    dealCurrency: string
    dealDurationMonths: number
    keyDynamics: string[]                       // What makes this negotiation interesting
    leverageInputs: LeverageInputs              // For calculateLeverage()
    clauseCategories: string[]                  // Which clause categories to include
    userBrief: string                           // Briefing for the user (what they know)
    playbookContext?: PlaybookContext            // If training on a playbook, the rules to incorporate
}

export interface PlaybookContext {
    playbookId: string
    playbookName: string
    contractType: string | null
    perspective: 'customer' | 'provider'
    rules: {
        clauseName: string
        category: string
        idealPosition: number
        minimumPosition: number
        maximumPosition: number
        fallbackPosition: number
        isDealBreaker: boolean
        isNonNegotiable: boolean
        importanceLevel: number
        rationale: string | null
        negotiationTips: string | null
    }[]
}

export interface GeneratedAgentConfig {
    agentId?: string                            // Set after DB insert
    persona: {
        name: string
        title: string
        company: string
        industry: string
        experienceYears: number
        backstory: string
        communicationStyle: string              // 'formal' | 'direct' | 'collaborative' | 'tough'
    }
    objectives: {
        primaryGoal: string
        mustHaves: string[]                     // Non-negotiable items
        niceToHaves: string[]                   // Preferred but tradeable
        walkAwayPoints: string[]                // What would kill the deal
        batnaDescription: string                // Their best alternative
    }
    leverageInputs: LeverageInputs
    leverageResult: ReturnType<typeof calculateLeverage>
    personalityTraits: {
        style: 'cooperative' | 'balanced' | 'aggressive'
        tactics: string[]                       // e.g. ['anchors high', 'bundles clauses', 'uses silence']
        concessionPattern: string               // How they give ground
        emotionalTriggers: string[]             // What frustrates them
    }
    systemPrompt: string                        // The full opponent system prompt
    initialPositions: Record<string, number> | null  // clauseCategory -> position (1-10)
    greetingMessage: string                     // Opening message in chat
}


// ============================================================================
// SECTION 2: CLAUDE CLIENT
// ============================================================================

function getClient(): Anthropic | null {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
        console.warn('[TrainingOrchestrator] No ANTHROPIC_API_KEY')
        return null
    }
    return new Anthropic({ apiKey })
}

const MODEL = 'claude-sonnet-4-20250514'


// ============================================================================
// SECTION 3: ASSESS USER
// ============================================================================

export async function assessUser(
    profile: UserTrainingProfile | null,
    recentResults: TrainingSessionResult[]
): Promise<UserAssessment> {
    const client = getClient()

    // New user — return default assessment without LLM call
    if (!profile || profile.completedSessions === 0) {
        return {
            greeting: "Welcome to CLARENCE Training. I'm here to help you develop your contract negotiation skills. Let's start with something manageable — a standard service agreement where you'll have reasonable leverage. I'll walk you through the dynamics as we go.",
            recommendation: "I recommend starting with a beginner-level service agreement negotiation. This will introduce you to the core mechanics — positions, leverage, and clause categories — in a low-pressure environment.",
            suggestedContractType: 'service_agreement',
            suggestedFocusAreas: ['liability', 'service_levels', 'termination'],
            suggestedDifficulty: 'beginner',
            profileSummary: {
                level: 'beginner',
                sessionsCompleted: 0,
                topStrengths: [],
                areasToImprove: [],
            },
        }
    }

    // Returning user — use Claude for personalised assessment
    if (!client) {
        return buildFallbackAssessment(profile, recentResults)
    }

    const systemPrompt = `You are CLARENCE — The Honest Broker. You are greeting a returning training user and recommending their next training session.

You speak in first person as Clarence. You are warm but professional. You reference specific data about the user's past performance. You are their trusted training mentor.

Available contract types: ${CONTRACT_TYPE_DEFINITIONS.map(ct => ct.contractTypeKey).join(', ')}

Common clause categories: liability, indemnity, termination, intellectual_property, data_protection, service_levels, payment_terms, confidentiality, force_majeure, dispute_resolution, warranties, insurance, limitation_of_liability, change_management, governance

Return ONLY valid JSON (no markdown, no backticks):
{
    "greeting": "Personalised greeting referencing their history (2-3 sentences)",
    "recommendation": "What to practice next and why (2-3 sentences)",
    "suggestedContractType": "contract_type_key or null",
    "suggestedFocusAreas": ["category1", "category2"],
    "suggestedDifficulty": "beginner" | "intermediate" | "advanced"
}`

    const userPrompt = `User training profile:
- Experience level: ${profile.experienceLevel}
- Sessions completed: ${profile.completedSessions} of ${profile.totalSessions} started
- Skill ratings: ${JSON.stringify(profile.skillRatings)}
- Strengths: ${profile.strengths.join(', ') || 'none identified yet'}
- Weaknesses: ${profile.weaknesses.join(', ') || 'none identified yet'}
- Preferred contract types: ${profile.preferredContractTypes.join(', ') || 'none set'}
- Last debrief summary: ${profile.lastDebriefSummary || 'none'}

Recent session results (last 5):
${recentResults.slice(0, 5).map(r =>
    `- Score: ${r.overallScore}/100, Won: ${r.clausesWon}, Lost: ${r.clausesLost}, Compromised: ${r.clausesCompromised}, Leverage awareness: ${r.leverageAwarenessScore}/100, Tactical: ${r.tacticalScore}/100`
).join('\n') || 'No completed sessions yet'}

Generate a personalised greeting and recommendation for their next training session.`

    try {
        const response = await client.messages.create({
            model: MODEL,
            max_tokens: 500,
            temperature: 0.3,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        })

        const textBlock = response.content.find(b => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') {
            return buildFallbackAssessment(profile, recentResults)
        }

        const parsed = JSON.parse(textBlock.text)
        return {
            ...parsed,
            profileSummary: {
                level: profile.experienceLevel,
                sessionsCompleted: profile.completedSessions,
                topStrengths: profile.strengths.slice(0, 3),
                areasToImprove: profile.weaknesses.slice(0, 3),
            },
        }
    } catch (error) {
        console.error('[TrainingOrchestrator] assessUser error:', error)
        return buildFallbackAssessment(profile, recentResults)
    }
}


// ============================================================================
// SECTION 4: DESIGN SCENARIO
// ============================================================================

export async function designScenario(
    profile: UserTrainingProfile | null,
    preferences?: {
        contractType?: string
        difficulty?: 'beginner' | 'intermediate' | 'advanced'
        focusAreas?: string[]
        playbookContext?: PlaybookContext
    }
): Promise<ScenarioDesign> {
    const client = getClient()
    if (!client) {
        return buildFallbackScenario(preferences)
    }

    const playbookContext = preferences?.playbookContext
    const difficulty = preferences?.difficulty || profile?.experienceLevel || 'beginner'
    const contractType = preferences?.contractType || playbookContext?.contractType || 'service_agreement'

    // When a playbook is provided, derive focus areas from its rule categories
    const focusAreas = preferences?.focusAreas
        || (playbookContext ? [...new Set(playbookContext.rules.map(r => r.category))] : ['liability', 'service_levels', 'termination'])

    // Build playbook context section for the prompt
    const playbookPromptSection = playbookContext ? `
## IMPORTANT: Company Playbook Context
This training session is based on the company playbook "${playbookContext.playbookName}".
The user's organisation has specific negotiation rules that the scenario MUST test. The scenario should create realistic commercial pressure on the clause categories covered by these rules.

Perspective: The user negotiates as the ${playbookContext.perspective}.

### Playbook Rules to Test (${playbookContext.rules.length} rules):
${playbookContext.rules.map(r =>
    `- **${r.clauseName}** [${r.category}] — Ideal: ${r.idealPosition}, Range: ${r.minimumPosition}-${r.maximumPosition}, Fallback: ${r.fallbackPosition}${r.isDealBreaker ? ' [DEAL BREAKER]' : ''}${r.isNonNegotiable ? ' [NON-NEGOTIABLE]' : ''} (Importance: ${r.importanceLevel}/10)${r.rationale ? ` — ${r.rationale}` : ''}`
).join('\n')}

### Deal Breakers
${playbookContext.rules.filter(r => r.isDealBreaker).map(r => `- ${r.clauseName}: position must not go below ${r.minimumPosition}`).join('\n') || 'None specified'}

### Non-Negotiable Clauses
${playbookContext.rules.filter(r => r.isNonNegotiable).map(r => `- ${r.clauseName}: position must stay at ${r.idealPosition}`).join('\n') || 'None specified'}

Design the scenario so the counterparty will push hardest on the deal-breaker and high-importance clauses. This tests whether the user knows their company's red lines and can defend them under pressure.
` : ''

    const systemPrompt = `You are CLARENCE — The Honest Broker. You are designing a realistic contract negotiation training scenario.

The scenario must be coherent and commercially realistic. The counterparty company must have a believable situation that justifies their negotiation behaviour. The leverage inputs must be internally consistent with the scenario narrative.

## Contract Type
${contractType} (from the CLARENCE platform's contract type library)

## Difficulty: ${difficulty}
${difficulty === 'beginner' ? 'User should have moderate leverage advantage (55-65%). Counterparty is reasonable.' : ''}
${difficulty === 'intermediate' ? 'Leverage should be roughly balanced (45-55%). Counterparty is strategic.' : ''}
${difficulty === 'advanced' ? 'Counterparty should have leverage advantage (35-45% user leverage). Counterparty is experienced and tough.' : ''}

## User Context
${profile ? `Level: ${profile.experienceLevel}, Weaknesses to target: ${profile.weaknesses.join(', ') || 'general'}` : 'New user, first session'}

## Focus Areas
${focusAreas.join(', ')}
${playbookPromptSection}
## Leverage Inputs Schema
The leverageInputs must match this exact TypeScript interface:
{
    alternativeProvidersAvailable: number (1-10),
    marketConditions: 'buyers_market' | 'sellers_market' | 'balanced',
    timePressure: number (1-10, higher = more pressure on customer),
    providerCapacityConstraints: number (1-10),
    dealValue: number (in GBP),
    customerAnnualRevenue: number (optional),
    switchingCosts: number (1-10),
    budgetFlexibility: number (1-10),
    serviceCriticality: number (1-10),
    strategicImportance: number (1-10),
    incumbentAdvantage: 'none' | 'minor' | 'moderate' | 'significant',
    reputationalValue: number (1-10),
    customerBatnaQuality: number (1-10),
    providerPipelineStrength: number (1-10)
}

Return ONLY valid JSON (no markdown, no backticks):
{
    "narrative": "2-3 paragraph scenario story",
    "counterpartyCompany": {
        "name": "Realistic company name",
        "industry": "Industry sector",
        "size": "startup | mid-market | enterprise",
        "situation": "Why they need this deal"
    },
    "contractType": "${contractType}",
    "contractContext": "What the deal is about specifically",
    "dealValue": number,
    "dealCurrency": "GBP",
    "dealDurationMonths": number,
    "keyDynamics": ["dynamic1", "dynamic2", "dynamic3"],
    "leverageInputs": { ... },
    "clauseCategories": ${JSON.stringify(focusAreas)},
    "userBrief": "What the user knows going in (their side of the story)"
}`

    const userPrompt = playbookContext
        ? `Design a ${difficulty}-level ${contractType} training scenario that tests the user's knowledge of their company playbook "${playbookContext.playbookName}".

The scenario must create realistic commercial pressure on the ${playbookContext.rules.filter(r => r.isDealBreaker).length} deal-breaker clauses and ${playbookContext.rules.filter(r => r.importanceLevel >= 8).length} high-importance clauses. The counterparty should have plausible reasons to push on these areas.

${profile?.weaknesses?.length ? `The user struggles with: ${profile.weaknesses.join(', ')}. Design the scenario to test these areas.` : ''}

Make it commercially realistic — a real situation two companies might face. The scenario should test whether the user can negotiate within their organisation's risk tolerance.`
        : `Design a ${difficulty}-level ${contractType} training scenario focused on: ${focusAreas.join(', ')}.

${profile?.weaknesses?.length ? `The user struggles with: ${profile.weaknesses.join(', ')}. Design the scenario to test these areas.` : 'This is a general training scenario.'}

Make it commercially realistic — a real situation two companies might face.`

    try {
        const response = await client.messages.create({
            model: MODEL,
            max_tokens: 1500,
            temperature: 0.5,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        })

        const textBlock = response.content.find(b => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') {
            return buildFallbackScenario(preferences)
        }

        const scenario = JSON.parse(textBlock.text) as ScenarioDesign
        // Carry playbook context forward so generateAgent can use it
        if (playbookContext) {
            scenario.playbookContext = playbookContext
        }
        return scenario
    } catch (error) {
        console.error('[TrainingOrchestrator] designScenario error:', error)
        return buildFallbackScenario(preferences)
    }
}


// ============================================================================
// SECTION 5: GENERATE AGENT
// ============================================================================

export async function generateAgent(
    scenario: ScenarioDesign,
): Promise<GeneratedAgentConfig> {
    const client = getClient()

    // Calculate leverage using the real algorithm
    const leverageResult = calculateLeverage(scenario.leverageInputs)

    if (!client) {
        return buildFallbackAgent(scenario, leverageResult)
    }

    // Determine personality based on leverage and scenario
    const providerLeverage = leverageResult.providerLeverage
    const style = providerLeverage >= 55 ? 'aggressive'
        : providerLeverage >= 45 ? 'balanced'
        : 'cooperative'

    const systemPrompt = `You are CLARENCE — The Honest Broker. You are generating an AI opponent agent for a training negotiation.

## Scenario
${scenario.narrative}

## Counterparty Company
${scenario.counterpartyCompany.name} (${scenario.counterpartyCompany.industry}, ${scenario.counterpartyCompany.size})
Situation: ${scenario.counterpartyCompany.situation}

## Contract
Type: ${scenario.contractType}
Context: ${scenario.contractContext}
Value: ${scenario.dealCurrency} ${scenario.dealValue.toLocaleString()}
Duration: ${scenario.dealDurationMonths} months

## Leverage Calculation Result
Customer leverage: ${leverageResult.customerLeverage}%
Provider leverage: ${leverageResult.providerLeverage}%
Breakdown: Market=${leverageResult.breakdown.marketDynamics}, Economic=${leverageResult.breakdown.economicFactors}, Strategic=${leverageResult.breakdown.strategicPosition}, BATNA=${leverageResult.breakdown.batnaAnalysis}

## Personality Baseline: ${style}
The agent's behaviour must be GROUNDED in the leverage dynamics. A provider with strong leverage should negotiate confidently — not because they're "aggressive" by nature, but because their position genuinely supports it.

## Clause Categories in This Negotiation
${scenario.clauseCategories.join(', ')}
${scenario.playbookContext ? `
## PLAYBOOK-AWARE TRAINING
This is a playbook training session. The user's organisation has specific negotiation policies. The opponent should create realistic pressure to test whether the user can defend their organisation's positions.

### Key areas to challenge (the user's company rules):
${scenario.playbookContext.rules.filter(r => r.isDealBreaker || r.importanceLevel >= 7).map(r =>
    `- **${r.clauseName}** [${r.category}]: User's ideal=${r.idealPosition}, min=${r.minimumPosition}, max=${r.maximumPosition}${r.isDealBreaker ? ' [DEAL BREAKER — push hard here]' : ''}${r.isNonNegotiable ? ' [NON-NEGOTIABLE — test if user holds firm]' : ''}`
).join('\n')}

The opponent should set initial positions that directly conflict with the user's deal-breaker clauses and high-importance areas. This creates the training challenge — the user must recognise their red lines and defend them.
For deal-breaker clauses: set opponent position at least 3 points away from the user's minimum.
For non-negotiable clauses: try to negotiate movement from the user's fixed position.
` : ''}
## Position Scale
1 = Maximum flexibility for the providing party
5 = Balanced / Market standard
10 = Maximum protection for the protected party (customer)

Generate initial positions from the PROVIDER's perspective. A confident provider will push towards lower positions (1-4). A weaker provider will accept higher positions (6-8).

Return ONLY valid JSON (no markdown, no backticks):
{
    "persona": {
        "name": "Full name",
        "title": "Job title",
        "company": "${scenario.counterpartyCompany.name}",
        "industry": "${scenario.counterpartyCompany.industry}",
        "experienceYears": number,
        "backstory": "2-3 sentences about this person",
        "communicationStyle": "formal | direct | collaborative | tough"
    },
    "objectives": {
        "primaryGoal": "What they most want from this deal",
        "mustHaves": ["non-negotiable item 1", "..."],
        "niceToHaves": ["preferred but tradeable 1", "..."],
        "walkAwayPoints": ["what kills the deal"],
        "batnaDescription": "Their best alternative to this deal"
    },
    "personalityTraits": {
        "style": "${style}",
        "tactics": ["tactic1", "tactic2", "tactic3"],
        "concessionPattern": "How they give ground",
        "emotionalTriggers": ["what frustrates them"]
    },
    "initialPositions": { "clause_category": position_number, ... },
    "greetingMessage": "Their opening message in the negotiation chat (in character, 2-3 sentences)"
}`

    const userPrompt = scenario.playbookContext
        ? `Generate the AI opponent agent for this playbook training scenario. The opponent must create realistic commercial pressure on the user's deal-breaker clauses and high-importance areas. Their positions and behaviour must be consistent with their company's leverage position (${leverageResult.providerLeverage}% provider leverage). Make them feel like a real person — not a caricature.`
        : `Generate the AI opponent agent for this training scenario. Make them feel like a real person — not a caricature. Their positions and behaviour must be consistent with their company's leverage position (${leverageResult.providerLeverage}% provider leverage).`

    try {
        const response = await client.messages.create({
            model: MODEL,
            max_tokens: 1500,
            temperature: 0.4,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        })

        const textBlock = response.content.find(b => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') {
            return buildFallbackAgent(scenario, leverageResult)
        }

        const parsed = JSON.parse(textBlock.text)

        // Build the opponent system prompt for use during negotiation
        const opponentSystemPrompt = buildOpponentSystemPrompt(parsed, scenario, leverageResult)

        return {
            persona: parsed.persona,
            objectives: parsed.objectives,
            leverageInputs: scenario.leverageInputs,
            leverageResult,
            personalityTraits: parsed.personalityTraits,
            systemPrompt: opponentSystemPrompt,
            initialPositions: parsed.initialPositions,
            greetingMessage: parsed.greetingMessage,
        }
    } catch (error) {
        console.error('[TrainingOrchestrator] generateAgent error:', error)
        return buildFallbackAgent(scenario, leverageResult)
    }
}


// ============================================================================
// SECTION 6: OPPONENT SYSTEM PROMPT BUILDER
// ============================================================================

function buildOpponentSystemPrompt(
    agentData: { persona: GeneratedAgentConfig['persona']; objectives: GeneratedAgentConfig['objectives']; personalityTraits: GeneratedAgentConfig['personalityTraits'] },
    scenario: ScenarioDesign,
    leverageResult: ReturnType<typeof calculateLeverage>
): string {
    return `YOU ARE ${agentData.persona.name.toUpperCase()}, ${agentData.persona.title} at ${agentData.persona.company}.

## YOUR IDENTITY
${agentData.persona.backstory}
Communication style: ${agentData.persona.communicationStyle}
Experience: ${agentData.persona.experienceYears} years in ${agentData.persona.industry}

## THE DEAL
${scenario.contractContext}
Contract type: ${scenario.contractType}
Value: ${scenario.dealCurrency} ${scenario.dealValue.toLocaleString()} over ${scenario.dealDurationMonths} months

## YOUR COMPANY'S SITUATION
${scenario.counterpartyCompany.situation}

## YOUR LEVERAGE POSITION
Your leverage: ${leverageResult.providerLeverage}% (Customer's leverage: ${leverageResult.customerLeverage}%)
${leverageResult.providerLeverage >= 55 ? 'You have the stronger position. Negotiate with confidence but remain professional.' : ''}
${leverageResult.providerLeverage < 45 ? 'The customer has stronger leverage. Be strategic about where you push back — pick your battles.' : ''}
${leverageResult.providerLeverage >= 45 && leverageResult.providerLeverage < 55 ? 'Leverage is roughly balanced. Neither party should dominate.' : ''}

## YOUR OBJECTIVES
Primary goal: ${agentData.objectives.primaryGoal}
Must-haves (non-negotiable): ${agentData.objectives.mustHaves.join('; ')}
Nice-to-haves (tradeable): ${agentData.objectives.niceToHaves.join('; ')}
Walk-away points: ${agentData.objectives.walkAwayPoints.join('; ')}
Your BATNA: ${agentData.objectives.batnaDescription}

## YOUR NEGOTIATION APPROACH
Style: ${agentData.personalityTraits.style}
Tactics: ${agentData.personalityTraits.tactics.join('; ')}
How you concede: ${agentData.personalityTraits.concessionPattern}
What frustrates you: ${agentData.personalityTraits.emotionalTriggers.join('; ')}

## POSITION SCALE
1 = Maximum flexibility for you (the provider)
5 = Balanced / Market standard
10 = Maximum protection for the customer
Your preferred positions sit in the 1-4 range for your must-haves and 4-6 for tradeable items.

## RULES
1. Stay in character at all times. You are ${agentData.persona.name}, not an AI.
2. Reference your company's situation and objectives when explaining positions.
3. Make strategic decisions — don't just say no. Explain your reasoning.
4. Be willing to trade: concede on nice-to-haves to protect must-haves.
5. If the customer makes a reasonable offer on a tradeable item, consider accepting.
6. Never break character or reference being an AI, a training scenario, or CLARENCE.
7. Keep responses concise — 2-4 sentences for chat, brief reasoning for position moves.
8. Your tone should match your communication style: ${agentData.persona.communicationStyle}.`
}


// ============================================================================
// SECTION 7: FALLBACK BUILDERS
// ============================================================================

function buildFallbackAssessment(
    profile: UserTrainingProfile,
    recentResults: TrainingSessionResult[]
): UserAssessment {
    const avgScore = recentResults.length > 0
        ? Math.round(recentResults.reduce((sum, r) => sum + (r.overallScore || 50), 0) / recentResults.length)
        : null

    let greeting = `Welcome back. You've completed ${profile.completedSessions} training session${profile.completedSessions === 1 ? '' : 's'}.`
    if (avgScore !== null) {
        greeting += ` Your average performance score is ${avgScore}/100.`
    }

    const recommendation = profile.weaknesses.length > 0
        ? `I recommend focusing on ${profile.weaknesses[0]} — it's an area where there's room for improvement.`
        : 'I recommend continuing with a balanced-difficulty scenario to build your skills across all clause categories.'

    return {
        greeting,
        recommendation,
        suggestedContractType: profile.preferredContractTypes[0] || 'service_agreement',
        suggestedFocusAreas: profile.weaknesses.length > 0
            ? profile.weaknesses.slice(0, 3)
            : ['liability', 'service_levels', 'termination'],
        suggestedDifficulty: profile.experienceLevel,
        profileSummary: {
            level: profile.experienceLevel,
            sessionsCompleted: profile.completedSessions,
            topStrengths: profile.strengths.slice(0, 3),
            areasToImprove: profile.weaknesses.slice(0, 3),
        },
    }
}

function buildFallbackScenario(
    preferences?: { contractType?: string; difficulty?: string; focusAreas?: string[] }
): ScenarioDesign {
    return {
        narrative: 'Your company is looking to engage a mid-sized IT services provider for a 2-year managed services agreement covering infrastructure management and helpdesk support. The provider, Meridian Technology Solutions, is well-established in the market with a solid reputation but faces increasing competition from newer, more agile firms. They need this contract to maintain their market position, but they have other prospects in their pipeline.',
        counterpartyCompany: {
            name: 'Meridian Technology Solutions',
            industry: 'IT Services',
            size: 'mid-market',
            situation: 'Established provider facing competitive pressure from newer entrants. This contract would represent about 8% of their annual revenue.',
        },
        contractType: preferences?.contractType || 'service_agreement',
        contractContext: 'A managed services agreement for IT infrastructure management and helpdesk support.',
        dealValue: 500000,
        dealCurrency: 'GBP',
        dealDurationMonths: 24,
        keyDynamics: [
            'Provider has competition but strong track record',
            'Customer has moderate switching costs from current provider',
            'Timeline is flexible — no urgent deadline',
        ],
        leverageInputs: {
            alternativeProvidersAvailable: 5,
            marketConditions: 'balanced' as const,
            timePressure: 4,
            providerCapacityConstraints: 5,
            dealValue: 500000,
            customerAnnualRevenue: 20000000,
            switchingCosts: 6,
            budgetFlexibility: 5,
            serviceCriticality: 6,
            strategicImportance: 5,
            incumbentAdvantage: 'minor' as const,
            reputationalValue: 5,
            customerBatnaQuality: 6,
            providerPipelineStrength: 5,
        },
        clauseCategories: preferences?.focusAreas || ['liability', 'service_levels', 'termination'],
        userBrief: 'You are the customer looking to engage a managed services provider. You have spoken to several firms and Meridian is a strong contender but not the only option. Your current contract expires in 6 months, giving you reasonable time to negotiate.',
    }
}

function buildFallbackAgent(
    scenario: ScenarioDesign,
    leverageResult: ReturnType<typeof calculateLeverage>
): GeneratedAgentConfig {
    const style: 'cooperative' | 'balanced' | 'aggressive' = leverageResult.providerLeverage >= 55
        ? 'aggressive'
        : leverageResult.providerLeverage >= 45
        ? 'balanced'
        : 'cooperative'

    const persona = {
        name: 'Alex Morgan',
        title: 'Head of Commercial Contracts',
        company: scenario.counterpartyCompany.name,
        industry: scenario.counterpartyCompany.industry,
        experienceYears: 12,
        backstory: `A seasoned commercial negotiator at ${scenario.counterpartyCompany.name}. Known for being thorough and data-driven in negotiations. Respects well-prepared counterparties.`,
        communicationStyle: 'direct' as const,
    }

    const objectives = {
        primaryGoal: 'Secure the contract with commercially favourable terms that protect our delivery risk.',
        mustHaves: ['Reasonable liability cap', 'Clear scope definition', 'Fair payment terms'],
        niceToHaves: ['Longer contract term', 'Exclusivity clause', 'Favourable IP terms'],
        walkAwayPoints: ['Unlimited liability', 'Unilateral termination without cause'],
        batnaDescription: 'We have two other prospects in the pipeline, though this deal is our preferred option.',
    }

    const personalityTraits = {
        style,
        tactics: ['Data-driven arguments', 'Package deals across clauses', 'Strategic concessions'],
        concessionPattern: 'Willing to trade on nice-to-haves but firm on must-haves. Prefers bundled concessions over one-at-a-time.',
        emotionalTriggers: ['Unreasonable demands without justification', 'Last-minute changes to agreed terms'],
    }

    const agentData = { persona, objectives, personalityTraits }
    const systemPrompt = buildOpponentSystemPrompt(agentData, scenario, leverageResult)

    return {
        persona,
        objectives,
        leverageInputs: scenario.leverageInputs,
        leverageResult,
        personalityTraits,
        systemPrompt,
        initialPositions: null,
        greetingMessage: `Good morning. I'm ${persona.name}, ${persona.title} at ${persona.company}. I've reviewed the contract documentation and I'm ready to work through the terms. Shall we begin with the key commercial clauses?`,
    }
}
