// ============================================================================
// FILE: lib/alignment-engine.ts
// PURPOSE: Contract Alignment Report engine — enhanced compliance calculation
//          with category filtering, three-tier mapping, and AI narrative generation
// USED BY: /api/audits/[auditId]/run
// ============================================================================

import Anthropic from '@anthropic-ai/sdk'
import {
    type PlaybookRule,
    type ContractClause,
    type ComplianceResult,
    type CategoryResult,
    type PlaybookPerspective,
    type ClauseAuditResult,
    type ClauseAuditSummary,
    type AuditClause,
    calculatePlaybookCompliance,
    normaliseCategory,
    getCategoryDisplayName,
    getEffectiveRangeContext,
    translateRulePosition,
    runClauseCentricAudit,
} from '@/lib/playbook-compliance'


// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export type AlignmentTier = 'aligned' | 'partially_aligned' | 'material_gap'

export interface CategoryNarrative {
    normalisedKey: string
    categoryName: string
    tier: AlignmentTier
    score: number
    riskSummary: string          // AI-generated: what's the risk here?
    remediation: string          // AI-generated: what should be done?
    keyFindings: string[]        // AI-generated: bullet-point findings
}

export interface AlignmentReportResult {
    compliance: ComplianceResult
    narratives: CategoryNarrative[]
    executiveSummary: string     // AI-generated overall summary
    focusCategories: string[]
    totalRulesInScope: number
    alignedCount: number
    partialCount: number
    materialGapCount: number
    generatedAt: string
}


// ============================================================================
// SECTION 2: THREE-TIER MAPPING
// ============================================================================

export function getAlignmentTier(score: number): AlignmentTier {
    if (score >= 80) return 'aligned'
    if (score >= 60) return 'partially_aligned'
    return 'material_gap'
}

export function getTierLabel(tier: AlignmentTier): string {
    switch (tier) {
        case 'aligned': return 'Aligned'
        case 'partially_aligned': return 'Partially Aligned'
        case 'material_gap': return 'Material Gap'
    }
}


// ============================================================================
// SECTION 3: FILTERED COMPLIANCE CALCULATION
// ============================================================================

export function calculateFilteredCompliance(
    rules: PlaybookRule[],
    clauses: ContractClause[],
    focusCategories: string[],
    perspective: PlaybookPerspective = 'customer'
): ComplianceResult {
    // Filter rules to only focus categories
    const focusSet = new Set(focusCategories)
    const filteredRules = focusSet.size > 0
        ? rules.filter(r => focusSet.has(normaliseCategory(r.category)))
        : rules

    return calculatePlaybookCompliance(filteredRules, clauses, perspective)
}


// ============================================================================
// SECTION 4: AI NARRATIVE GENERATION
// ============================================================================

interface NarrativeContext {
    categoryName: string
    tier: AlignmentTier
    score: number
    rulesTotal: number
    rulesPassed: number
    rulesFailed: number
    rulesWarning: number
    rules: {
        clauseName: string
        status: string
        score: number
        detail: string
        isDealBreaker: boolean
        isNonNegotiable: boolean
        idealPosition: number
        minimumPosition: number
        effectivePosition: number | null
        rationale: string | null
        negotiationTips: string | null
        talkingPoints: string | null
        commonObjections: string | null
        counterArguments: string | null
    }[]
}

function buildCategoryContext(cat: CategoryResult, rules: PlaybookRule[]): NarrativeContext {
    // Match original rules for rich context fields
    const ruleMap = new Map(rules.map(r => [r.rule_id, r]))

    return {
        categoryName: cat.name,
        tier: getAlignmentTier(cat.score),
        score: cat.score,
        rulesTotal: cat.rulesTotal,
        rulesPassed: cat.rulesPassed,
        rulesFailed: cat.rulesFailed,
        rulesWarning: cat.rulesWarning,
        rules: cat.rules.map(sr => {
            const orig = ruleMap.get(sr.rule.rule_id)
            return {
                clauseName: sr.rule.clause_name,
                status: sr.status,
                score: sr.score,
                detail: sr.detail,
                isDealBreaker: sr.rule.is_deal_breaker,
                isNonNegotiable: sr.rule.is_non_negotiable,
                idealPosition: sr.rule.ideal_position,
                minimumPosition: sr.rule.minimum_position,
                effectivePosition: sr.effectivePosition,
                rationale: orig?.rationale || sr.rule.rationale || null,
                negotiationTips: orig?.negotiation_tips || null,
                talkingPoints: (orig as unknown as Record<string, unknown>)?.talking_points as string | null || null,
                commonObjections: (orig as unknown as Record<string, unknown>)?.common_objections as string | null || null,
                counterArguments: (orig as unknown as Record<string, unknown>)?.counter_arguments as string | null || null,
            }
        }),
    }
}

