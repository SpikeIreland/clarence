// ============================================================================
// FILE: lib/agents/role-resolver.ts
// PURPOSE: AI-powered role resolution for ambiguous/missing/symmetric cases
// PATTERN: Static-first, agent-as-fallback
// ============================================================================

import Anthropic from '@anthropic-ai/sdk'
import {
    type RoleContext,
    type PartyRole,
    getContractType,
    getRoleContext,
    CONTRACT_TYPE_DEFINITIONS
} from '@/lib/role-matrix'


// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface RoleResolverInput {
    sessionId: string
    contractTypeKey?: string | null
    initiatorPartyRole?: PartyRole | null
    viewerRole?: 'customer' | 'provider' | 'initiator' | 'respondent'
    viewerCompanyName?: string | null
    counterpartyCompanyName?: string | null
    contractDescription?: string | null
    isTraining?: boolean
}

export interface ResolvedRoleContext extends RoleContext {
    resolvedBy: 'static' | 'agent'
    confidence: 'high' | 'medium' | 'low'
    reasoning?: string
}


// ============================================================================
// SECTION 2: IN-MEMORY CACHE
// ============================================================================

const resolvedCache = new Map<string, {
    result: ResolvedRoleContext
    timestamp: number
}>()

const CACHE_TTL_MS = 30 * 60 * 1000  // 30 minutes

function getCacheKey(input: RoleResolverInput): string {
    return `${input.sessionId}:${input.viewerRole || 'unknown'}`
}

function getCached(input: RoleResolverInput): ResolvedRoleContext | null {
    const key = getCacheKey(input)
    const entry = resolvedCache.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        resolvedCache.delete(key)
        return null
    }
    return entry.result
}

function setCache(input: RoleResolverInput, result: ResolvedRoleContext): void {
    const key = getCacheKey(input)
    resolvedCache.set(key, { result, timestamp: Date.now() })
    // Evict oldest entries if cache grows too large
    if (resolvedCache.size > 500) {
        const oldest = [...resolvedCache.entries()]
            .sort((a, b) => a[1].timestamp - b[1].timestamp)
        for (let i = 0; i < 100; i++) {
            resolvedCache.delete(oldest[i][0])
        }
    }
}


// ============================================================================
// SECTION 3: STATIC FAST PATH
// ============================================================================

const SYMMETRIC_TYPES = ['nda_mutual']

function tryStaticResolve(input: RoleResolverInput): ResolvedRoleContext | null {
    const { contractTypeKey, initiatorPartyRole, viewerRole } = input

    // Need all three pieces for static resolution
    if (!contractTypeKey || !initiatorPartyRole || !viewerRole) return null

    // Symmetric contract types need agent reasoning
    if (SYMMETRIC_TYPES.includes(contractTypeKey)) return null

    const typeDef = getContractType(contractTypeKey)
    if (!typeDef) return null

    const isInitiator = viewerRole === 'customer' || viewerRole === 'initiator'
    const context = getRoleContext(contractTypeKey, initiatorPartyRole, isInitiator)

    return {
        ...context,
        resolvedBy: 'static',
        confidence: 'high',
    }
}


// ============================================================================
// SECTION 4: AGENT RESOLUTION (Claude API)
// ============================================================================

export async function resolveRoles(
    input: RoleResolverInput
): Promise<ResolvedRoleContext> {
    // Check cache first
    const cached = getCached(input)
    if (cached) return cached

    // Try static resolution first
    const staticResult = tryStaticResolve(input)
    if (staticResult) {
        setCache(input, staticResult)
        return staticResult
    }

    // Fall back to agent
    try {
        const agentResult = await callRoleResolverAgent(input)
        setCache(input, agentResult)
        return agentResult
    } catch (error) {
        console.error('[RoleResolver] Agent call failed, using fallback:', error)
        const fallback = buildFallbackResult(input)
        setCache(input, fallback)
        return fallback
    }
}

