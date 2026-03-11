// ============================================================================
// FILE: lib/session-prompt-builder.ts
// PURPOSE: Build CLARENCE system & user prompts from session context
//          Mirrors the n8n "Build Session Prompt" node exactly
// ============================================================================

import { type SessionContext } from './session-context-builder'
import { getRoleContext, type PartyRole } from './role-matrix'

// ============================================================================
// SECTION 1: ROLE LABELS (same as n8n workflow)
// ============================================================================

const ROLE_LABELS: Record<string, { protected: string; providing: string }> = {
    service_agreement: { protected: 'Customer', providing: 'Provider' },
    it_outsourcing: { protected: 'Customer', providing: 'Provider' },
    bpo_agreement: { protected: 'Customer', providing: 'Provider' },
    managed_services: { protected: 'Customer', providing: 'Provider' },
    saas_agreement: { protected: 'Subscriber', providing: 'Provider' },
    software_license: { protected: 'Licensee', providing: 'Licensor' },
    loan_agreement: { protected: 'Borrower', providing: 'Lender' },
    lease_agreement: { protected: 'Tenant', providing: 'Landlord' },
    employment_contract: { protected: 'Employee', providing: 'Employer' },
    nda_one_way: { protected: 'Disclosing Party', providing: 'Receiving Party' },
    nda_mutual: { protected: 'Party A', providing: 'Party B' },
    sales_agreement: { protected: 'Buyer', providing: 'Seller' },
    purchase_agreement: { protected: 'Buyer', providing: 'Seller' },
    construction_contract: { protected: 'Client', providing: 'Contractor' },
    consultancy_agreement: { protected: 'Client', providing: 'Consultant' },
    agency_agreement: { protected: 'Principal', providing: 'Agent' },
    distribution_agreement: { protected: 'Distributor', providing: 'Supplier' },
    franchise_agreement: { protected: 'Franchisee', providing: 'Franchisor' },
    insurance_policy: { protected: 'Policyholder', providing: 'Insurer' },
    maintenance_agreement: { protected: 'Customer', providing: 'Service Provider' },
}

// ============================================================================
// SECTION 2: HELPER FUNCTIONS
// ============================================================================

function getPositionLabel(position: number, label1: string | null, label5: string | null, label10: string | null): string | null {
    if (!label1 && !label5 && !label10) return null
    if (position <= 2) return label1 || null
    if (position <= 4) return label1 && label5 ? `between ${label1} and ${label5}` : label1 || label5 || null
    if (position === 5) return label5 || null
    if (position <= 7) return label5 && label10 ? `between ${label5} and ${label10}` : label5 || label10 || null
    return label10 || null
}

function getClauseGoverns(clauseName: string): string {
    const governsMap: Record<string, string> = {
        'Payment Terms': 'when and how payments are made',
        'Liability Cap': 'maximum financial exposure for each party',
        'Termination Rights': 'how and when parties can exit the contract',
        'IP Ownership': 'who owns intellectual property created during the contract',
        'Data Protection': 'how personal and sensitive data is handled',
        'Service Levels': 'performance standards and remedies for failure',
        'Indemnification': 'who bears the cost of specific losses or claims',
        'Confidentiality': 'protection of sensitive business information',
        'Force Majeure': 'rights when extraordinary events prevent performance',
        'Dispute Resolution': 'how disagreements are resolved',
        'Change Control': 'how contract modifications are managed',
        'Insurance': 'required coverage and risk transfer',
    }
    for (const [key, value] of Object.entries(governsMap)) {
        if (clauseName && clauseName.toLowerCase().includes(key.toLowerCase())) return value
    }
    return 'contract terms and obligations'
}

// ============================================================================
// SECTION 3: BUILD PROMPTS
// ============================================================================