async function generateCategoryNarrative(
    ctx: NarrativeContext,
    client: Anthropic,
    perspective: PlaybookPerspective
): Promise<{ riskSummary: string; remediation: string; keyFindings: string[] }> {
    const perspectiveLabel = perspective === 'provider' ? 'provider' : 'customer'

    const systemPrompt = `You are a senior contract risk analyst writing a professional alignment report. You are assessing how well a contract template aligns with the acquiring company's playbook from the ${perspectiveLabel} perspective.

Your output must be precise, professional, and actionable. Write as if this will be read by General Counsel.

Return ONLY valid JSON (no markdown, no backticks):
{
    "riskSummary": "2-4 sentences describing the risk posture for this category. Be specific about what is and isn't aligned.",
    "remediation": "2-4 sentences of specific remediation recommendations. Reference the playbook positions and what needs to change.",
    "keyFindings": ["finding 1", "finding 2", "finding 3"]
}

Key findings should be 1-sentence each, max 5 findings. Focus on the most material issues.`

    const userPrompt = `Analyse this category from the alignment report:

Category: ${ctx.categoryName}
Alignment Tier: ${getTierLabel(ctx.tier)} (${ctx.score}%)
Rules: ${ctx.rulesTotal} total — ${ctx.rulesPassed} aligned, ${ctx.rulesWarning} partially aligned, ${ctx.rulesFailed} material gaps

Rule details:
${JSON.stringify(ctx.rules, null, 2)}`

    try {
        const response = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 600,
            temperature: 0,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        })

        const textBlock = response.content.find(b => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') {
            return fallbackNarrative(ctx)
        }

        const parsed = JSON.parse(textBlock.text)
        return {
            riskSummary: parsed.riskSummary || 'Analysis pending.',
            remediation: parsed.remediation || 'Review recommended.',
            keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
        }
    } catch (error) {
        console.error(`[AlignmentEngine] Narrative generation failed for ${ctx.categoryName}:`, error)
        return fallbackNarrative(ctx)
    }
}

function fallbackNarrative(ctx: NarrativeContext): { riskSummary: string; remediation: string; keyFindings: string[] } {
    const tier = getTierLabel(ctx.tier)
    const failedRules = ctx.rules.filter(r => r.status === 'fail' || r.status === 'breach')
    const dealBreakers = failedRules.filter(r => r.isDealBreaker)

    let riskSummary = `${ctx.categoryName} is rated ${tier} with a score of ${ctx.score}%.`
    if (failedRules.length > 0) {
        riskSummary += ` ${failedRules.length} rule${failedRules.length > 1 ? 's' : ''} fall below the playbook minimum position.`
    }
    if (dealBreakers.length > 0) {
        riskSummary += ` ${dealBreakers.length} deal-breaker rule${dealBreakers.length > 1 ? 's are' : ' is'} in breach.`
    }

    const remediation = failedRules.length > 0
        ? `Review and renegotiate the ${failedRules.map(r => r.clauseName).join(', ')} clause${failedRules.length > 1 ? 's' : ''} to align with the playbook minimum positions.`
        : `No immediate action required. Continue monitoring during negotiation.`

    const keyFindings = ctx.rules
        .filter(r => r.status !== 'pass' && r.status !== 'excluded')
        .slice(0, 5)
        .map(r => `${r.clauseName}: ${r.detail}`)

    return { riskSummary, remediation, keyFindings }
}

