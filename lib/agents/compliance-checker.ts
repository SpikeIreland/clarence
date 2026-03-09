// ============================================================================
// FILE: lib/agents/compliance-checker.ts
// PURPOSE: Playbook Compliance Agent — real-time position move validation
// PATTERN: Static-first, agent-as-fallback (same as role-resolver.ts)
// ============================================================================

import Anthropic from '@anthropic-ai/sdk'
import {
    type PlaybookRule,
    type PlaybookPerspective,
    type ContractClause,
    type RuleStatus,
    type ScoredRule,
    scoreRule,
    normaliseCategory,
    checkSingleClauseCompliance,
} from '@/lib/playbook-compliance'


// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export type ComplianceSeverity = 'clear' | 'guidance' | 'warning' | 'breach' | 'deal_breaker'

export interface ComplianceCheckInput {
    sessionId?: string | null
    contractId?: string | null
    clauseId: string
    clauseName: string
    clauseCategory: string
    proposedPosition: number
    currentPosition: number | null
    party: 'customer' | 'provider' | 'initiator' | 'respondent'
    allClauses: ComplianceClauseSnapshot[]
    companyId: string
    contractTypeKey?: string | null
    perspective?: PlaybookPerspective
}

export interface ComplianceClauseSnapshot {
    clauseId: string
    clauseName: string
    category: string
    initiatorPosition: number | null
    respondentPosition: number | null
    clarencePosition: number | null
    customerPosition?: number | null
}

export interface BreachedRuleDetail {
    ruleId: string
    clauseName: string
    category: string
    status: RuleStatus
    detail: string
    isDealBreaker: boolean
    isNonNegotiable: boolean
    proposedPosition: number
    minimumPosition: number
    idealPosition: number
    rationale: string | null
    negotiationTips: string | null
    requiresApprovalBelow: number | null
}

export interface GuidanceTip {
    ruleId: string
    clauseName: string
    tip: string
    source: 'playbook_rationale' | 'playbook_tips' | 'agent_reasoning'
}

export interface ComplianceCheckResult {
    severity: ComplianceSeverity
    overallScore: number
    previousScore: number
    scoreDelta: number
    breachedRules: BreachedRuleDetail[]
    guidanceTips: GuidanceTip[]
    requiresApproval: boolean
    escalationContact: string | null
    escalationContactEmail: string | null
    resolvedBy: 'static' | 'agent'
    reasoning?: string
}


// ============================================================================
// SECTION 2: IN-MEMORY CACHE
// ============================================================================

const complianceCache = new Map<string, {
    result: ComplianceCheckResult
    timestamp: number
}>()

const CACHE_TTL_MS = 15 * 60 * 1000  // 15 minutes

function getCacheKey(input: ComplianceCheckInput): string {
    return `${input.sessionId || input.contractId}:${input.clauseId}:${input.proposedPosition}`
}

function getCached(input: ComplianceCheckInput): ComplianceCheckResult | null {
    const key = getCacheKey(input)
    const entry = complianceCache.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        complianceCache.delete(key)
        return null
    }
    return entry.result
}

function setCache(input: ComplianceCheckInput, result: ComplianceCheckResult): void {
    const key = getCacheKey(input)
    complianceCache.set(key, { result, timestamp: Date.now() })
    if (complianceCache.size > 500) {
        const oldest = [...complianceCache.entries()]
            .sort((a, b) => a[1].timestamp - b[1].timestamp)
        for (let i = 0; i < 100; i++) {
            complianceCache.delete(oldest[i][0])
        }
    }
}


// ============================================================================
// SECTION 3: MAIN COMPLIANCE CHECK
// ============================================================================