export function buildSessionPrompts(
    ctx: SessionContext,
    passedRoleContext?: {
        userRoleLabel?: string
        counterpartyRoleLabel?: string
        protectedPartyLabel?: string
        providingPartyLabel?: string
    } | null
): { systemPrompt: string; userPrompt: string } {

    const contractTypeKey = ctx.session.contractTypeKey
    const initiatorPartyRole = ctx.session.initiatorPartyRole

    // Derive role labels
    const roleLabels = passedRoleContext
        ? { protected: passedRoleContext.protectedPartyLabel || 'Customer', providing: passedRoleContext.providingPartyLabel || 'Provider' }
        : (contractTypeKey ? ROLE_LABELS[contractTypeKey] : null) || { protected: 'Customer', providing: 'Provider' }

    let userRoleLabel = ''
    let otherRoleLabel = ''

    if (passedRoleContext?.userRoleLabel) {
        userRoleLabel = passedRoleContext.userRoleLabel
        otherRoleLabel = passedRoleContext.counterpartyRoleLabel || ''
    } else if (contractTypeKey && initiatorPartyRole) {
        if (ctx.viewer.role === 'customer') {
            userRoleLabel = roleLabels[initiatorPartyRole as 'protected' | 'providing'] || roleLabels.protected
            otherRoleLabel = initiatorPartyRole === 'protected' ? roleLabels.providing : roleLabels.protected
        } else {
            const respondentRole = initiatorPartyRole === 'protected' ? 'providing' : 'protected'
            userRoleLabel = roleLabels[respondentRole as 'protected' | 'providing'] || roleLabels.providing
            otherRoleLabel = roleLabels[initiatorPartyRole as 'protected' | 'providing'] || roleLabels.protected
        }
    } else {
        userRoleLabel = ctx.viewer.role === 'customer' ? 'Customer' : 'Provider'
        otherRoleLabel = ctx.viewer.role === 'customer' ? 'Provider' : 'Customer'
    }

    // Viewer context
    const isCustomerViewer = ctx.viewer.role === 'customer'
    const userPartyName = isCustomerViewer ? ctx.parties.customer.companyName : ctx.parties.provider.companyName
    const otherPartyName = isCustomerViewer ? ctx.parties.provider.companyName : ctx.parties.customer.companyName
    const userLeverage = isCustomerViewer ? ctx.leverage.tracker.customer : ctx.leverage.tracker.provider
    const otherLeverage = isCustomerViewer ? ctx.leverage.tracker.provider : ctx.leverage.tracker.customer

    // ------------------------------------------------------------------
    // SYSTEM PROMPT
    // ------------------------------------------------------------------
    const roleContextSection = contractTypeKey
        ? `
This is a ${ctx.session.contractType || contractTypeKey.replace(/_/g, ' ')}.
In this contract type:
- The ${roleLabels.protected} (protected party) benefits from positions closer to 10
- The ${roleLabels.providing} (providing party) benefits from positions closer to 1
- Position 5 represents a balanced, market-standard position

${userPartyName} is the ${userRoleLabel}. ${otherPartyName} is the ${otherRoleLabel}.
Use these role labels naturally in your responses (e.g. "as the ${userRoleLabel}, you..." or "the ${otherRoleLabel} may want...").
`
        : `
No specific contract type has been set. Use the role labels "${userRoleLabel}" and "${otherRoleLabel}" in your responses.
Positions closer to 10 favour the protected party; positions closer to 1 favour the providing party.
`

    const trainingSection = ctx.mode.isTraining
        ? `
## TRAINING MODE ACTIVE
This is a training session. The user is practicing negotiation.
Opponent type: ${ctx.mode.trainingOpponentType || 'balanced'}
${ctx.mode.opponentPersonality || ''}
Provide constructive feedback on their approach.
`
        : ''

    const systemPrompt = `# CLARENCE System Prompt

You are CLARENCE (Contract Legal Alignment & Regulatory Efficiency Negotiation & Collaboration Engine), The Honest Broker — a professional contract mediator trusted by all parties.

## YOUR LEGAL EXPERTISE

You are an expert mediator with deep expertise in:
- Commercial contract law across major jurisdictions (UK, US, EU, Middle East, APAC)
- Business Process Outsourcing (BPO) agreements and IT outsourcing
- Service level agreements and performance management frameworks
- Liability allocation, indemnification, and risk management
- Data protection, GDPR, and cross-border data transfer regulations
- Employment law considerations in outsourcing (TUPE, ARD)
- Intellectual property rights in service delivery contexts
- Dispute resolution and termination frameworks

When users ask general legal questions (not specific to their contract), draw on your full legal expertise to provide authoritative, nuanced guidance. Always note that you are providing legal information, not legal advice, and recommend consulting a qualified lawyer for specific situations.

## CRITICAL: WHO YOU ARE SPEAKING TO

YOU ARE SPEAKING TO: ${userPartyName} (${ctx.viewer.role})
Their contract role: ${userRoleLabel}

The other party is: ${otherPartyName}
Their contract role: ${otherRoleLabel}

- ALWAYS use "you/your" when referring to ${userPartyName}
- ALWAYS use "${otherPartyName}" or "the ${otherRoleLabel}" when referring to the other party
- YOUR leverage is ${userLeverage}% (this is ${userPartyName}'s negotiating power)
- ${otherPartyName}'s leverage is ${otherLeverage}%
- NEVER confuse whose leverage is whose

## CONTRACT ROLE CONTEXT
${roleContextSection}

## CRITICAL RULE: POSITION ACCURACY

- Positions are on a 1-10 scale where 1 = most flexibility for ${roleLabels.providing}, 10 = most protection for ${roleLabels.protected}
- NEVER guess or interpolate what a position number means in practical terms
- ONLY state the practical meaning (e.g., '45 days', '120% of fees') if you have been given the POSITION LABELS
- If position labels are NOT provided, describe positions ONLY by their number and relative direction
  (e.g., "you moved from position 8 to 6, a concession toward the ${otherRoleLabel}")
- NEVER invent specific contract terms like day counts, percentages, or fee multiples from position numbers alone

## IMPORTANT TERMINOLOGY

- Leverage Balance (${ctx.leverage.leverageBalance || 'N/A'}%) = how evenly matched the parties' overall negotiating power is
- Clause Alignment (${ctx.positions.alignmentPercentage}%) = the average agreement percentage across all contract clauses
- When the user asks about "alignment", they mean CLAUSE ALIGNMENT (what's on their screen)
- Never confuse these two metrics

## Your Core Identity

You are an expert mediator who:
- Guides parties through structured negotiation phases
- Maintains neutrality while ensuring fairness
- Focuses on creating mutually beneficial outcomes
- Combines legal expertise with practical business sense
- Makes complex contract negotiations accessible and efficient

## Language Rules — MANDATORY

1. NEVER use adversarial language ("versus", "against", "fighting", "battle")
   DO use "and", "alongside", "between", "working with"
2. NEVER say "aggressive" — use "strong", "firm", "priority"
3. NEVER refer to yourself as "the AI" or "AI-generated"
4. Use the correct role labels: "${userRoleLabel}" for the user, "${otherRoleLabel}" for the other party
5. Be confident — you ARE the expert

## Communication Style

- Be conversational and approachable, not overly formal
- Ask a maximum of TWO questions per response
- Provide clear explanations of legal concepts when needed
- Write naturally without excessive formatting tags

${trainingSection}`

    // ------------------------------------------------------------------
    // FORMAT CLAUSE GAPS
    // ------------------------------------------------------------------
    function formatClauseGap(c: typeof ctx.positions.biggestGaps[0]) {
        const userPos = isCustomerViewer ? c.customer_position : c.provider_position
        const otherPos = isCustomerViewer ? c.provider_position : c.customer_position
        const governs = getClauseGoverns(c.clause_name)

        let labelInfo = ''
        if (c.position_1_label || c.position_5_label || c.position_10_label) {
            labelInfo = `\n  Position scale: ${c.position_1_label || '?'} (1/${roleLabels.providing}-favourable) → ${c.position_5_label || '?'} (5/balanced) → ${c.position_10_label || '?'} (10/${roleLabels.protected}-favourable)`
        }

        return `- ${c.clause_name} (governs ${governs}): gap of ${parseFloat(String(c.gap_size)).toFixed(1)}\n  Your position: ${userPos}/10, ${otherPartyName}'s position: ${otherPos}/10${labelInfo}`
    }

    let biggestGapsText = ''
    if (ctx.positions.biggestGaps.length > 0) {
        biggestGapsText = ctx.positions.biggestGaps.slice(0, 5).map(formatClauseGap).join('\n')
    }

    // Format recent moves
    let recentMovesText = ''
    if (ctx.recentHistory.lastMoves.length > 0) {
        recentMovesText = ctx.recentHistory.lastMoves.slice(0, 3).map(m => {
            const isUserMove = (isCustomerViewer && m.partyRole === 'customer') || (!isCustomerViewer && m.partyRole === 'provider')
            const moverName = isUserMove ? 'You' : otherPartyName
            const moverRole = isUserMove ? userRoleLabel : otherRoleLabel
            return `- ${moverName} (${moverRole}) moved ${m.clauseName} from position ${m.fromPosition} to ${m.toPosition}`
        }).join('\n')
    }

    // Format recent chat
    let recentChatText = ''
    if (ctx.recentHistory.recentChatMessages.length > 0) {
        recentChatText = ctx.recentHistory.recentChatMessages.slice(0, 5).map(msg =>
            `${msg.senderRole === 'clarence' ? 'CLARENCE' : msg.senderRole === ctx.viewer.role ? 'YOU' : otherPartyName.toUpperCase()}: ${msg.messageText.substring(0, 200)}${msg.messageText.length > 200 ? '...' : ''}`
        ).join('\n\n')
    }

    // Playbook
    let playbookText = ''
    if (ctx.playbook.hasPlaybook) {
        playbookText = `\n=== PLAYBOOK GUIDANCE ===\n${ctx.viewer.company} has an active negotiation playbook: "${ctx.playbook.playbookName}"\nTotal rules: ${ctx.playbook.totalRules}\nConsider their company policies when advising.\n`
    }

    // Strategic insights
    let strategicText = ''
    if (ctx.viewer.role === 'customer' && ctx.strategicInsights.customerPriorities) {
        strategicText = `\n=== YOUR PRIORITIES (Confidential to ${userRoleLabel}) ===\n`
        if (ctx.strategicInsights.customerPriorities) strategicText += `Priorities: ${JSON.stringify(ctx.strategicInsights.customerPriorities)}\n`
        if (ctx.strategicInsights.customerRedLines) strategicText += `Red Lines: ${JSON.stringify(ctx.strategicInsights.customerRedLines)}\n`
    } else if (ctx.viewer.role === 'provider' && ctx.strategicInsights.providerPriorities) {
        strategicText = `\n=== YOUR PRIORITIES (Confidential to ${userRoleLabel}) ===\n`
        if (ctx.strategicInsights.providerPriorities) strategicText += `Services: ${ctx.strategicInsights.providerPriorities}\n`
        if (ctx.strategicInsights.providerFlexibility) strategicText += `Flexibility areas: ${JSON.stringify(ctx.strategicInsights.providerFlexibility)}\n`
    }

    // ------------------------------------------------------------------
    // USER PROMPT
    // ------------------------------------------------------------------
    const userPrompt = `=== NEGOTIATION CONTEXT ===

## Session Information
- Session: ${ctx.session.sessionNumber}
- Contract Type: ${ctx.session.contractType}${contractTypeKey ? ` (${contractTypeKey.replace(/_/g, ' ')})` : ''}
- Deal Value: ${ctx.session.currency} ${ctx.session.dealValue.toLocaleString()}
- Industry: ${ctx.session.industry}
- Status: ${ctx.session.status}

## Contract Roles
- You: ${userPartyName} — the ${userRoleLabel}
- Other party: ${otherPartyName} — the ${otherRoleLabel}
- Position scale: 1 = favours ${roleLabels.providing}, 10 = favours ${roleLabels.protected}

## Current Phase
Phase ${ctx.session.currentPhase}: ${ctx.session.phaseName}

## Leverage
- Your Leverage (${userRoleLabel}): ${userLeverage}%
- ${otherPartyName}'s Leverage (${otherRoleLabel}): ${otherLeverage}%
- Leverage Balance: ${ctx.leverage.leverageBalance || 'N/A'}%

### Leverage Factors
- Market Dynamics: ${ctx.leverage.factors.marketDynamics.score}% — ${ctx.leverage.factors.marketDynamics.rationale}
- Economic Factors: ${ctx.leverage.factors.economicFactors.score}% — ${ctx.leverage.factors.economicFactors.rationale}
- Strategic Position: ${ctx.leverage.factors.strategicPosition.score}% — ${ctx.leverage.factors.strategicPosition.rationale}
- BATNA: ${ctx.leverage.factors.batna.score}% — ${ctx.leverage.factors.batna.rationale}

## Negotiation Progress
- Total Clauses: ${ctx.positions.total}
- Agreed: ${ctx.positions.agreed}
- Aligned: ${ctx.positions.aligned}
- Disputed: ${ctx.positions.disputed}
- Clause Alignment: ${ctx.positions.alignmentPercentage}%
- Average Gap Size: ${ctx.positions.averageGapSize}

${biggestGapsText ? `### Biggest Gaps (Priority Items)\nIf position labels are provided for a clause, use the ACTUAL TERMS — never guess.\n${biggestGapsText}\n` : ''}

${recentMovesText ? `### Recent Position Changes\n${recentMovesText}\n` : ''}

${strategicText}

${playbookText}

${recentChatText ? `=== RECENT CONVERSATION ===\n${recentChatText}\n` : ''}

=== CURRENT USER MESSAGE ===
${ctx.touchpoint.userMessage}

=== YOUR TASK ===
Based on the negotiation context above, respond to the user's message while:
1. Speaking directly to them as ${userPartyName} (the ${userRoleLabel}) — always "you/your" for them
2. Referring to the other party as ${otherPartyName} or "the ${otherRoleLabel}"
3. Referencing specific data from the context (leverage, positions, gaps)
4. If position labels are provided for a clause, use the ACTUAL TERMS to describe positions
5. Use "Clause Alignment" (${ctx.positions.alignmentPercentage}%) when discussing how close the parties are to agreement
6. Maintaining continuity with recent conversation
7. Being helpful, strategic, and moving the negotiation forward

Respond naturally and conversationally.`

    return { systemPrompt, userPrompt }
}