async function generateExecutiveSummary(
    narratives: CategoryNarrative[],
    compliance: ComplianceResult,
    auditName: string,
    client: Anthropic,
    perspective: PlaybookPerspective
): Promise<string> {
    const perspectiveLabel = perspective === 'provider' ? 'provider' : 'customer'
    const aligned = narratives.filter(n => n.tier === 'aligned').length
    const partial = narratives.filter(n => n.tier === 'partially_aligned').length
    const gaps = narratives.filter(n => n.tier === 'material_gap').length

    const systemPrompt = `You are a senior contract risk analyst writing the executive summary for a contract alignment report. This is for the ${perspectiveLabel} reviewing how a contract template aligns with their negotiation playbook.

Write a concise 3-5 sentence executive summary suitable for General Counsel or a senior legal team. Cover: overall alignment posture, key risk areas, and recommended priority actions.

Return ONLY the summary text — no JSON, no markdown formatting, no headers.`

    const categorySummaries = narratives.map(n =>
        `${n.categoryName} (${getTierLabel(n.tier)}, ${n.score}%): ${n.riskSummary}`
    ).join('\n')

    const userPrompt = `Report: ${auditName}
Overall Score: ${compliance.overallScore}%
Categories: ${aligned} aligned, ${partial} partially aligned, ${gaps} material gaps
Red Line Breaches: ${compliance.redLineBreaches}

Category summaries:
${categorySummaries}`

    try {
        const response = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 300,
            temperature: 0,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        })

        const textBlock = response.content.find(b => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') {
            return fallbackExecutiveSummary(compliance, aligned, partial, gaps)
        }
        return textBlock.text.trim()
    } catch (error) {
        console.error('[AlignmentEngine] Executive summary generation failed:', error)
        return fallbackExecutiveSummary(compliance, aligned, partial, gaps)
    }
}

function fallbackExecutiveSummary(
    compliance: ComplianceResult,
    aligned: number,
    partial: number,
    gaps: number
): string {
    let summary = `This contract template scores ${compliance.overallScore}% overall alignment against the playbook. `
    summary += `Of ${aligned + partial + gaps} categories assessed, ${aligned} are fully aligned, ${partial} are partially aligned, and ${gaps} represent material gaps. `
    if (compliance.redLineBreaches > 0) {
        summary += `${compliance.redLineBreaches} red line breach${compliance.redLineBreaches > 1 ? 'es were' : ' was'} detected, requiring immediate attention. `
    }
    if (gaps > 0) {
        const gapNames = compliance.categories
            .filter(c => c.score < 60)
            .map(c => c.name)
            .slice(0, 3)
        summary += `Priority remediation areas include: ${gapNames.join(', ')}.`
    }
    return summary
}


// ============================================================================
// SECTION 5: MAIN ENGINE — RUN ALIGNMENT AUDIT
// ============================================================================

export async function runAlignmentAudit(
    rules: PlaybookRule[],
    clauses: ContractClause[],
    focusCategories: string[],
    perspective: PlaybookPerspective,
    auditName: string,
    options?: { skipAI?: boolean }
): Promise<AlignmentReportResult> {
    // Step 1: Calculate filtered compliance
    const compliance = calculateFilteredCompliance(rules, clauses, focusCategories, perspective)

    // Step 2: Build category narratives
    const narratives: CategoryNarrative[] = []

    if (options?.skipAI) {
        // Static-only mode (no API key or testing)
        for (const cat of compliance.categories) {
            const ctx = buildCategoryContext(cat, rules)
            const fallback = fallbackNarrative(ctx)
            narratives.push({
                normalisedKey: cat.normalisedKey,
                categoryName: cat.name,
                tier: getAlignmentTier(cat.score),
                score: cat.score,
                ...fallback,
            })
        }

        const aligned = narratives.filter(n => n.tier === 'aligned').length
        const partial = narratives.filter(n => n.tier === 'partially_aligned').length
        const gaps = narratives.filter(n => n.tier === 'material_gap').length

        return {
            compliance,
            narratives,
            executiveSummary: fallbackExecutiveSummary(compliance, aligned, partial, gaps),
            focusCategories,
            totalRulesInScope: rules.length,
            alignedCount: aligned,
            partialCount: partial,
            materialGapCount: gaps,
            generatedAt: new Date().toISOString(),
        }
    }

    // Step 3: AI-powered narrative generation
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
        console.warn('[AlignmentEngine] No ANTHROPIC_API_KEY — using fallback narratives')
        return runAlignmentAudit(rules, clauses, focusCategories, perspective, auditName, { skipAI: true })
    }

    const client = new Anthropic({ apiKey })

    // Generate narratives concurrently (batch of 3 at a time to avoid rate limits)
    const BATCH_SIZE = 3
    for (let i = 0; i < compliance.categories.length; i += BATCH_SIZE) {
        const batch = compliance.categories.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.all(
            batch.map(async (cat) => {
                const ctx = buildCategoryContext(cat, rules)
                const narrative = await generateCategoryNarrative(ctx, client, perspective)
                return {
                    normalisedKey: cat.normalisedKey,
                    categoryName: cat.name,
                    tier: getAlignmentTier(cat.score),
                    score: cat.score,
                    ...narrative,
                } as CategoryNarrative
            })
        )
        narratives.push(...batchResults)
    }

    // Step 4: Executive summary
    const executiveSummary = await generateExecutiveSummary(
        narratives, compliance, auditName, client, perspective
    )

    const aligned = narratives.filter(n => n.tier === 'aligned').length
    const partial = narratives.filter(n => n.tier === 'partially_aligned').length
    const gaps = narratives.filter(n => n.tier === 'material_gap').length

    return {
        compliance,
        narratives,
        executiveSummary,
        focusCategories,
        totalRulesInScope: rules.length,
        alignedCount: aligned,
        partialCount: partial,
        materialGapCount: gaps,
        generatedAt: new Date().toISOString(),
    }
}


