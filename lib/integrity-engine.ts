// ============================================================================
// FILE: lib/integrity-engine.ts
// PURPOSE: Integrity Engine Phase 1 — Structured Quality Gate
//
// Validates every CLARENCE AI output against session data before it reaches
// the user. Deterministic checks only — no additional AI calls.
//
// Four checks:
//   1. Party Name Accuracy — detects swaps, placeholders, wrong role labels
//   2. Position Data Accuracy — numeric position claims vs stored data
//   3. Leverage Data Accuracy — leverage percentage claims vs stored data
//   4. Terminology Relevance — contract-type-appropriate language
//
// Design principles:
//   - Never breaks the chat (triple-layer error handling)
//   - Never awaited for logging (fire-and-forget)
//   - <50ms added latency (deterministic string checks only)
//   - Only auto-corrects party name placeholders (everything else flagged)
// ============================================================================

import { type SessionContext } from './session-context-builder'
import { type RoleContext, CONTRACT_TYPE_DEFINITIONS } from './role-matrix'
import { createServiceRoleClient } from './supabase'

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export type CheckVerdict = 'pass' | 'corrected' | 'flagged'

export interface CorrectionDetail {
    original: string
    replacement: string
    reason: string
}

export interface CheckResult {
    checkName: string
    verdict: CheckVerdict
    details: string
    corrections?: CorrectionDetail[]
}

export interface IntegrityResult {
    responseText: string
    overallVerdict: CheckVerdict
    gateTimeMs: number
    checks: CheckResult[]
    score: number
    sessionId: string
}

export interface QualityMeta {
    verified: boolean
    score: number
    verdict: CheckVerdict
    checks: number
    corrections: number
    flags: number
    gateTimeMs: number
}

type CheckFn = (
    responseText: string,
    ctx: SessionContext,
    roleContext: RoleContext | null
) => CheckResult

// ============================================================================
// SECTION 2: UTILITY
// ============================================================================

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ============================================================================
// SECTION 3: CHECK 1 — PARTY NAME ACCURACY
// ============================================================================