export async function checkCompliance(
    input: ComplianceCheckInput,
    playbookRules: PlaybookRule[]
): Promise<ComplianceCheckResult> {
    // Check cache
    const cached = getCached(input)
    if (cached) return cached

    // No playbook rules → always clear
    if (playbookRules.length === 0) {
        const clearResult: ComplianceCheckResult = {
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
        }
        setCache(input, clearResult)
        return clearResult
    }

    // Convert snapshots to ContractClause format for the compliance engine
    const clauses: ContractClause[] = input.allClauses.map(c => ({
        clause_id: c.clauseId,
        clause_name: c.clauseName,
        category: c.category,
        initiator_position: c.initiatorPosition,
        respondent_position: c.respondentPosition,
        clarence_position: c.clarencePosition,
        customer_position: c.customerPosition ?? c.initiatorPosition,
        is_header: false,
    }))

    const perspective = input.perspective || 'customer'

    // Run single-clause compliance check (before/after)
    const singleCheck = checkSingleClauseCompliance(
        playbookRules,
        clauses,
        input.clauseId,
        input.proposedPosition,
        input.party,
        perspective
    )

    // Find rules in the same normalised category as the target clause
    const targetNormCategory = normaliseCategory(input.clauseCategory)
    const categoryRules = playbookRules.filter(
        r => normaliseCategory(r.category) === targetNormCategory
    )

    // Score each category rule against the proposed position
    const breachedRules: BreachedRuleDetail[] = []
    const guidanceTips: GuidanceTip[] = []
    let worstSeverity: ComplianceSeverity = 'clear'
    let requiresApproval = false
    let escalationContact: string | null = null
    let escalationContactEmail: string | null = null

    for (const rule of categoryRules) {
        const { status, detail } = scoreRule(rule, input.proposedPosition, perspective)

        // Collect breached rules
        if (status === 'breach' || status === 'fail' || status === 'escalation' || status === 'warning') {
            breachedRules.push({
                ruleId: rule.rule_id,
                clauseName: rule.clause_name,
                category: rule.category,
                status,
                detail,
                isDealBreaker: rule.is_deal_breaker,
                isNonNegotiable: rule.is_non_negotiable,
                proposedPosition: input.proposedPosition,
                minimumPosition: rule.minimum_position,
                idealPosition: rule.ideal_position,
                rationale: rule.rationale,
                negotiationTips: rule.negotiation_tips,
                requiresApprovalBelow: rule.requires_approval_below,
            })
        }

        // Collect guidance tips from rules in this category
        if (rule.negotiation_tips && status !== 'pass') {
            guidanceTips.push({
                ruleId: rule.rule_id,
                clauseName: rule.clause_name,
                tip: rule.negotiation_tips,
                source: 'playbook_tips',
            })
        }
        if (rule.rationale && status !== 'pass' && !rule.negotiation_tips) {
            guidanceTips.push({
                ruleId: rule.rule_id,
                clauseName: rule.clause_name,
                tip: rule.rationale,
                source: 'playbook_rationale',
            })
        }

        // Determine worst severity
        if (status === 'breach') {
            worstSeverity = 'deal_breaker'
            requiresApproval = true
            escalationContact = escalationContact || rule.escalation_contact
            escalationContactEmail = escalationContactEmail || rule.escalation_contact_email
        } else if (status === 'fail' && worstSeverity !== 'deal_breaker') {
            worstSeverity = 'breach'
            requiresApproval = true
            escalationContact = escalationContact || rule.escalation_contact
            escalationContactEmail = escalationContactEmail || rule.escalation_contact_email
        } else if (status === 'escalation' && worstSeverity !== 'deal_breaker' && worstSeverity !== 'breach') {
            worstSeverity = 'warning'
            requiresApproval = true
            escalationContact = escalationContact || rule.escalation_contact
            escalationContactEmail = escalationContactEmail || rule.escalation_contact_email
        } else if (status === 'warning' && worstSeverity === 'clear') {
            worstSeverity = 'warning'
            if (rule.requires_approval_below != null) {
                requiresApproval = true
            }
        } else if (status === 'acceptable' && worstSeverity === 'clear') {
            // Within range but below ideal — show guidance
            if (guidanceTips.length > 0) {
                worstSeverity = 'guidance'
            }
        }
    }

    // If no rules were breached but we have guidance tips, set severity to guidance
    if (worstSeverity === 'clear' && guidanceTips.length > 0 && input.proposedPosition < getLowestIdeal(categoryRules)) {
        worstSeverity = 'guidance'
    }

    // Also require approval if overall score drops below 60%
    if (singleCheck.overallScore < 60) {
        requiresApproval = true
    }

    const staticResult: ComplianceCheckResult = {
        severity: worstSeverity,
        overallScore: singleCheck.overallScore,
        previousScore: singleCheck.previousOverallScore,
        scoreDelta: singleCheck.overallScore - singleCheck.previousOverallScore,
        breachedRules,
        guidanceTips,
        requiresApproval,
        escalationContact,
        escalationContactEmail,
        resolvedBy: 'static',
    }

    // Check if agent reasoning is needed
    const needsAgent = shouldEscalateToAgent(categoryRules, input, worstSeverity)

    if (needsAgent) {
        try {
            const agentResult = await callComplianceAgent(input, categoryRules, staticResult)
            if (agentResult) {
                // Agent can soften severity, never harden
                const severityOrder: ComplianceSeverity[] = ['clear', 'guidance', 'warning', 'breach', 'deal_breaker']
                const staticIdx = severityOrder.indexOf(staticResult.severity)
                const agentIdx = severityOrder.indexOf(agentResult.adjustedSeverity)

                if (agentIdx < staticIdx) {
                    staticResult.severity = agentResult.adjustedSeverity
                    staticResult.reasoning = agentResult.reasoning
                    staticResult.resolvedBy = 'agent'

                    if (agentResult.adjustedGuidance) {
                        staticResult.guidanceTips.push({
                            ruleId: 'agent',
                            clauseName: input.clauseName,
                            tip: agentResult.adjustedGuidance,
                            source: 'agent_reasoning',
                        })
                    }
                } else {
                    // Agent didn't soften — keep static result but record reasoning
                    staticResult.reasoning = agentResult.reasoning
                    staticResult.resolvedBy = 'agent'
                }
            }
        } catch (error) {
            console.error('[ComplianceChecker] Agent call failed, using static result:', error)
        }
    }

    setCache(input, staticResult)
    return staticResult
}