// ============================================================================
// SECTION 6: CLAUSE-CENTRIC AUDIT — TYPES
// ============================================================================

/**
 * AI-generated assessment for a single clause-rule pair.
 */
export interface ClauseNarrative {
    clauseId: string
    ruleId: string
    tier: AlignmentTier
    score: number
    alignmentAssessment: string      // How the clause relates to the rule
    gapAnalysis: string              // Where and how they differ
    recommendation: string           // What should change
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Full result from the clause-centric alignment engine.
 */
export interface ClauseCentricAlignmentResult {
    auditSummary: ClauseAuditSummary
    clauseNarratives: ClauseNarrative[]
    executiveSummary: string
    focusCategories: string[]
    generatedAt: string
}


// ============================================================================
// SECTION 7: CLAUSE-CENTRIC AI NARRATIVE — PER CLAUSE-RULE PAIR
// ============================================================================

interface ClauseNarrativeContext {
    clauseName: string
    clauseNumber: string | null
    clauseText: string | null
    clausePosition: number | null
    clausePositionLabel: string | null
    clarenceAssessment: string | null
    clarenceSummary: string | null
    clarenceFairness: string | null

    ruleName: string
    ruleRationale: string | null
    ruleIdealPosition: number
    ruleMinimumPosition: number
    idealPositionLabel: string | null
    minimumPositionLabel: string | null
    ruleIsDealBreaker: boolean
    ruleIsNonNegotiable: boolean

