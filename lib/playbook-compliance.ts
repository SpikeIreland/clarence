// ============================================================================
// FILE: lib/playbook-compliance.ts
// PURPOSE: Category normalisation + compliance calculation engine
// USED BY: Document Centre page (PlaybookComplianceIndicator component)
// ============================================================================

// ============================================================================
// SECTION 1: INTERFACES
// ============================================================================

export interface PlaybookRangeContext {
    value_type: 'duration' | 'percentage' | 'currency' | 'count' | 'boolean' | 'text' | null
    range_unit: string | null
    scale_points: { position: number; label: string; value: number }[]
    source: 'parsed' | 'manual' | 'inferred'
}

export interface PlaybookRule {
    rule_id: string
    playbook_id: string
    clause_code?: string
    clause_name: string
    category: string
    ideal_position: number
    minimum_position: number
    maximum_position: number
    fallback_position: number
    is_deal_breaker: boolean
    is_non_negotiable: boolean
    requires_approval_below: number | null
    importance_level: number
    escalation_trigger: string | null
    escalation_contact: string | null
    escalation_contact_email: string | null
    rationale: string | null
    negotiation_tips: string | null
    range_context: PlaybookRangeContext | null
    source_quote: string | null
    source_context: {
        section_ref?: string
        section_name?: string
        parent_context?: string
    } | null
    quality_flags: string[] | null
    review_accepted: boolean
    display_order?: number
    updated_at?: string | null
    schedule_type?: string | null      // null = main body rule, non-null = schedule-specific rule
}

export interface ContractClause {
    clause_id: string
    clause_name: string
    category: string
    clarence_position: number | null
    initiator_position: number | null
    respondent_position: number | null
    customer_position: number | null
    is_header: boolean
}

export type PlaybookPerspective = 'customer' | 'provider'

export interface PlaybookInfo {
    playbook_id: string
    playbook_name: string
    company_id: string
    rules_extracted: number | null
    ai_confidence_score: number | null
}

export type RuleStatus = 'pass' | 'acceptable' | 'warning' | 'fail' | 'breach' | 'escalation' | 'excluded'

export interface ScoredRule {
    rule: PlaybookRule
    status: RuleStatus
    score: number          // 0-100
    effectivePosition: number | null
    matchedClauseCount: number
    detail: string
    normalisedCategory: string
}

export interface CategoryResult {
    name: string               // Display name (title case)
    normalisedKey: string      // Normalised key for matching
    rules: ScoredRule[]
    rulesTotal: number
    rulesPassed: number
    rulesFailed: number
    rulesWarning: number
    score: number              // 0-100 weighted average
}

export interface RedLineResult {
    rule: PlaybookRule
    status: 'clear' | 'breach'
    effectivePosition: number | null
    detail: string
    escalationTriggered: boolean
    escalationContact: string | null
    normalisedCategory: string
}

export interface FlexibilityResult {
    rule: PlaybookRule
    playbookOpening: number    // ideal_position
    acceptableMin: number      // minimum_position
    acceptableMax: number      // maximum_position
    agreedPosition: number | null
    flexibilityLevel: 'high' | 'medium' | 'low'
    consumedPct: number        // 0-100
    normalisedCategory: string
}

export interface ComplianceResult {
    overallScore: number
    totalPlaybookRules: number
    rulesChecked: number
    rulesPassed: number
    rulesFailed: number
    rulesWarning: number
    redLineBreaches: number
    categories: CategoryResult[]
    redLines: RedLineResult[]
    flexibility: FlexibilityResult[]
    unmatchedCategories: string[]
}

// ============================================================================
// SECTION 2: CATEGORY NORMALISATION
// ============================================================================

/**
 * Bidirectional mapping from both playbook categories (lowercase_underscored)
 * and contract categories (Title Case With Spaces) to a common normalised key.
 * 
 * This was determined by live SQL queries on 27 Feb 2026 comparing:
 * - playbook_rules.category values
 * - uploaded_contract_clauses.category values
 */
const CATEGORY_MAP: Record<string, string> = {
    // Playbook categories (lowercase, underscored)
    'confidentiality': 'confidentiality',
    'data_protection': 'data_protection',
    'insurance': 'insurance',
    'intellectual_property': 'intellectual_property',
    'liability': 'liability',
    'payment': 'payment',
    'service_levels': 'service_levels',
    'termination': 'termination',
    'warranties': 'service_levels',

    // Contract categories (title case, spaces) — only those that differ from above
    'intellectual property': 'intellectual_property',
    'charges and payment': 'payment',
    'service levels': 'service_levels',
    'term and termination': 'termination',
    'service': 'service',
    'audit': 'audit',
    'definitions': 'definitions',
    'dispute resolution': 'dispute_resolution',
    'general': 'general',
}