function checkPartyNameAccuracy(
    responseText: string,
    ctx: SessionContext,
    roleContext: RoleContext | null
): CheckResult {
    const corrections: CorrectionDetail[] = []
    const flags: string[] = []
    let text = responseText

    const customerName = ctx.parties.customer.companyName
    const providerName = ctx.parties.provider.companyName
    const isCustomerViewer = ctx.viewer.role === 'customer'
    const userPartyName = isCustomerViewer ? customerName : providerName
    const otherPartyName = isCustomerViewer ? providerName : customerName
    const userRoleLabel = roleContext?.userRoleLabel || (isCustomerViewer ? 'Customer' : 'Provider')
    const otherRoleLabel = roleContext?.counterpartyRoleLabel || (isCustomerViewer ? 'Provider' : 'Customer')

    // --- Placeholder detection and correction ---
    const placeholders = [
        /\[Customer Name\]/gi,
        /\[Provider Name\]/gi,
        /\[Company Name\]/gi,
        /\[Party A\]/gi,
        /\[Party B\]/gi,
        /\{customer_name\}/gi,
        /\{provider_name\}/gi,
        /\{company_name\}/gi,
    ]

    for (const ph of placeholders) {
        const matches = text.match(ph)
        if (matches) {
            for (const match of matches) {
                const isCustomerPlaceholder = /customer|party\s*a/i.test(match)
                const replacement = isCustomerPlaceholder ? customerName : providerName
                corrections.push({
                    original: match,
                    replacement,
                    reason: `Replaced placeholder with actual party name`,
                })
                text = text.replace(match, replacement)
            }
        }
    }

    // --- Party name swap detection ---
    // Check if "you/your" appears near the counterparty's name (suggests a swap)
    if (otherPartyName && otherPartyName.length > 2) {
        const escapedOther = escapeRegex(otherPartyName)
        // Pattern: "you" or "your" within 30 chars of counterparty name
        const swapPattern1 = new RegExp(
            `\\b(?:you|your)\\b.{0,30}${escapedOther}`,
            'gi'
        )
        const swapPattern2 = new RegExp(
            `${escapedOther}.{0,30}\\b(?:you|your)\\b`,
            'gi'
        )
        const swap1Matches = text.match(swapPattern1) || []
        const swap2Matches = text.match(swapPattern2) || []
        const totalSwapMatches = swap1Matches.length + swap2Matches.length

        // Also check: does the response correctly use "you" with the viewer's name?
        const escapedUser = escapeRegex(userPartyName)
        const correctPattern1 = new RegExp(
            `\\b(?:you|your)\\b.{0,30}${escapedUser}`,
            'gi'
        )
        const correctPattern2 = new RegExp(
            `${escapedUser}.{0,30}\\b(?:you|your)\\b`,
            'gi'
        )
        const correctMatches = (text.match(correctPattern1) || []).length +
            (text.match(correctPattern2) || []).length

        if (totalSwapMatches > 0 && correctMatches === 0) {
            // Clear swap: "you" only appears near counterparty name, never near viewer name
            flags.push(
                `Party name swap detected: "you/your" appears near "${otherPartyName}" ` +
                `(counterparty) but not near "${userPartyName}" (viewer). ` +
                `${totalSwapMatches} instance(s) found.`
            )
        }
    }

    // --- Wrong role label for viewer ---
    if (roleContext) {
        // Check if the response says "you are the [counterparty role]"
        const wrongRolePattern = new RegExp(
            `\\b(?:you are|you're|as)\\s+(?:the\\s+)?${escapeRegex(otherRoleLabel)}\\b`,
            'gi'
        )
        const wrongRoleMatches = text.match(wrongRolePattern)
        if (wrongRoleMatches && wrongRoleMatches.length > 0) {
            flags.push(
                `Wrong role attribution: response says "${wrongRoleMatches[0]}" ` +
                `but viewer is the ${userRoleLabel}, not the ${otherRoleLabel}.`
            )
        }
    }

    // --- Determine verdict ---
    if (flags.length > 0) {
        return {
            checkName: 'party_name_accuracy',
            verdict: corrections.length > 0 ? 'corrected' : 'flagged',
            details: flags.join(' | '),
            corrections: corrections.length > 0 ? corrections : undefined,
        }
    }

    if (corrections.length > 0) {
        return {
            checkName: 'party_name_accuracy',
            verdict: 'corrected',
            details: `${corrections.length} placeholder(s) replaced with actual party names.`,
            corrections,
        }
    }

    return {
        checkName: 'party_name_accuracy',
        verdict: 'pass',
        details: 'Party names and role labels are accurate.',
    }
}

// ============================================================================
// SECTION 4: CHECK 2 — POSITION DATA ACCURACY
// ============================================================================