// ============================================================================
// SECTION 4: AGENT TRIGGER CONDITIONS
// ============================================================================

function getLowestIdeal(rules: PlaybookRule[]): number {
    if (rules.length === 0) return 10
    return Math.min(...rules.map(r => r.ideal_position))
}

function shouldEscalateToAgent(
    categoryRules: PlaybookRule[],
    input: ComplianceCheckInput,
    staticSeverity: ComplianceSeverity
): boolean {
    // Only escalate for non-clear severities
    if (staticSeverity === 'clear') return false

    for (const rule of categoryRules) {
        // Rich rationale AND position in grey zone (within 1pt of a boundary)
        if (rule.rationale && rule.rationale.length > 50) {
            const distToMin = Math.abs(input.proposedPosition - rule.minimum_position)
            const distToIdeal = Math.abs(input.proposedPosition - rule.ideal_position)
            const distToApproval = rule.requires_approval_below != null
                ? Math.abs(input.proposedPosition - rule.requires_approval_below)
                : Infinity
            if (distToMin <= 1 || distToIdeal <= 1 || distToApproval <= 1) {
                return true
            }
        }

        // Inferred range context (scale mapping was guessed)
        if (rule.range_context?.source === 'inferred' && staticSeverity !== 'guidance') {
            return true
        }

        // Non-negotiable with negotiation tips (contradiction)
        if (rule.is_non_negotiable && rule.negotiation_tips && rule.negotiation_tips.length > 20) {
            return true
        }
    }

    // Multiple conflicting severity levels in same category
    const perspective = input.perspective || 'customer'
    const statuses = new Set(categoryRules.map(r => scoreRule(r, input.proposedPosition, perspective).status))
    if (statuses.has('pass') && (statuses.has('breach') || statuses.has('fail'))) {
        return true
    }

    return false
}