/**
 * Display names for normalised category keys
 */
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
    'confidentiality': 'Confidentiality',
    'data_protection': 'Data Protection',
    'insurance': 'Insurance',
    'intellectual_property': 'Intellectual Property',
    'liability': 'Liability',
    'payment': 'Payment & Charges',
    'service_levels': 'Service Levels & Warranties',
    'termination': 'Term & Termination',
    'service': 'Service Delivery',
    'audit': 'Audit',
    'definitions': 'Definitions',
    'dispute_resolution': 'Dispute Resolution',
    'general': 'General',
    'uncategorised': 'Uncategorised',
}

export function normaliseCategory(raw: string | null | undefined): string {
    if (!raw) return 'uncategorised'
    const key = raw.toLowerCase().replace(/_/g, ' ').trim()
    return CATEGORY_MAP[key] || key.replace(/\s+/g, '_')
}

export function getCategoryDisplayName(normalisedKey: string): string {
    return CATEGORY_DISPLAY_NAMES[normalisedKey] || normalisedKey
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
}

// ============================================================================
// SECTION 2B: RANGE CONTEXT FOR PLAYBOOK RULES
// ============================================================================

const CATEGORY_RANGE_DEFAULTS: Record<string, PlaybookRangeContext> = {
    liability: {
        value_type: 'percentage', range_unit: '% of annual fees', source: 'inferred',
        scale_points: [
            { position: 1, label: '50%', value: 50 },
            { position: 3, label: '100%', value: 100 },
            { position: 5, label: '150%', value: 150 },
            { position: 7, label: '200%', value: 200 },
            { position: 10, label: 'Unlimited', value: 999 },
        ],
    },
    payment: {
        value_type: 'duration', range_unit: 'days', source: 'inferred',
        scale_points: [
            { position: 1, label: '90 days', value: 90 },
            { position: 3, label: '60 days', value: 60 },
            { position: 5, label: '30 days', value: 30 },
            { position: 7, label: '14 days', value: 14 },
            { position: 10, label: '7 days', value: 7 },
        ],
    },
    termination: {
        value_type: 'duration', range_unit: 'months notice', source: 'inferred',
        scale_points: [
            { position: 1, label: '1 month', value: 1 },
            { position: 3, label: '3 months', value: 3 },
            { position: 5, label: '6 months', value: 6 },
            { position: 7, label: '12 months', value: 12 },
            { position: 10, label: '24 months', value: 24 },
        ],
    },
    confidentiality: {
        value_type: 'duration', range_unit: 'years', source: 'inferred',
        scale_points: [
            { position: 1, label: '1 year', value: 1 },
            { position: 3, label: '2 years', value: 2 },
            { position: 5, label: '3 years', value: 3 },
            { position: 7, label: '5 years', value: 5 },
            { position: 10, label: 'Perpetual', value: 99 },
        ],
    },
    service_levels: {
        value_type: 'percentage', range_unit: '% uptime', source: 'inferred',
        scale_points: [
            { position: 1, label: '95%', value: 95 },
            { position: 3, label: '99%', value: 99 },
            { position: 5, label: '99.5%', value: 99.5 },
            { position: 7, label: '99.9%', value: 99.9 },
            { position: 10, label: '99.99%', value: 99.99 },
        ],
    },
    insurance: {
        value_type: 'currency', range_unit: 'GBP', source: 'inferred',
        scale_points: [
            { position: 1, label: '£500K', value: 500000 },
            { position: 3, label: '£1M', value: 1000000 },
            { position: 5, label: '£2M', value: 2000000 },
            { position: 7, label: '£5M', value: 5000000 },
            { position: 10, label: '£10M', value: 10000000 },
        ],
    },
    data_protection: {
        value_type: 'duration', range_unit: 'hours (breach notify)', source: 'inferred',
        scale_points: [
            { position: 1, label: 'No SLA', value: 0 },
            { position: 3, label: '72 hrs', value: 72 },
            { position: 5, label: '48 hrs', value: 48 },
            { position: 7, label: '24 hrs', value: 24 },
            { position: 10, label: '4 hrs', value: 4 },
        ],
    },
    intellectual_property: {
        value_type: 'duration', range_unit: 'years retention', source: 'inferred',
        scale_points: [
            { position: 1, label: '0 years', value: 0 },
            { position: 3, label: '1 year', value: 1 },
            { position: 5, label: '3 years', value: 3 },
            { position: 7, label: '5 years', value: 5 },
            { position: 10, label: 'Perpetual', value: 99 },
        ],
    },
}

export function getCategoryFallbackContext(normalisedCategory: string): PlaybookRangeContext | null {
    return CATEGORY_RANGE_DEFAULTS[normalisedCategory] || null
}

export function getEffectiveRangeContext(rule: PlaybookRule): PlaybookRangeContext | null {
    if (rule.range_context) return rule.range_context
    return getCategoryFallbackContext(normaliseCategory(rule.category))
}

export function translateRulePosition(rule: PlaybookRule, position: number): string | null {
    const ctx = getEffectiveRangeContext(rule)
    if (!ctx?.scale_points?.length) return null
    const exact = ctx.scale_points.find(p => Math.abs(p.position - position) < 0.5)
    if (exact) return exact.label
    const sorted = [...ctx.scale_points].sort((a, b) =>
        Math.abs(a.position - position) - Math.abs(b.position - position)
    )
    return sorted[0]?.label || null
}