function checkPositionDataAccuracy(
    responseText: string,
    ctx: SessionContext,
    _roleContext: RoleContext | null
): CheckResult {
    const mismatches: string[] = []
    const isCustomerViewer = ctx.viewer.role === 'customer'

    // --- Check focused clause positions ---
    if (ctx.clauseContext) {
        const viewerPosition = isCustomerViewer
            ? ctx.clauseContext.customerPosition
            : ctx.clauseContext.providerPosition
        const otherPosition = isCustomerViewer
            ? ctx.clauseContext.providerPosition
            : ctx.clauseContext.customerPosition
        const gapSize = ctx.clauseContext.gapSize

        // Pattern: "your position" followed by a number
        const yourPosPattern = /\byour\s+(?:current\s+)?position\s+(?:is\s+|of\s+)?(\d+)/gi
        let match
        while ((match = yourPosPattern.exec(responseText)) !== null) {
            const claimed = parseInt(match[1])
            if (viewerPosition !== null && claimed !== viewerPosition) {
                mismatches.push(
                    `Claimed viewer position ${claimed}, actual is ${viewerPosition} ` +
                    `(clause: ${ctx.clauseContext.clauseName})`
                )
            }
        }

        // Pattern: "position of X" (general)
        const posOfPattern = /\bposition\s+of\s+(\d+)/gi
        while ((match = posOfPattern.exec(responseText)) !== null) {
            const claimed = parseInt(match[1])
            if (claimed < 1 || claimed > 10) {
                mismatches.push(`Position ${claimed} is outside valid 1-10 range`)
            }
        }

        // Pattern: "gap of X" or "gap is X"
        const gapPattern = /\bgap\s+(?:of|is)\s+(\d+)/gi
        while ((match = gapPattern.exec(responseText)) !== null) {
            const claimed = parseInt(match[1])
            if (gapSize !== null && Math.abs(claimed - gapSize) > 0) {
                mismatches.push(
                    `Claimed gap ${claimed}, actual gap is ${gapSize} ` +
                    `(clause: ${ctx.clauseContext.clauseName})`
                )
            }
        }

        // Pattern: "moved from X to Y" or "shifted from X to Y"
        const movePattern = /\b(?:moved|shifted|changed)\s+from\s+(?:position\s+)?(\d+)\s+to\s+(?:position\s+)?(\d+)/gi
        while ((match = movePattern.exec(responseText)) !== null) {
            const from = parseInt(match[1])
            const to = parseInt(match[2])
            if (from < 1 || from > 10 || to < 1 || to > 10) {
                mismatches.push(`Position move ${from}→${to} contains values outside 1-10 range`)
            }
        }
    }

    // --- Check alignment percentage ---
    const alignPattern = /\balignment\s+(?:of|is|at)\s+(\d+)%/gi
    let alignMatch
    while ((alignMatch = alignPattern.exec(responseText)) !== null) {
        const claimed = parseInt(alignMatch[1])
        const actual = ctx.positions.alignmentPercentage
        if (actual !== undefined && actual !== null && Math.abs(claimed - actual) > 2) {
            mismatches.push(
                `Claimed alignment ${claimed}%, actual is ${actual}%`
            )
        }
    }

    if (mismatches.length > 0) {
        return {
            checkName: 'position_data_accuracy',
            verdict: 'flagged',
            details: mismatches.join(' | '),
        }
    }

    return {
        checkName: 'position_data_accuracy',
        verdict: 'pass',
        details: 'Position references match session data.',
    }
}

// ============================================================================
// SECTION 5: CHECK 3 — LEVERAGE DATA ACCURACY
// ============================================================================

