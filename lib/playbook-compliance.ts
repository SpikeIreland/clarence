// ============================================================================
// FILE: lib/playbook-compliance.ts
// PURPOSE: Category normalisation + compliance calculation engine
// USED BY: Document Centre page (PlaybookComplianceIndicator component)
// ============================================================================

// ============================================================================
// SECTION 1: INTERFACES
// ============================================================================

export interface PlaybookRule {
    rule_id: string
    playbook_id: string
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
}

export function normaliseCategory(raw: string): string {
    const key = raw.toLowerCase().replace(/_/g, ' ').trim()
    return CATEGORY_MAP[key] || key.replace(/\s+/g, '_')
}

export function getCategoryDisplayName(normalisedKey: string): string {
    return CATEGORY_DISPLAY_NAMES[normalisedKey] || normalisedKey
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
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
        .map(c => getEffectivePosition(c))
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
 * Score a single playbook rule against an effective position.
 * Uses a TOP-DOWN compliance model:
 *   - At or above ideal     = 100% (fully compliant)
 *   - Between minimum-ideal = 85%  (compliant, within acceptable range)
 *   - Below minimum         = 30%  (non-compliant)
 *   - Deal breaker breach   = 0%   (critical breach)
 */
export function scoreRule(rule: PlaybookRule, effectivePosition: number | null): {
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

    // Deal breaker below minimum = BREACH (most critical — 0%)
    if (rule.is_deal_breaker && effectivePosition < rule.minimum_position) {
        return {
            status: 'breach',
            score: 0,
            detail: `Position ${effectivePosition} is below minimum ${rule.minimum_position} — DEAL BREAKER`
        }
    }

    // Non-negotiable below ideal = FAIL (30%)
    if (rule.is_non_negotiable && effectivePosition < rule.ideal_position) {
        return {
            status: 'fail',
            score: 30,
            detail: `Position ${effectivePosition} is below required ${rule.ideal_position} — NON-NEGOTIABLE`
        }
    }

    // At or above ideal = PASS (100%)
    if (effectivePosition >= rule.ideal_position) {
        return {
            status: 'pass',
            score: 100,
            detail: `Position ${effectivePosition} meets or exceeds ideal (${rule.ideal_position})`
        }
    }

    // Within acceptable range — minimum to ideal (85%)
    if (effectivePosition >= rule.minimum_position) {
        // Check if below escalation threshold
        if (rule.requires_approval_below != null && effectivePosition < rule.requires_approval_below) {
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
    if (rule.requires_approval_below != null && effectivePosition < rule.requires_approval_below) {
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
    clauses: ContractClause[]
): RedLineResult[] {
    // Red lines = is_deal_breaker OR is_non_negotiable
    const redLineRules = rules.filter(r => r.is_deal_breaker || r.is_non_negotiable)

    return redLineRules.map(rule => {
        const normCat = normaliseCategory(rule.category)
        const { avgPosition } = getCategoryAveragePosition(clauses, normCat)

        const isBreach = avgPosition !== null && (
            (rule.is_deal_breaker && avgPosition < rule.minimum_position) ||
            (rule.is_non_negotiable && avgPosition < rule.ideal_position)
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
    clauses: ContractClause[]
): FlexibilityResult[] {
    // Flexibility rules = wide position range (ideal - minimum >= 2)
    const flexRules = rules.filter(r => {
        const range = r.ideal_position - r.minimum_position
        return range >= 2 && !r.is_non_negotiable
    })

    return flexRules.map(rule => {
        const normCat = normaliseCategory(rule.category)
        const { avgPosition } = getCategoryAveragePosition(clauses, normCat)

        const flexRange = rule.ideal_position - rule.minimum_position
        let consumedPct = 0

        if (avgPosition !== null && flexRange > 0) {
            const consumed = rule.ideal_position - avgPosition
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
    clauses: ContractClause[]
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
            const { status, score, detail } = scoreRule(rule, avgPosition)
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
 */
export function calculatePlaybookCompliance(
    rules: PlaybookRule[],
    clauses: ContractClause[]
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
    const categories = aggregateByCategory(rules, activeClauses)
    const redLines = analyseRedLines(rules, activeClauses)
    const flexibility = analyseFlexibility(rules, activeClauses)

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