// ============================================================================
// SECTION 3: POSITION RESOLUTION
// ============================================================================

/**
 * Determines which position to use for compliance comparison.
 * Priority: agreed average → initiator → customer (legacy) → clarence
 */
export function getEffectivePosition(clause: ContractClause): number | null {
    // If both parties have positions, use the average (agreed state)
    if (clause.initiator_position != null && clause.respondent_position != null) {
        return (clause.initiator_position + clause.respondent_position) / 2
    }

    // Initiator position takes priority
    if (clause.initiator_position != null) return clause.initiator_position

    // Legacy customer_position field
    if (clause.customer_position != null) return clause.customer_position

    // Fall back to CLARENCE's assessment
    if (clause.clarence_position != null) return Number(clause.clarence_position)

    return null
}

/**
 * Returns only party-set positions (no CLARENCE fallback).
 * Used by the compliance engine so that pre-negotiation state = 100% compliant.
 * Once a party moves a position, that position drives compliance scoring.
 */
function getPartyPosition(clause: ContractClause): number | null {
    if (clause.initiator_position != null && clause.respondent_position != null) {
        return (clause.initiator_position + clause.respondent_position) / 2
    }
    if (clause.initiator_position != null) return clause.initiator_position
    if (clause.customer_position != null) return clause.customer_position
    return null
}

/**
 * Calculate average effective position for all clauses in a category
 */
function getCategoryAveragePosition(
    clauses: ContractClause[],
    normalisedCategory: string
): { avgPosition: number | null; matchedCount: number } {
    const matchingClauses = clauses.filter(c =>
        !c.is_header && normaliseCategory(c.category) === normalisedCategory
    )

    if (matchingClauses.length === 0) {
        return { avgPosition: null, matchedCount: 0 }
    }

    const positions = matchingClauses
        .map(c => getPartyPosition(c))
        .filter((p): p is number => p !== null)

    if (positions.length === 0) {
        return { avgPosition: null, matchedCount: matchingClauses.length }
    }

    const avg = positions.reduce((sum, p) => sum + p, 0) / positions.length
    return { avgPosition: Math.round(avg * 10) / 10, matchedCount: matchingClauses.length }
}

// ============================================================================
// SECTION 4: RULE SCORING
// ============================================================================

/**
 * Convert a contract position (customer-oriented scale) to match a
 * provider playbook's scale. Provider positions use 10=provider-strong,
 * 1=provider-weak, while contract positions use 10=customer-strong,
 * 1=customer-weak (= provider-strong). Converting: providerEquiv = 11 - pos.
 */
function alignPosition(position: number, perspective: PlaybookPerspective): number {
    return perspective === 'provider' ? 11 - position : position
}

/**
 * Score a single playbook rule against an effective position.
 * Uses a TOP-DOWN compliance model:
 *   - At or above ideal     = 100% (fully compliant)
 *   - Between minimum-ideal = 85%  (compliant, within acceptable range)
 *   - Below minimum         = 30%  (non-compliant)
 *   - Deal breaker breach   = 0%   (critical breach)
 *
 * When perspective is 'provider', the effective position (on the customer
 * scale) is converted to the provider scale before comparison.
 */
export function scoreRule(
    rule: PlaybookRule,
    effectivePosition: number | null,
    perspective: PlaybookPerspective = 'customer'
): {
    status: RuleStatus
    score: number
    detail: string
} {
    if (effectivePosition === null) {
        return {
            status: 'excluded',
            score: 0,
            detail: 'No matching contract clauses found for this category'
        }
    }

    // Convert contract position to match playbook perspective
    const pos = alignPosition(effectivePosition, perspective)

    // Deal breaker below minimum = BREACH (most critical — 0%)
    if (rule.is_deal_breaker && pos < rule.minimum_position) {
        return {
            status: 'breach',
            score: 0,
            detail: `Position ${effectivePosition} is below minimum ${rule.minimum_position} — DEAL BREAKER`
        }
    }

    // Non-negotiable below ideal = FAIL (30%)
    if (rule.is_non_negotiable && pos < rule.ideal_position) {
        return {
            status: 'fail',
            score: 30,
            detail: `Position ${effectivePosition} is below required ${rule.ideal_position} — NON-NEGOTIABLE`
        }
    }

    // At or above ideal = PASS (100%)
    if (pos >= rule.ideal_position) {
        return {
            status: 'pass',
            score: 100,
            detail: `Position ${effectivePosition} meets or exceeds ideal (${rule.ideal_position})`
        }
    }

    // Within acceptable range — minimum to ideal (85%)
    if (pos >= rule.minimum_position) {
        // Check if below escalation threshold
        if (rule.requires_approval_below != null && pos < rule.requires_approval_below) {
            return {
                status: 'warning',
                score: 85,
                detail: `Position ${effectivePosition} is within range but below escalation threshold (${rule.requires_approval_below}) — requires approval`
            }
        }

        return {
            status: 'acceptable',
            score: 85,
            detail: `Position ${effectivePosition} is within acceptable range (${rule.minimum_position}-${rule.ideal_position})`
        }
    }

    // Below minimum — escalation territory (30%)
    if (rule.requires_approval_below != null && pos < rule.requires_approval_below) {
        return {
            status: 'escalation',
            score: 30,
            detail: `Position ${effectivePosition} is below minimum (${rule.minimum_position}) and escalation threshold (${rule.requires_approval_below})`
        }
    }

    // Below minimum but not a deal breaker (30%)
    return {
        status: 'fail',
        score: 30,
        detail: `Position ${effectivePosition} is below minimum acceptable (${rule.minimum_position})`
    }
}