function checkLeverageDataAccuracy(
    responseText: string,
    ctx: SessionContext,
    _roleContext: RoleContext | null
): CheckResult {
    const mismatches: string[] = []
    const isCustomerViewer = ctx.viewer.role === 'customer'

    const viewerLeverage = isCustomerViewer
        ? ctx.leverage.tracker.customer
        : ctx.leverage.tracker.provider
    const otherLeverage = isCustomerViewer
        ? ctx.leverage.tracker.provider
        : ctx.leverage.tracker.customer
    const customerName = ctx.parties.customer.companyName
    const providerName = ctx.parties.provider.companyName
    const userPartyName = isCustomerViewer ? customerName : providerName
    const otherPartyName = isCustomerViewer ? providerName : customerName

    // Pattern: "your leverage" followed by a percentage
    const yourLevPattern = /\byour\s+(?:overall\s+)?leverage\s+(?:is\s+|of\s+|at\s+|stands\s+at\s+)?(\d+)%/gi
    let match
    while ((match = yourLevPattern.exec(responseText)) !== null) {
        const claimed = parseInt(match[1])
        if (viewerLeverage !== null && viewerLeverage !== undefined && Math.abs(claimed - viewerLeverage) > 2) {
            mismatches.push(
                `Claimed viewer leverage ${claimed}%, actual is ${viewerLeverage}%`
            )
        }
    }

    // Pattern: "[other party name]'s leverage" or "[other party name] leverage"
    if (otherPartyName && otherPartyName.length > 2) {
        const escapedOther = escapeRegex(otherPartyName)
        const otherLevPattern = new RegExp(
            `${escapedOther}(?:'s)?\\s+(?:overall\\s+)?leverage\\s+(?:is\\s+|of\\s+|at\\s+|stands\\s+at\\s+)?(\\d+)%`,
            'gi'
        )
        while ((match = otherLevPattern.exec(responseText)) !== null) {
            const claimed = parseInt(match[1])
            if (otherLeverage !== null && otherLeverage !== undefined && Math.abs(claimed - otherLeverage) > 2) {
                mismatches.push(
                    `Claimed ${otherPartyName}'s leverage ${claimed}%, actual is ${otherLeverage}%`
                )
            }
        }
    }

    // --- Swap detection: viewer's leverage number attributed to counterparty ---
    if (viewerLeverage && otherLeverage && Math.abs(viewerLeverage - otherLeverage) > 4) {
        // Only check for swaps when there's a meaningful difference
        const userLevInText = new RegExp(
            `\\byour\\s+(?:overall\\s+)?leverage\\s+(?:is\\s+|of\\s+|at\\s+|stands\\s+at\\s+)?${otherLeverage}%`,
            'gi'
        )
        if (userLevInText.test(responseText)) {
            mismatches.push(
                `Leverage swap: response attributes ${otherLeverage}% to viewer ` +
                `(viewer's actual leverage is ${viewerLeverage}%, ` +
                `${otherPartyName}'s is ${otherLeverage}%)`
            )
        }
    }

    // Pattern: "leverage balance" followed by a percentage
    const balancePattern = /\bleverage\s+balance\s+(?:is\s+|of\s+|at\s+)?(\d+)%/gi
    while ((match = balancePattern.exec(responseText)) !== null) {
        const claimed = parseInt(match[1])
        const actual = ctx.leverage.leverageBalance
        if (actual !== null && actual !== undefined && Math.abs(claimed - actual) > 2) {
            mismatches.push(
                `Claimed leverage balance ${claimed}%, actual is ${actual}%`
            )
        }
    }

    if (mismatches.length > 0) {
        return {
            checkName: 'leverage_data_accuracy',
            verdict: 'flagged',
            details: mismatches.join(' | '),
        }
    }

    return {
        checkName: 'leverage_data_accuracy',
        verdict: 'pass',
        details: 'Leverage references match session data.',
    }
}

// ============================================================================
// SECTION 6: CHECK 4 — TERMINOLOGY RELEVANCE
// ============================================================================

// Role labels that are common English words and should NOT be flagged
const GENERIC_ROLE_LABELS = new Set([
    'customer', 'provider', 'client', 'agent',
])