// ============================================================================
// SECTION 5: AGENT CALL (Claude Sonnet)
// ============================================================================

interface AgentResponse {
    adjustedSeverity: ComplianceSeverity
    reasoning: string
    adjustedGuidance: string | null
    confidenceLevel: 'high' | 'medium' | 'low'
}

async function callComplianceAgent(
    input: ComplianceCheckInput,
    categoryRules: PlaybookRule[],
    staticResult: ComplianceCheckResult
): Promise<AgentResponse | null> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
        console.warn('[ComplianceChecker] No ANTHROPIC_API_KEY, skipping agent')
        return null
    }

    const client = new Anthropic({ apiKey })

    const perspectiveLabel = input.perspective === 'provider' ? 'PROVIDER' : 'CUSTOMER'
    const scaleDesc = input.perspective === 'provider'
        ? `- 1 = Weakest position for the provider (maximum concession to customer)
- 5 = Balanced / Market standard
- 10 = Strongest position for the provider (maximum protection for provider)`
        : `- 1 = Maximum flexibility for the providing party (e.g. Provider, Seller)
- 5 = Balanced / Market standard
- 10 = Maximum protection for the protected party (e.g. Customer, Buyer)`

    const systemPrompt = `You are a contract compliance analyst for the CLARENCE negotiation platform. Given a playbook rule with its rationale, negotiation tips, and range context, assess whether a proposed position move genuinely violates the spirit of the rule or is acceptable in context.

This playbook is written from the ${perspectiveLabel} perspective.

## Position Scale (${perspectiveLabel} perspective)
${scaleDesc}

## Severity Levels (from least to most severe)
- clear: No issue — position is within acceptable bounds
- guidance: Position is acceptable but tips/rationale suggest room for improvement
- warning: Position approaches or crosses an approval threshold — warrants attention
- breach: Position is below minimum acceptable — non-compliant
- deal_breaker: Position breaches a deal-breaking rule — critical

## Rules
1. You can LOWER the severity from the static assessment, never RAISE it.
2. Consider whether the rationale and tips suggest flexibility not captured by the numeric boundaries.
3. If the range_context source is 'inferred', the numeric boundaries may be approximate.
4. If a rule is marked non-negotiable but has negotiation tips, the tips indicate contextual flexibility.
5. Consider the importance_level — lower importance rules have more flexibility.

Return ONLY valid JSON (no markdown, no backticks):
{
    "adjustedSeverity": "clear" | "guidance" | "warning" | "breach" | "deal_breaker",
    "reasoning": "brief explanation of your assessment",
    "adjustedGuidance": "contextual tip for the negotiator, or null",
    "confidenceLevel": "high" | "medium" | "low"
}`

    const rulesContext = categoryRules.map(r => ({
        clause_name: r.clause_name,
        ideal_position: r.ideal_position,
        minimum_position: r.minimum_position,
        maximum_position: r.maximum_position,
        is_deal_breaker: r.is_deal_breaker,
        is_non_negotiable: r.is_non_negotiable,
        requires_approval_below: r.requires_approval_below,
        importance_level: r.importance_level,
        rationale: r.rationale,
        negotiation_tips: r.negotiation_tips,
        range_context: r.range_context,
    }))

    const userPrompt = `Assess this position move:

Clause: ${input.clauseName}
Category: ${input.clauseCategory}
Current position: ${input.currentPosition ?? 'not set'}
Proposed position: ${input.proposedPosition}
Moving party: ${input.party}

Static assessment severity: ${staticResult.severity}
Overall compliance score: ${staticResult.previousScore}% → ${staticResult.overallScore}%

Applicable playbook rules:
${JSON.stringify(rulesContext, null, 2)}

Should the severity be softened based on the context?`

    try {
        const response = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 300,
            temperature: 0,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        })

        const textBlock = response.content.find(b => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') return null

        const parsed = JSON.parse(textBlock.text) as AgentResponse
        return parsed
    } catch (error) {
        console.error('[ComplianceChecker] Agent parse error:', error)
        return null
    }
}