// ============================================================================
// SECTION 5: RED LINE ANALYSIS
// ============================================================================

function analyseRedLines(
    rules: PlaybookRule[],
    clauses: ContractClause[],
    perspective: PlaybookPerspective = 'customer'
): RedLineResult[] {
    // Red lines = is_deal_breaker OR is_non_negotiable
    const redLineRules = rules.filter(r => r.is_deal_breaker || r.is_non_negotiable)

    return redLineRules.map(rule => {
        const normCat = normaliseCategory(rule.category)
        const { avgPosition, matchedCount } = getCategoryAveragePosition(clauses, normCat)

        // Pre-negotiation: clauses exist but no party has moved → not breached
        if (avgPosition === null && matchedCount > 0) {
            return {
                rule,
                status: 'clear' as const,
                effectivePosition: null,
                detail: 'Pre-negotiation — no positions set yet',
                escalationTriggered: false,
                escalationContact: rule.escalation_contact,
                normalisedCategory: normCat,
            }
        }

        const pos = avgPosition !== null ? alignPosition(avgPosition, perspective) : null

        const isBreach = pos !== null && (
            (rule.is_deal_breaker && pos < rule.minimum_position) ||
            (rule.is_non_negotiable && pos < rule.ideal_position)
        )

        const escalationTriggered = rule.requires_approval_below != null &&
            avgPosition != null &&
            avgPosition < rule.requires_approval_below

        let detail: string
        if (avgPosition === null) {
            detail = 'No matching clauses in contract — cannot assess'
        } else if (isBreach) {
            detail = rule.is_deal_breaker
                ? `Agreed at position ${avgPosition} — below minimum ${rule.minimum_position}. ${rule.rationale || ''}`
                : `Agreed at position ${avgPosition} — below required ${rule.ideal_position}. ${rule.rationale || ''}`
        } else {
            detail = `Agreed at position ${avgPosition} — ${rule.is_deal_breaker ? `above minimum threshold (${rule.minimum_position})` : `meets required position (${rule.ideal_position})`}`
        }

        return {
            rule,
            status: isBreach ? 'breach' as const : 'clear' as const,
            effectivePosition: avgPosition,
            detail: detail.trim(),
            escalationTriggered,
            escalationContact: rule.escalation_contact,
            normalisedCategory: normCat,
        }
    })
}

// ============================================================================
// SECTION 6: FLEXIBILITY ANALYSIS
// ============================================================================

function analyseFlexibility(
    rules: PlaybookRule[],
    clauses: ContractClause[],
    perspective: PlaybookPerspective = 'customer'
): FlexibilityResult[] {
    // Flexibility rules = wide position range (ideal - minimum >= 2)
    const flexRules = rules.filter(r => {
        const range = r.ideal_position - r.minimum_position
        return range >= 2 && !r.is_non_negotiable
    })

    return flexRules.map(rule => {
        const normCat = normaliseCategory(rule.category)
        const { avgPosition } = getCategoryAveragePosition(clauses, normCat)
        const pos = avgPosition !== null ? alignPosition(avgPosition, perspective) : null

        const flexRange = rule.ideal_position - rule.minimum_position
        let consumedPct = 0

        if (pos !== null && flexRange > 0) {
            const consumed = rule.ideal_position - pos
            consumedPct = Math.max(0, Math.min(100, Math.round((consumed / flexRange) * 100)))
        }

        // Classify flexibility level based on range width
        let flexibilityLevel: 'high' | 'medium' | 'low'
        if (flexRange >= 4) {
            flexibilityLevel = 'high'
        } else if (flexRange >= 3) {
            flexibilityLevel = 'medium'
        } else {
            flexibilityLevel = 'low'
        }

        return {
            rule,
            playbookOpening: rule.ideal_position,
            acceptableMin: rule.minimum_position,
            acceptableMax: rule.maximum_position,
            agreedPosition: avgPosition,
            flexibilityLevel,
            consumedPct,
            normalisedCategory: normCat,
        }
    })
}

// ============================================================================
// SECTION 7: CATEGORY AGGREGATION
// ============================================================================

