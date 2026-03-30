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
    calculatePlaybookCompliance,
    normaliseCategory,
    getCategoryDisplayName,
    getEffectiveRangeContext,
    translateRulePosition,
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