function checkTerminologyRelevance(
    responseText: string,
    ctx: SessionContext,
    roleContext: RoleContext | null
): CheckResult {
    const contractTypeKey = ctx.session.contractTypeKey
    if (!contractTypeKey) {
        return {
            checkName: 'terminology_relevance',
            verdict: 'pass',
            details: 'No contract type set, skipping terminology check.',
        }
    }

    // Get the correct role labels for this contract type
    const correctLabels = new Set<string>()
    if (roleContext) {
        correctLabels.add(roleContext.protectedPartyLabel.toLowerCase())
        correctLabels.add(roleContext.providingPartyLabel.toLowerCase())
    }

    // Build a set of role labels from OTHER contract types that would be wrong here
    const wrongLabels: { label: string; fromType: string }[] = []
    for (const ct of CONTRACT_TYPE_DEFINITIONS) {
        if (ct.contractTypeKey === contractTypeKey) continue

        for (const label of [ct.protectedPartyLabel, ct.providingPartyLabel]) {
            const lower = label.toLowerCase()
            // Skip if this label is correct for the current type
            if (correctLabels.has(lower)) continue
            // Skip generic terms that are common English
            if (GENERIC_ROLE_LABELS.has(lower)) continue
            // Skip single-word labels shorter than 5 chars (too common)
            if (lower.length < 5 && !lower.includes(' ')) continue

            wrongLabels.push({ label, fromType: ct.contractTypeName })
        }
    }

    // Scan the response for wrong labels near contract-role context words
    const contextWords = /\b(?:party|parties|role|contract|agreement|position|negotiate|negotiation|clause)\b/gi
    const flags: string[] = []

    for (const { label, fromType } of wrongLabels) {
        const escapedLabel = escapeRegex(label)
        const labelPattern = new RegExp(`\\b${escapedLabel}\\b`, 'gi')
        let match

        while ((match = labelPattern.exec(responseText)) !== null) {
            // Check if there's a contract-role context word within 50 chars
            const start = Math.max(0, match.index - 50)
            const end = Math.min(responseText.length, match.index + label.length + 50)
            const surrounding = responseText.substring(start, end)

            if (contextWords.test(surrounding)) {
                // Reset regex lastIndex since it's reused
                contextWords.lastIndex = 0
                flags.push(
                    `Term "${label}" (from ${fromType}) used in a contract-role context ` +
                    `but this is a ${ctx.session.contractType || contractTypeKey}. ` +
                    `Expected: ${roleContext?.protectedPartyLabel || 'N/A'} / ${roleContext?.providingPartyLabel || 'N/A'}.`
                )
                break // One flag per wrong label is enough
            }
            contextWords.lastIndex = 0
        }
    }

    if (flags.length > 0) {
        return {
            checkName: 'terminology_relevance',
            verdict: 'flagged',
            details: flags.join(' | '),
        }
    }

    return {
        checkName: 'terminology_relevance',
        verdict: 'pass',
        details: 'Terminology is appropriate for contract type.',
    }
}

// ============================================================================
// SECTION 7: MAIN VALIDATION FUNCTION
// ============================================================================

export function validateResponse(
    responseText: string,
    ctx: SessionContext,
    roleContext: RoleContext | null
): IntegrityResult {
    const start = Date.now()
    const checks: CheckResult[] = []

    const checkFns: CheckFn[] = [
        checkPartyNameAccuracy,
        checkPositionDataAccuracy,
        checkLeverageDataAccuracy,
        checkTerminologyRelevance,
    ]

    let correctedText = responseText

    for (const checkFn of checkFns) {
        try {
            const result = checkFn(correctedText, ctx, roleContext)
            checks.push(result)

            // Apply corrections from this check to the running text
            if (result.verdict === 'corrected' && result.corrections) {
                for (const correction of result.corrections) {
                    correctedText = correctedText.replaceAll(
                        correction.original,
                        correction.replacement
                    )
                }
            }
        } catch (checkError) {
            console.warn(`[IntegrityEngine] Check ${checkFn.name} failed (skipped):`, checkError)
            checks.push({
                checkName: checkFn.name || 'unknown',
                verdict: 'pass',
                details: 'Check skipped due to internal error.',
            })
        }
    }

    // Compute overall verdict
    const hasFlagged = checks.some(c => c.verdict === 'flagged')
    const hasCorrected = checks.some(c => c.verdict === 'corrected')
    const overallVerdict: CheckVerdict = hasFlagged ? 'flagged' : hasCorrected ? 'corrected' : 'pass'

    // Score: percentage of checks that passed clean
    const passCount = checks.filter(c => c.verdict === 'pass').length
    const score = checks.length > 0 ? Math.round((passCount / checks.length) * 100) : 100

    return {
        responseText: correctedText,
        overallVerdict,
        gateTimeMs: Date.now() - start,
        checks,
        score,
        sessionId: ctx.session.sessionNumber,
    }
}