function aggregateByCategory(
    rules: PlaybookRule[],
    clauses: ContractClause[],
    perspective: PlaybookPerspective = 'customer'
): CategoryResult[] {
    // Group rules by normalised category
    const categoryMap = new Map<string, PlaybookRule[]>()

    for (const rule of rules) {
        const normCat = normaliseCategory(rule.category)
        if (!categoryMap.has(normCat)) {
            categoryMap.set(normCat, [])
        }
        categoryMap.get(normCat)!.push(rule)
    }

    const results: CategoryResult[] = []

    for (const [normCat, catRules] of categoryMap.entries()) {
        const { avgPosition, matchedCount } = getCategoryAveragePosition(clauses, normCat)

        const scoredRules: ScoredRule[] = catRules.map(rule => {
            // Pre-negotiation: clauses exist but no party has moved → assume compliant
            if (avgPosition === null && matchedCount > 0) {
                return {
                    rule,
                    status: 'pass' as RuleStatus,
                    score: 100,
                    effectivePosition: null,
                    matchedClauseCount: matchedCount,
                    detail: 'Pre-negotiation — compliant with company playbook',
                    normalisedCategory: normCat,
                }
            }

            const { status, score, detail } = scoreRule(rule, avgPosition, perspective)
            return {
                rule,
                status,
                score,
                effectivePosition: avgPosition,
                matchedClauseCount: matchedCount,
                detail,
                normalisedCategory: normCat,
            }
        })

        // Only include categories that have at least one scorable rule
        const scorableRules = scoredRules.filter(sr => sr.status !== 'excluded')
        if (scorableRules.length === 0) {
            continue
        }

        // Calculate weighted category score
        let categoryScore = 0
        const totalWeight = scorableRules.reduce((sum, sr) => sum + sr.rule.importance_level, 0)
        const weightedSum = scorableRules.reduce(
            (sum, sr) => sum + (sr.score * sr.rule.importance_level), 0
        )
        categoryScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0

        const rulesPassed = scoredRules.filter(sr =>
            sr.status === 'pass'
        ).length
        const rulesFailed = scoredRules.filter(sr =>
            sr.status === 'fail' || sr.status === 'breach' || sr.status === 'escalation'
        ).length
        const rulesWarning = scoredRules.filter(sr =>
            sr.status === 'warning' || sr.status === 'acceptable'
        ).length

        results.push({
            name: getCategoryDisplayName(normCat),
            normalisedKey: normCat,
            rules: scoredRules,
            rulesTotal: catRules.length,
            rulesPassed,
            rulesFailed,
            rulesWarning,
            score: categoryScore,
        })
    }

    // Sort by score ascending (worst categories first)
    results.sort((a, b) => a.score - b.score)

    return results
}

// ============================================================================
// SECTION 8: MAIN CALCULATION FUNCTION
// ============================================================================

/**
 * Main entry point: calculates full playbook compliance from rules + clauses.
 * Call this from the Document Centre after fetching both datasets.
 *
 * When perspective is 'provider', contract positions (customer-oriented)
 * are converted to the provider scale before comparison against playbook rules.
 */
export function calculatePlaybookCompliance(
    rules: PlaybookRule[],
    clauses: ContractClause[],
    perspective: PlaybookPerspective = 'customer'
): ComplianceResult {
    // Filter to active, non-header clauses only
    const activeClauses = clauses.filter(c => !c.is_header)

    // Get all unique normalised categories from contract
    const contractCategories = new Set(
        activeClauses.map(c => normaliseCategory(c.category))
    )

    // Find playbook categories with no contract match
    const playbookCategories = new Set(rules.map(r => normaliseCategory(r.category)))
    const unmatchedCategories = [...playbookCategories].filter(pc => !contractCategories.has(pc))

    // Run analyses
    const categories = aggregateByCategory(rules, activeClauses, perspective)
    const redLines = analyseRedLines(rules, activeClauses, perspective)
    const flexibility = analyseFlexibility(rules, activeClauses, perspective)

    // Calculate overall score (weighted average of category scores, excluding unmatched)
    const matchedCategories = categories.filter(c => !unmatchedCategories.includes(c.normalisedKey))
    let overallScore = 0
    if (matchedCategories.length > 0) {
        const totalRules = matchedCategories.reduce((sum, c) => sum + c.rulesTotal, 0)
        const weightedSum = matchedCategories.reduce(
            (sum, c) => sum + (c.score * c.rulesTotal), 0
        )
        overallScore = totalRules > 0 ? Math.round(weightedSum / totalRules) : 0
    }

    // Aggregate counts
    const allScoredRules = categories.flatMap(c => c.rules)
    const scorableRules = allScoredRules.filter(sr => sr.status !== 'excluded')

    return {
        overallScore,
        totalPlaybookRules: rules.length,
        rulesChecked: scorableRules.length,
        rulesPassed: scorableRules.filter(sr => sr.status === 'pass').length,
        rulesFailed: scorableRules.filter(sr =>
            sr.status === 'fail' || sr.status === 'breach' || sr.status === 'escalation'
        ).length,
        rulesWarning: scorableRules.filter(sr =>
            sr.status === 'warning' || sr.status === 'acceptable'
        ).length,
        redLineBreaches: redLines.filter(rl => rl.status === 'breach').length,
        categories,
        redLines,
        flexibility,
        unmatchedCategories,
    }
}