    score: number
    status: string
    detail: string
    matchMethod: string
    matchConfidence: number
}

function buildClauseNarrativeContext(result: ClauseAuditResult): ClauseNarrativeContext {
    return {
        clauseName: result.clauseName,
        clauseNumber: result.clauseNumber,
        clauseText: result.clauseText,
        clausePosition: result.clausePosition,
        clausePositionLabel: result.clausePositionLabel,
        clarenceAssessment: result.clarenceAssessment,
        clarenceSummary: result.clarenceSummary,
        clarenceFairness: result.clarenceFairness,

        ruleName: result.ruleClauseName,
        ruleRationale: result.ruleRationale,
        ruleIdealPosition: result.ruleIdealPosition,
        ruleMinimumPosition: result.ruleMinimumPosition,
        idealPositionLabel: result.idealPositionLabel,
        minimumPositionLabel: result.minimumPositionLabel,
        ruleIsDealBreaker: result.ruleIsDealBreaker,
        ruleIsNonNegotiable: result.ruleIsNonNegotiable,

        score: result.score,
        status: result.status,
        detail: result.detail,
        matchMethod: result.matchMethod,
        matchConfidence: result.matchConfidence,
    }
}

async function generateClauseNarrative(
    ctx: ClauseNarrativeContext,
    client: Anthropic,
    perspective: PlaybookPerspective
): Promise<{ alignmentAssessment: string; gapAnalysis: string; recommendation: string; riskLevel: 'low' | 'medium' | 'high' | 'critical' }> {
    const perspectiveLabel = perspective === 'provider' ? 'provider' : 'customer'

    const systemPrompt = `You are a senior contract risk analyst assessing how a specific contract clause aligns with a specific playbook rule. You are writing from the ${perspectiveLabel} perspective.

Your output must be precise, professional, and actionable. Write as if this will be read by General Counsel reviewing each clause individually.

Return ONLY valid JSON (no markdown, no backticks):
{
    "alignmentAssessment": "2-3 sentences. How does this clause relate to the playbook rule? What does the clause say vs what the rule requires? Be specific about positions.",
    "gapAnalysis": "2-3 sentences. Where do they differ? Quantify the gap in position terms if possible. If aligned, state so clearly.",
    "recommendation": "1-2 sentences. What action, if any, should be taken? Reference specific position targets.",
    "riskLevel": "low | medium | high | critical"
}

Risk level guidance:
- "low": Score >= 80, clause is aligned or near-aligned with the playbook
- "medium": Score 60-79, clause partially aligns but has gaps worth noting
- "high": Score < 60, material gap that needs remediation
- "critical": Score < 60 AND the rule is a deal-breaker or non-negotiable`

    const clauseSection = ctx.clauseText
        ? `\nClause Text (excerpt):\n"${ctx.clauseText.substring(0, 800)}${ctx.clauseText.length > 800 ? '...' : ''}"`
        : ''

    const clarenceSection = ctx.clarenceAssessment
        ? `\nCLARENCE Pre-Assessment: ${ctx.clarenceAssessment}${ctx.clarenceSummary ? `\nSummary: ${ctx.clarenceSummary}` : ''}${ctx.clarenceFairness ? `\nFairness: ${ctx.clarenceFairness}` : ''}`
        : ''

    const userPrompt = `Assess this clause against its matched playbook rule:

CLAUSE: ${ctx.clauseName}${ctx.clauseNumber ? ` (${ctx.clauseNumber})` : ''}
Clause Position: ${ctx.clausePositionLabel || (ctx.clausePosition != null ? `${ctx.clausePosition}/100` : 'Not assessed')}${clauseSection}${clarenceSection}

PLAYBOOK RULE: ${ctx.ruleName}
Ideal Position: ${ctx.idealPositionLabel || `${ctx.ruleIdealPosition}/100`}
Minimum Acceptable: ${ctx.minimumPositionLabel || `${ctx.ruleMinimumPosition}/100`}
Deal Breaker: ${ctx.ruleIsDealBreaker ? 'YES' : 'No'}
Non-Negotiable: ${ctx.ruleIsNonNegotiable ? 'YES' : 'No'}
Rule Rationale: ${ctx.ruleRationale || 'Not specified'}

SCORING RESULT: ${ctx.status} — ${ctx.score}%
Detail: ${ctx.detail}
Match Method: ${ctx.matchMethod} (confidence: ${ctx.matchConfidence}%)`

    try {
        const response = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 500,
            temperature: 0,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        })

        const textBlock = response.content.find(b => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') {
            return fallbackClauseNarrative(ctx)
        }

        const parsed = JSON.parse(textBlock.text)
        return {
            alignmentAssessment: parsed.alignmentAssessment || 'Assessment pending.',
            gapAnalysis: parsed.gapAnalysis || 'Analysis pending.',
            recommendation: parsed.recommendation || 'Review recommended.',
            riskLevel: ['low', 'medium', 'high', 'critical'].includes(parsed.riskLevel) ? parsed.riskLevel : inferRiskLevel(ctx),
        }
    } catch (error) {
        console.error(`[AlignmentEngine] Clause narrative failed for ${ctx.clauseName}:`, error)
        return fallbackClauseNarrative(ctx)
    }
}

function inferRiskLevel(ctx: ClauseNarrativeContext): 'low' | 'medium' | 'high' | 'critical' {
    if (ctx.score < 60 && (ctx.ruleIsDealBreaker || ctx.ruleIsNonNegotiable)) return 'critical'
    if (ctx.score < 60) return 'high'
    if (ctx.score < 80) return 'medium'
    return 'low'
}