async function callRoleResolverAgent(
    input: RoleResolverInput
): Promise<ResolvedRoleContext> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
        console.warn('[RoleResolver] No ANTHROPIC_API_KEY, using fallback')
        return buildFallbackResult(input)
    }

    const client = new Anthropic({ apiKey })

    // Build context string from contract type definitions
    const knownTypes = CONTRACT_TYPE_DEFINITIONS.map(ct =>
        `- ${ct.contractTypeKey}: ${ct.contractTypeName} ` +
        `(Protected=${ct.protectedPartyLabel}, Providing=${ct.providingPartyLabel})`
    ).join('\n')

    const systemPrompt = `You are a contract role resolution engine for the CLARENCE contract negotiation platform. Given context about a contract negotiation session, determine the correct party labels and role assignment.

## Known Contract Types
${knownTypes}

## Position Scale
- Position 1 = favours the "providing" party (e.g. Provider, Seller, Landlord)
- Position 10 = favours the "protected" party (e.g. Customer, Buyer, Tenant)
- Position 5 = balanced / market standard

## Rules
1. For symmetric contracts (like mutual NDAs where both parties disclose AND receive), use COMPANY NAMES as labels instead of generic role labels. This makes "you" vs "them" immediately clear.
2. "Protected party" = the party that benefits from higher positions (7-10 on the scale).
3. "Providing party" = the party that benefits from lower positions (1-3 on the scale).
4. When contractTypeKey is missing, infer from contractDescription or context if possible.
5. When initiatorPartyRole is missing, default the viewer to "protected" with medium confidence.
6. For training sessions, use the same logic but note it in reasoning.

Return ONLY valid JSON (no markdown, no backticks) matching this exact schema:
{
    "userPartyRole": "protected" or "providing",
    "userRoleLabel": "string - label for the current viewer",
    "counterpartyRoleLabel": "string - label for the other party",
    "positionFavorEnd": 1 or 10,
    "contractTypeName": "string - human-readable contract type name",
    "protectedPartyLabel": "string - the party favoured by position 10",
    "providingPartyLabel": "string - the party favoured by position 1",
    "confidence": "high" or "medium" or "low",
    "reasoning": "string - brief explanation of the resolution"
}`

    const userPrompt = buildAgentPrompt(input)

    const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
        return buildFallbackResult(input)
    }

    try {
        const parsed = JSON.parse(textBlock.text)

        return {
            userPartyRole: parsed.userPartyRole,
            userRoleLabel: parsed.userRoleLabel,
            counterpartyRoleLabel: parsed.counterpartyRoleLabel,
            positionFavorEnd: parsed.positionFavorEnd,
            contractTypeName: parsed.contractTypeName,
            protectedPartyLabel: parsed.protectedPartyLabel,
            providingPartyLabel: parsed.providingPartyLabel,
            resolvedBy: 'agent',
            confidence: parsed.confidence || 'medium',
            reasoning: parsed.reasoning,
        }
    } catch (parseError) {
        console.error('[RoleResolver] Failed to parse agent response:', parseError)
        return buildFallbackResult(input)
    }
}

function buildAgentPrompt(input: RoleResolverInput): string {
    const parts: string[] = ['Resolve party roles for this contract session:']

    parts.push(`Session ID: ${input.sessionId}`)

    if (input.contractTypeKey)
        parts.push(`Contract type key: ${input.contractTypeKey}`)
    else
        parts.push('Contract type key: NOT SET — infer from description if possible')

    if (input.initiatorPartyRole)
        parts.push(`Initiator selected role: ${input.initiatorPartyRole}`)
    else
        parts.push('Initiator party role: NOT SET — determine the most likely assignment')

    if (input.viewerRole)
        parts.push(`Current viewer is: ${input.viewerRole} (this is the person we call "you")`)

    if (input.viewerCompanyName)
        parts.push(`Viewer company: ${input.viewerCompanyName}`)

    if (input.counterpartyCompanyName)
        parts.push(`Counterparty company: ${input.counterpartyCompanyName}`)

    if (input.contractDescription)
        parts.push(`Contract description/notes: ${input.contractDescription}`)

    if (input.isTraining)
        parts.push('This is a TRAINING session (simulated negotiation with AI opponent)')

    return parts.join('\n')
}


// ============================================================================
// SECTION 5: FALLBACK (No API / Error Cases)
// ============================================================================

function buildFallbackResult(input: RoleResolverInput): ResolvedRoleContext {
    // Specific handling for mutual NDAs — use company names
    if (input.contractTypeKey === 'nda_mutual') {
        const viewerLabel = input.viewerCompanyName || 'Your Party'
        const otherLabel = input.counterpartyCompanyName || 'Other Party'
        const typeDef = getContractType('nda_mutual')

        return {
            userPartyRole: 'protected',
            userRoleLabel: viewerLabel,
            counterpartyRoleLabel: otherLabel,
            positionFavorEnd: 10,
            contractTypeName: typeDef?.contractTypeName || 'NDA (Mutual)',
            protectedPartyLabel: viewerLabel,
            providingPartyLabel: otherLabel,
            resolvedBy: 'static',
            confidence: 'medium',
            reasoning: 'Mutual NDA: using company names since both parties play symmetric roles.',
        }
    }

    // If we have a contract type key, try partial static resolution
    if (input.contractTypeKey) {
        const typeDef = getContractType(input.contractTypeKey)
        if (typeDef) {
            return {
                userPartyRole: 'protected',
                userRoleLabel: typeDef.protectedPartyLabel,
                counterpartyRoleLabel: typeDef.providingPartyLabel,
                positionFavorEnd: 10,
                contractTypeName: typeDef.contractTypeName,
                protectedPartyLabel: typeDef.protectedPartyLabel,
                providingPartyLabel: typeDef.providingPartyLabel,
                resolvedBy: 'static',
                confidence: 'medium',
                reasoning: 'Contract type known but initiator party role missing. Assuming viewer is the protected party.',
            }
        }
    }

    // Generic fallback — use company names if available, otherwise Party A/B
    return {
        userPartyRole: 'protected',
        userRoleLabel: input.viewerCompanyName || 'Party A',
        counterpartyRoleLabel: input.counterpartyCompanyName || 'Party B',
        positionFavorEnd: 10,
        contractTypeName: 'Contract',
        protectedPartyLabel: input.viewerCompanyName || 'Party A',
        providingPartyLabel: input.counterpartyCompanyName || 'Party B',
        resolvedBy: 'static',
        confidence: 'low',
        reasoning: 'No contract type or role data available. Using company names or generic labels.',
    }
}