// ============================================================================
// SECTION 9: SINGLE-CLAUSE COMPLIANCE CHECK
// ============================================================================

/**
 * Check compliance impact of a single position move.
 * More efficient than full recalculation — focuses on the affected clause
 * and returns before/after scores plus affected rules.
 */
export function checkSingleClauseCompliance(
    rules: PlaybookRule[],
    allClauses: ContractClause[],
    targetClauseId: string,
    proposedPosition: number,
    party: 'initiator' | 'respondent' | 'customer' | 'provider',
    perspective: PlaybookPerspective = 'customer'
): {
    affectedRules: ScoredRule[]
    categoryScore: number
    overallScore: number
    previousOverallScore: number
    redLineBreaches: RedLineResult[]
} {
    // 1. Calculate current compliance (before move)
    const currentResult = calculatePlaybookCompliance(rules, allClauses, perspective)

    // 2. Create modified clauses with proposed position
    const isInitiatorSide = party === 'initiator' || party === 'customer'
    const modifiedClauses = allClauses.map(c => {
        if (c.clause_id !== targetClauseId) return c
        return isInitiatorSide
            ? { ...c, initiator_position: proposedPosition, customer_position: proposedPosition }
            : { ...c, respondent_position: proposedPosition }
    })

    // 3. Calculate new compliance
    const newResult = calculatePlaybookCompliance(rules, modifiedClauses, perspective)

    // 4. Find affected rules (in the same category as the target clause)
    const targetClause = allClauses.find(c => c.clause_id === targetClauseId)
    const targetCategory = targetClause ? normaliseCategory(targetClause.category) : null
    const affectedCategory = targetCategory
        ? newResult.categories.find(cat => cat.normalisedKey === targetCategory)
        : null

    return {
        affectedRules: affectedCategory?.rules || [],
        categoryScore: affectedCategory?.score || 0,
        overallScore: newResult.overallScore,
        previousOverallScore: currentResult.overallScore,
        redLineBreaches: newResult.redLines.filter(rl => rl.status === 'breach'),
    }
}


// ============================================================================
// SECTION 8: SCHEDULE-AWARE RULE FILTERING
// ============================================================================

/**
 * Filter playbook rules by scope: main body only, schedule-specific, or all.
 */
export function filterRulesByScope(
    rules: PlaybookRule[],
    scope: 'main_body' | 'schedule' | 'all',
    scheduleType?: string
): PlaybookRule[] {
    if (scope === 'main_body') return rules.filter(r => !r.schedule_type)
    if (scope === 'schedule' && scheduleType) return rules.filter(r => r.schedule_type === scheduleType)
    if (scope === 'schedule') return rules.filter(r => !!r.schedule_type)
    return rules
}

/**
 * Group schedule rules by their schedule_type.
 */
export function groupRulesByScheduleType(rules: PlaybookRule[]): Record<string, PlaybookRule[]> {
    const groups: Record<string, PlaybookRule[]> = {}
    for (const rule of rules) {
        if (rule.schedule_type) {
            if (!groups[rule.schedule_type]) groups[rule.schedule_type] = []
            groups[rule.schedule_type].push(rule)
        }
    }
    return groups
}


// ============================================================================
// SECTION 10: CLAUSE-CENTRIC AUDIT TYPES AND FUNCTIONS
// ============================================================================

/**
 * Extended clause interface with text content for audit display.
 * This is what the audit engine receives — richer than the negotiation-time ContractClause.
 */
export interface AuditClause {
    clause_id: string
    clause_number: string | null
    clause_name: string
    category: string
    content: string | null          // default_text from template_clauses
    clarence_position: number | null
    clarence_assessment: string | null
    clarence_summary: string | null
    clarence_fairness: string | null
    range_mapping: Record<string, unknown> | null  // clause-level position bar data
    is_header: boolean
    display_order: number | null
}

/**
 * A rule-to-clause mapping from the playbook_rule_clause_map table or
 * generated dynamically by the matching function.
 */
export interface ClauseRuleMapping {
    clause: AuditClause
    rule: PlaybookRule
    matchMethod: string             // auto_exact | auto_containment | auto_category | manual | dynamic_category
    matchConfidence: number         // 0-100
    matchReason: string | null
}

/**
 * The result of scoring a single clause against its matched rule.
 * This is the primary data unit for the clause-centric audit.
 */
export interface ClauseAuditResult {
    // Clause data
    clauseId: string
    clauseNumber: string | null
    clauseName: string
    clauseCategory: string
    clauseText: string | null
    clausePosition: number | null   // clarence_position