function fallbackClauseNarrative(ctx: ClauseNarrativeContext): {
    alignmentAssessment: string
    gapAnalysis: string
    recommendation: string
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
} {
    const riskLevel = inferRiskLevel(ctx)

    let alignmentAssessment = `The "${ctx.clauseName}" clause `
    if (ctx.clausePosition != null) {
        alignmentAssessment += `is assessed at position ${ctx.clausePositionLabel || ctx.clausePosition + '/100'}. `
        alignmentAssessment += `The playbook requires an ideal position of ${ctx.idealPositionLabel || ctx.ruleIdealPosition + '/100'} with a minimum of ${ctx.minimumPositionLabel || ctx.ruleMinimumPosition + '/100'}.`
    } else {
        alignmentAssessment += `has not yet been position-assessed by CLARENCE. The playbook requires an ideal position of ${ctx.idealPositionLabel || ctx.ruleIdealPosition + '/100'}.`
    }

    let gapAnalysis: string
    if (ctx.score >= 80) {
        gapAnalysis = `This clause is aligned with the playbook rule. The clause position falls within the acceptable range defined by the playbook.`
    } else if (ctx.score >= 60) {
        gapAnalysis = `There is a partial gap between the clause position and the playbook target. The clause meets the minimum threshold but falls short of the ideal position.`
    } else {
        gapAnalysis = `There is a material gap between the clause and the playbook rule. The clause position falls below the minimum acceptable threshold of ${ctx.minimumPositionLabel || ctx.ruleMinimumPosition + '/100'}.`
    }

    let recommendation: string
    if (ctx.score >= 80) {
        recommendation = 'No immediate action required. Continue monitoring during negotiation.'
    } else if (ctx.ruleIsDealBreaker) {
        recommendation = `DEAL BREAKER — this clause must be renegotiated to at least position ${ctx.minimumPositionLabel || ctx.ruleMinimumPosition + '/100'} before proceeding.`
    } else if (ctx.score < 60) {
        recommendation = `Renegotiate this clause to bring it to at least the minimum position of ${ctx.minimumPositionLabel || ctx.ruleMinimumPosition + '/100'}.`
    } else {
        recommendation = `Consider negotiating this clause closer to the ideal position of ${ctx.idealPositionLabel || ctx.ruleIdealPosition + '/100'}.`
    }

    return { alignmentAssessment, gapAnalysis, recommendation, riskLevel }
}


// ============================================================================
// SECTION 8: CLAUSE-CENTRIC EXECUTIVE SUMMARY
// ============================================================================

async function generateClauseCentricExecutiveSummary(
    auditSummary: ClauseAuditSummary,
    clauseNarratives: ClauseNarrative[],
    auditName: string,
    client: Anthropic,
    perspective: PlaybookPerspective
): Promise<string> {
    const perspectiveLabel = perspective === 'provider' ? 'provider' : 'customer'

    const criticalItems = clauseNarratives.filter(n => n.riskLevel === 'critical')
    const highItems = clauseNarratives.filter(n => n.riskLevel === 'high')

    const systemPrompt = `You are a senior contract risk analyst writing the executive summary for a clause-by-clause contract alignment report. This is for the ${perspectiveLabel} reviewing how individual contract clauses align with their negotiation playbook.

Write a concise 4-6 sentence executive summary suitable for General Counsel. Cover: overall alignment posture, number of clauses assessed vs rules, critical/high risk items, and recommended priority actions.

Return ONLY the summary text — no JSON, no markdown formatting, no headers.`

    const clauseHighlights = clauseNarratives
        .filter(n => n.riskLevel === 'critical' || n.riskLevel === 'high')
        .slice(0, 6)
        .map(n => {
            const result = auditSummary.clauseResults.find(r => r.clauseId === n.clauseId)
            return `${result?.clauseName || 'Unknown'} (${n.riskLevel}, ${n.score}%): ${n.gapAnalysis}`
        })
        .join('\n')

    const userPrompt = `Report: ${auditName}
Overall Score: ${auditSummary.overallScore}%
Clauses Assessed: ${auditSummary.clausesAssessed} of ${auditSummary.totalClauses} clauses matched to ${auditSummary.totalRules} rules
Aligned: ${auditSummary.alignedCount} | Partially Aligned: ${auditSummary.partialCount} | Material Gaps: ${auditSummary.materialGapCount}
Red Line Breaches: ${auditSummary.redLineBreaches}
Unmatched Clauses: ${auditSummary.unmatchedClauses.length} | Unmatched Rules: ${auditSummary.unmatchedRules.length}

Critical/High Risk Clauses:
${clauseHighlights || 'None identified.'}`

    try {
        const response = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 400,
            temperature: 0,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        })

        const textBlock = response.content.find(b => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') {
            return fallbackClauseCentricExecutiveSummary(auditSummary, criticalItems.length, highItems.length)
        }
        return textBlock.text.trim()
    } catch (error) {
        console.error('[AlignmentEngine] Clause-centric executive summary failed:', error)
        return fallbackClauseCentricExecutiveSummary(auditSummary, criticalItems.length, highItems.length)
    }
}