// ============================================================================
// SECTION 8: QUALITY METADATA BUILDER
// ============================================================================

export function buildQualityMeta(result: IntegrityResult): QualityMeta {
    return {
        verified: result.overallVerdict === 'pass',
        score: result.score,
        verdict: result.overallVerdict,
        checks: result.checks.length,
        corrections: result.checks.filter(c => c.verdict === 'corrected').length,
        flags: result.checks.filter(c => c.verdict === 'flagged').length,
        gateTimeMs: result.gateTimeMs,
    }
}

// ============================================================================
// SECTION 9: FIRE-AND-FORGET LOGGING
// ============================================================================

export function logIntegrityResult(
    result: IntegrityResult,
    sessionId: string,
    viewerRole: string,
    contractTypeKey: string | null
): void {
    const doLog = async () => {
        try {
            const supabase = createServiceRoleClient()
            await supabase
                .from('integrity_quality_log')
                .insert({
                    session_id: sessionId,
                    viewer_role: viewerRole,
                    contract_type_key: contractTypeKey,
                    overall_verdict: result.overallVerdict,
                    score: result.score,
                    gate_time_ms: result.gateTimeMs,
                    checks_run: result.checks.length,
                    corrections_applied: result.checks.filter(c => c.verdict === 'corrected').length,
                    flags_raised: result.checks.filter(c => c.verdict === 'flagged').length,
                    check_results: result.checks,
                    response_length: result.responseText.length,
                })
        } catch (logError) {
            console.warn('[IntegrityEngine] Log failed (non-critical):', logError)
        }
    }
    doLog()
}

// ============================================================================
// SECTION 10: CORRECTION CANDIDATE GENERATION (Phase 2)
// ============================================================================

// Map check names to correction error types
const CHECK_TO_ERROR_TYPE: Record<string, string> = {
    party_name_accuracy: 'party_name',
    position_data_accuracy: 'position_data',
    leverage_data_accuracy: 'leverage_data',
    terminology_relevance: 'terminology',
}

export function generateCorrectionCandidates(
    result: IntegrityResult,
    ctx: SessionContext,
    contractTypeKey: string | null
): void {
    // Only generate candidates from flagged checks
    const flaggedChecks = result.checks.filter(c => c.verdict === 'flagged')
    if (flaggedChecks.length === 0 || !contractTypeKey) return

    const doGenerate = async () => {
        try {
            const supabase = createServiceRoleClient()
            const clauseCategory = ctx.clauseContext?.category || null

            for (const check of flaggedChecks) {
                const errorType = CHECK_TO_ERROR_TYPE[check.checkName] || check.checkName

                // Try to upsert: if this pattern already exists, increment times_applied
                const { data: existing } = await supabase
                    .from('clarence_corrections')
                    .select('correction_id, times_applied')
                    .eq('contract_type_key', contractTypeKey)
                    .eq('error_type', errorType)
                    .eq('source', 'quality_gate')
                    .eq('is_active', false)
                    .limit(1)
                    .maybeSingle()

                if (existing) {
                    // Increment occurrence count on existing candidate
                    await supabase
                        .from('clarence_corrections')
                        .update({
                            times_applied: (existing.times_applied || 0) + 1,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('correction_id', existing.correction_id)
                } else {
                    // Create new candidate (inactive — requires review)
                    await supabase
                        .from('clarence_corrections')
                        .insert({
                            contract_type_key: contractTypeKey,
                            clause_category: clauseCategory,
                            error_type: errorType,
                            error_pattern: check.details.substring(0, 500),
                            correction: `[Auto-detected] ${check.details.substring(0, 300)}`,
                            source: 'quality_gate',
                            confidence: 0.6,
                            is_active: false,
                        })
                }
            }
        } catch (genError) {
            console.warn('[IntegrityEngine] Correction candidate generation failed (non-critical):', genError)
        }
    }
    doGenerate()
}