    // Rule data
    ruleId: string
    ruleClauseName: string
    ruleCategory: string
    ruleRationale: string | null
    ruleSourceQuote: string | null
    ruleIdealPosition: number
    ruleMinimumPosition: number
    ruleMaximumPosition: number
    ruleFallbackPosition: number
    ruleIsDealBreaker: boolean
    ruleIsNonNegotiable: boolean
    ruleImportanceLevel: number

    // Match metadata
    matchMethod: string
    matchConfidence: number

    // Scoring
    status: RuleStatus
    score: number                   // 0-100
    detail: string                  // human-readable scoring explanation

    // Market context
    marketRangeContext: PlaybookRangeContext | null  // scale_points, value_type, range_unit
    clausePositionLabel: string | null   // translated clause position (e.g. "30 days")
    idealPositionLabel: string | null    // translated ideal (e.g. "14 days")
    minimumPositionLabel: string | null  // translated minimum (e.g. "60 days")
    maximumPositionLabel: string | null  // translated maximum (e.g. "90 days")
    fallbackPositionLabel: string | null // translated fallback (e.g. "45 days")

    // CLARENCE pre-assessment
    clarenceAssessment: string | null
    clarenceSummary: string | null
    clarenceFairness: string | null

    // Clause range data (for position bar rendering)
    rangeMapping: Record<string, unknown> | null
}

/**
 * Summary result for the clause-centric audit.
 */
export interface ClauseAuditSummary {
    clauseResults: ClauseAuditResult[]
    unmatchedClauses: AuditClause[]     // clauses with no matching rule
    unmatchedRules: PlaybookRule[]       // rules with no matching clause
    overallScore: number
    totalClauses: number
    totalRules: number
    clausesAssessed: number
    alignedCount: number                // score >= 80
    partialCount: number                // score >= 60 and < 80
    materialGapCount: number            // score < 60
    redLineBreaches: number
}

/**
 * Match clauses to rules using pre-existing mappings from playbook_rule_clause_map,
 * or fall back to dynamic category-based matching.
 *
 * Unlike the old category-average approach, this produces one mapping per clause
 * (or per clause-rule pair when multiple rules apply to the same clause).
 */
export function matchClausesToRules(
    clauses: AuditClause[],
    rules: PlaybookRule[],
    existingMappings?: { playbook_rule_id: string; template_clause_id: string; match_method: string; match_confidence: number; match_reason: string | null }[]
): { mappings: ClauseRuleMapping[]; unmatchedClauses: AuditClause[]; unmatchedRules: PlaybookRule[] } {
    const mappings: ClauseRuleMapping[] = []
    const matchedClauseIds = new Set<string>()
    const matchedRuleIds = new Set<string>()

    const clauseMap = new Map(clauses.map(c => [c.clause_id, c]))
    const ruleMap = new Map(rules.map(r => [r.rule_id, r]))

    // 1. Use pre-existing DB mappings first (highest quality)
    if (existingMappings && existingMappings.length > 0) {
        for (const em of existingMappings) {
            const clause = clauseMap.get(em.template_clause_id)
            const rule = ruleMap.get(em.playbook_rule_id)
            if (clause && rule) {
                mappings.push({
                    clause,
                    rule,
                    matchMethod: em.match_method,
                    matchConfidence: em.match_confidence,
                    matchReason: em.match_reason,
                })
                matchedClauseIds.add(clause.clause_id)
                matchedRuleIds.add(rule.rule_id)
            }
        }
    }

    // 2. Dynamic matching for unmatched rules → find best clause by category + name similarity
    const unmatchedRulesForDynamic = rules.filter(r => !matchedRuleIds.has(r.rule_id))
    const activeClauses = clauses.filter(c => !c.is_header)

    for (const rule of unmatchedRulesForDynamic) {
        const ruleNormCat = normaliseCategory(rule.category)

        // Find clauses in the same normalised category
        const categoryClauses = activeClauses.filter(c =>
            normaliseCategory(c.category) === ruleNormCat
        )

        if (categoryClauses.length === 0) continue

        // Try name similarity first — pick best match
        let bestClause: AuditClause | null = null
        let bestConfidence = 0
        let bestMethod = 'dynamic_category'
        let bestReason = 'Category match'

        for (const clause of categoryClauses) {
            const rName = rule.clause_name.toLowerCase().trim()
            const cName = clause.clause_name.toLowerCase().trim()

            if (rName === cName) {
                bestClause = clause
                bestConfidence = 100
                bestMethod = 'dynamic_exact'
                bestReason = 'Exact clause name match'
                break
            }

            if (cName.includes(rName) || rName.includes(cName)) {
                if (75 > bestConfidence) {
                    bestClause = clause
                    bestConfidence = 75
                    bestMethod = 'dynamic_containment'
                    bestReason = 'Name containment match'
                }
            }
        }

        // Fall back to first clause in category by display_order
        if (!bestClause) {
            bestClause = categoryClauses.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))[0]
            bestConfidence = 50
        }

        if (bestClause) {
            mappings.push({
                clause: bestClause,
                rule,
                matchMethod: bestMethod,
                matchConfidence: bestConfidence,
                matchReason: bestReason,
            })
            matchedClauseIds.add(bestClause.clause_id)
            matchedRuleIds.add(rule.rule_id)
        }
    }

    const unmatchedClauses = activeClauses.filter(c => !matchedClauseIds.has(c.clause_id))
    const unmatchedRules = rules.filter(r => !matchedRuleIds.has(r.rule_id))

    return { mappings, unmatchedClauses, unmatchedRules }
}