function fallbackClauseCentricExecutiveSummary(
    summary: ClauseAuditSummary,
    criticalCount: number,
    highCount: number
): string {
    let text = `This contract template scores ${summary.overallScore}% overall alignment against the playbook. `
    text += `${summary.clausesAssessed} clauses were matched and assessed against ${summary.totalRules} playbook rules. `
    text += `Of these, ${summary.alignedCount} are aligned, ${summary.partialCount} are partially aligned, and ${summary.materialGapCount} represent material gaps. `
    if (summary.redLineBreaches > 0) {
        text += `${summary.redLineBreaches} red line breach${summary.redLineBreaches > 1 ? 'es were' : ' was'} detected, requiring immediate attention. `
    }
    if (criticalCount > 0 || highCount > 0) {
        text += `Priority remediation is needed for ${criticalCount} critical and ${highCount} high-risk clause${criticalCount + highCount > 1 ? 's' : ''}. `
    }
    if (summary.unmatchedRules.length > 0) {
        text += `${summary.unmatchedRules.length} playbook rule${summary.unmatchedRules.length > 1 ? 's have' : ' has'} no matching clause in the template — these represent potential coverage gaps.`
    }
    return text
}


// ============================================================================
// SECTION 9: MAIN ENGINE — RUN CLAUSE-CENTRIC ALIGNMENT AUDIT
// ============================================================================

export async function runClauseCentricAlignmentAudit(
    clauses: AuditClause[],
    rules: PlaybookRule[],
    focusCategories: string[],
    perspective: PlaybookPerspective,
    auditName: string,
    existingMappings?: { playbook_rule_id: string; template_clause_id: string; match_method: string; match_confidence: number; match_reason: string | null }[],
    options?: { skipAI?: boolean }
): Promise<ClauseCentricAlignmentResult> {
    // Step 1: Filter rules to focus categories
    const focusSet = new Set(focusCategories)
    const filteredRules = focusSet.size > 0
        ? rules.filter(r => focusSet.has(normaliseCategory(r.category)))
        : rules

    // Step 2: Run the clause-centric compliance engine
    const auditSummary = runClauseCentricAudit(clauses, filteredRules, existingMappings, perspective)

    // Step 3: Generate per-clause AI narratives
    const clauseNarratives: ClauseNarrative[] = []

    if (options?.skipAI) {
        // Static fallback mode
        for (const result of auditSummary.clauseResults) {
            const ctx = buildClauseNarrativeContext(result)
            const fallback = fallbackClauseNarrative(ctx)
            clauseNarratives.push({
                clauseId: result.clauseId,
                ruleId: result.ruleId,
                tier: getAlignmentTier(result.score),
                score: result.score,
                ...fallback,
            })
        }

        return {
            auditSummary,
            clauseNarratives,
            executiveSummary: fallbackClauseCentricExecutiveSummary(
                auditSummary,
                clauseNarratives.filter(n => n.riskLevel === 'critical').length,
                clauseNarratives.filter(n => n.riskLevel === 'high').length
            ),
            focusCategories,
            generatedAt: new Date().toISOString(),
        }
    }

    // Step 4: AI-powered narratives
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
        console.warn('[AlignmentEngine] No ANTHROPIC_API_KEY — using fallback clause narratives')
        return runClauseCentricAlignmentAudit(clauses, rules, focusCategories, perspective, auditName, existingMappings, { skipAI: true })
    }

    const client = new Anthropic({ apiKey })

    // Generate narratives in batches of 3 to respect rate limits
    const BATCH_SIZE = 3
    for (let i = 0; i < auditSummary.clauseResults.length; i += BATCH_SIZE) {
        const batch = auditSummary.clauseResults.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.all(
            batch.map(async (result) => {
                const ctx = buildClauseNarrativeContext(result)
                const narrative = await generateClauseNarrative(ctx, client, perspective)
                return {
                    clauseId: result.clauseId,
                    ruleId: result.ruleId,
                    tier: getAlignmentTier(result.score),
                    score: result.score,
                    ...narrative,
                } as ClauseNarrative
            })
        )
        clauseNarratives.push(...batchResults)
    }

    // Step 5: Executive summary
    const executiveSummary = await generateClauseCentricExecutiveSummary(
        auditSummary, clauseNarratives, auditName, client, perspective
    )

    return {
        auditSummary,
        clauseNarratives,
        executiveSummary,
        focusCategories,
        generatedAt: new Date().toISOString(),
    }
}