/**
 * Score all clause-to-rule mappings and produce the full clause-centric audit result.
 * Uses clarence_position as the effective position (not party positions).
 */
export function runClauseCentricAudit(
    clauses: AuditClause[],
    rules: PlaybookRule[],
    existingMappings?: { playbook_rule_id: string; template_clause_id: string; match_method: string; match_confidence: number; match_reason: string | null }[],
    perspective: PlaybookPerspective = 'customer'
): ClauseAuditSummary {
    const { mappings, unmatchedClauses, unmatchedRules } = matchClausesToRules(clauses, rules, existingMappings)

    const clauseResults: ClauseAuditResult[] = []

    for (const mapping of mappings) {
        const { clause, rule } = mapping

        // Use clarence_position directly — this is the pre-negotiation assessment
        const effectivePosition = clause.clarence_position != null
            ? Number(clause.clarence_position)
            : null

        // Score using the existing scoring function
        const { status, score, detail } = scoreRule(rule, effectivePosition, perspective)

        // Get market range context
        const marketRangeContext = getEffectiveRangeContext(rule)

        // Translate positions to human-readable labels
        const clausePositionLabel = effectivePosition != null
            ? translateRulePosition(rule, effectivePosition)
            : null
        const idealPositionLabel = translateRulePosition(rule, rule.ideal_position)
        const minimumPositionLabel = translateRulePosition(rule, rule.minimum_position)
        const maximumPositionLabel = translateRulePosition(rule, rule.maximum_position)
        const fallbackPositionLabel = translateRulePosition(rule, rule.fallback_position)

        clauseResults.push({
            clauseId: clause.clause_id,
            clauseNumber: clause.clause_number,
            clauseName: clause.clause_name,
            clauseCategory: clause.category,
            clauseText: clause.content,
            clausePosition: effectivePosition,

            ruleId: rule.rule_id,
            ruleClauseName: rule.clause_name,
            ruleCategory: rule.category,
            ruleRationale: rule.rationale,
            ruleSourceQuote: rule.source_quote || null,
            ruleIdealPosition: rule.ideal_position,
            ruleMinimumPosition: rule.minimum_position,
            ruleMaximumPosition: rule.maximum_position,
            ruleFallbackPosition: rule.fallback_position,
            ruleIsDealBreaker: rule.is_deal_breaker,
            ruleIsNonNegotiable: rule.is_non_negotiable,
            ruleImportanceLevel: rule.importance_level,

            matchMethod: mapping.matchMethod,
            matchConfidence: mapping.matchConfidence,

            status,
            score,
            detail,

            marketRangeContext,
            clausePositionLabel,
            idealPositionLabel,
            minimumPositionLabel,
            maximumPositionLabel,
            fallbackPositionLabel,

            clarenceAssessment: clause.clarence_assessment,
            clarenceSummary: clause.clarence_summary,
            clarenceFairness: clause.clarence_fairness,

            rangeMapping: clause.range_mapping,
        })
    }

    // Sort by clause display order (clause-first reading order)
    clauseResults.sort((a, b) => {
        // Extract numeric part from clause number for natural sort
        const numA = a.clauseNumber?.match(/(\d+)/)?.[1]
        const numB = b.clauseNumber?.match(/(\d+)/)?.[1]
        if (numA && numB) return parseInt(numA) - parseInt(numB)
        return (a.clauseName || '').localeCompare(b.clauseName || '')
    })

    // Calculate summary scores
    const scorableResults = clauseResults.filter(r => r.status !== 'excluded')
    const totalWeight = scorableResults.reduce((sum, r) => sum + r.ruleImportanceLevel, 0)
    const weightedSum = scorableResults.reduce((sum, r) => sum + (r.score * r.ruleImportanceLevel), 0)
    const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0

    const alignedCount = scorableResults.filter(r => r.score >= 80).length
    const partialCount = scorableResults.filter(r => r.score >= 60 && r.score < 80).length
    const materialGapCount = scorableResults.filter(r => r.score < 60).length
    const redLineBreaches = scorableResults.filter(r => r.status === 'breach').length

    return {
        clauseResults,
        unmatchedClauses,
        unmatchedRules,
        overallScore,
        totalClauses: clauses.filter(c => !c.is_header).length,
        totalRules: rules.length,
        clausesAssessed: scorableResults.length,
        alignedCount,
        partialCount,
        materialGapCount,
        redLineBreaches,
    }
}