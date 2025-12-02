'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { eventLogger } from '@/lib/eventLogger'

// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

// Session status types
type SessionStatus =
    | 'pending_provider'      // Customer done, waiting for provider invite
    | 'provider_invited'      // Provider has been invited but not completed
    | 'provider_intake'       // Provider completing their questionnaire
    | 'leverage_pending'      // Both done, calculating leverage
    | 'ready'                 // Full negotiation ready
    | 'active'                // Negotiation in progress

interface Session {
    sessionId: string
    sessionNumber: string
    customerCompany: string
    providerCompany: string
    serviceType: string
    dealValue: string
    phase: number
    status: string
}

// ============================================================================
// SECTION 1A: PROVIDER BID INTERFACE (MULTI-PROVIDER SUPPORT)
// ============================================================================

interface ProviderBid {
    bidId: string
    providerId: string | null
    providerCompany: string
    providerContactName: string | null
    providerContactEmail: string
    status: string
    intakeComplete: boolean
    questionnaireComplete: boolean
    invitedAt: string
    submittedAt: string | null
    isCurrentProvider: boolean
}

// API response type for provider bids
interface ApiProviderBidResponse {
    bid_id: string
    provider_id: string | null
    provider_company: string
    provider_contact_name: string | null
    provider_contact_email: string
    status: string
    intake_complete: boolean
    questionnaire_complete: boolean
    invited_at: string
    submitted_at: string | null
}

// ============================================================================
// SECTION 1B: POSITION OPTION INTERFACE (FROM JOHN'S APPENDIX A)
// ============================================================================

interface PositionOption {
    value: number
    label: string
    description: string
}

// ============================================================================
// SECTION 1C: CONTRACT CLAUSE INTERFACE
// ============================================================================

interface ContractClause {
    positionId: string
    clauseId: string
    clauseNumber: string
    clauseName: string
    category: string
    description: string

    // Nesting
    parentPositionId: string | null
    clauseLevel: number
    displayOrder: number

    // Positions
    customerPosition: number | null
    providerPosition: number | null
    currentCompromise: number | null
    clarenceRecommendation: number | null
    industryStandard: number | null
    gapSize: number

    // Original positions (for reset functionality)
    originalCustomerPosition: number | null
    originalProviderPosition: number | null

    // Weighting
    customerWeight: number
    providerWeight: number
    isDealBreakerCustomer: boolean
    isDealBreakerProvider: boolean

    // Content
    clauseContent: string | null
    customerNotes: string | null
    providerNotes: string | null

    // Status
    status: 'aligned' | 'negotiating' | 'disputed' | 'pending'

    // UI State
    isExpanded?: boolean
    children?: ContractClause[]

    // Position options from John's Appendix A
    positionOptions?: PositionOption[] | null
}

// ============================================================================
// SECTION 1D: POSITION ADJUSTMENT TYPES
// ============================================================================

interface PositionAdjustment {
    positionId: string
    clauseId: string
    party: 'customer' | 'provider'
    originalPosition: number
    proposedPosition: number
    committedPosition: number | null
    clauseWeight: number
    leverageImpact: number
    timestamp: string | null
}

interface LeverageData {
    leverageScoreCustomer: number
    leverageScoreProvider: number
    leverageScoreCalculatedAt: string
    leverageTrackerCustomer: number
    leverageTrackerProvider: number
    alignmentPercentage: number
    isAligned: boolean
    leverageTrackerCalculatedAt: string
    marketDynamicsScore: number
    marketDynamicsRationale: string
    economicFactorsScore: number
    economicFactorsRationale: string
    strategicPositionScore: number
    strategicPositionRationale: string
    batnaScore: number
    batnaRationale: string
}

interface ClauseChatMessage {
    messageId: string
    sessionId: string
    positionId: string | null
    sender: 'customer' | 'provider' | 'clarence'
    senderUserId: string | null
    message: string
    messageType: 'discussion' | 'proposal' | 'notification' | 'question' | 'auto_response' | 'position_change'
    relatedPositionChange: boolean
    triggeredBy: string | null
    createdAt: string
}

interface UserInfo {
    firstName?: string
    lastName?: string
    email?: string
    company?: string
    role?: 'customer' | 'provider'
    userId?: string
}

interface PartyStatus {
    isOnline: boolean
    lastSeen: string | null
    userName: string | null
}

// API Response Types
interface ApiClauseResponse {
    positionId: string
    clauseId: string
    clauseNumber: string
    clauseName: string
    category: string
    description: string
    parentPositionId: string | null
    clauseLevel: number
    displayOrder: number
    customerPosition: string | null
    providerPosition: string | null
    currentCompromise: string | null
    aiSuggestedCompromise: string | null
    gapSize: string
    gapSeverity: string
    customerWeight: number
    providerWeight: number
    isDealBreakerCustomer: boolean
    isDealBreakerProvider: boolean
    clauseContent: string | null
    customerNotes: string | null
    providerNotes: string | null
    priorityLevel: number
    status: string
    isExpanded: boolean
    positionOptions?: PositionOption[] | null
}

interface ApiMessageResponse {
    messageId?: string
    message_id?: string
    sessionId?: string
    session_id?: string
    positionId?: string | null
    position_id?: string | null
    sender: string
    senderUserId?: string | null
    sender_user_id?: string | null
    message: string
    messageType?: string
    message_type?: string
    relatedPositionChange?: boolean
    related_position_change?: boolean
    triggeredBy?: string | null
    triggered_by?: string | null
    createdAt?: string
    created_at?: string
}

// ============================================================================
// SECTION 1E: TRADE-OFF TYPES
// ============================================================================

interface TradeOffOpportunity {
    id: string
    clauseA: ContractClause
    clauseB: ContractClause
    tradeOffValue: number
    description: string
    customerGives: string
    customerGets: string
    providerGives: string
    providerGets: string
    alignmentImpact: number
}

// ============================================================================
// SECTION 1F: CLARENCE AI TYPES
// ============================================================================

interface ClarenceAIResponse {
    success: boolean
    promptType: string
    sessionId: string
    clauseId?: string
    response: string
    leverage: {
        customer: number
        provider: number
        alignment: number
    }
    timestamp: string
}

// ============================================================================
// SECTION 2: API CONFIGURATION & FUNCTIONS
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

// ============================================================================
// SECTION 2A: POSITION OPTIONS LOOKUP (JOHN'S APPENDIX A)
// ============================================================================

const CLAUSE_POSITION_OPTIONS: Record<string, PositionOption[]> = {
    'implied_services': [
        { value: 1, label: 'Listed services only', description: 'Only those services explicitly listed in the contract' },
        { value: 2, label: 'Plus reasonable adjuncts', description: 'Listed services plus those seen as a reasonable adjunct to the services' },
        { value: 3, label: 'Plus inherent services', description: 'Plus those inherent in and ordinarily part of the services' },
        { value: 4, label: 'Maximum scope', description: 'Plus those previously done by transferring personnel and within scope of transferring contracts' }
    ],
    'due_diligence': [
        { value: 1, label: 'No DD clause', description: 'No due diligence clause included' },
        { value: 2, label: 'DD with material inaccuracy claims', description: 'DD clause included but right to claim for material inaccuracies' },
        { value: 3, label: 'DD with reasonable efforts', description: 'Claims limited to those provider could not have uncovered exercising commercially reasonable efforts' },
        { value: 4, label: 'Full DD conducted', description: 'All due diligence conducted, provider accepts full responsibility' }
    ],
    'payment_terms': [
        { value: 1, label: '30 days', description: '30 days from date of receipt by customer' },
        { value: 2, label: '60 days', description: '60 days from date of receipt by customer' },
        { value: 3, label: '90 days', description: '90 days from date of receipt by customer' },
        { value: 4, label: '120 days', description: '120 days from date of receipt by customer' }
    ],
    'late_payment': [
        { value: 1, label: '10% per annum', description: '10% per annum calculated on a monthly basis' },
        { value: 2, label: 'Lower of 10% or legal rate', description: 'The lower of 10% or the legal rate of interest' },
        { value: 3, label: 'Base + 4%', description: '4% above the base lending rate' },
        { value: 4, label: 'Base + 2%', description: '2% above the base lending rate' },
        { value: 5, label: 'No interest', description: 'No late payment interest' }
    ],
    'cola': [
        { value: 1, label: 'Full COLA', description: 'Based on cost of living index in delivery location' },
        { value: 2, label: 'COLA capped at 4%', description: 'Same but capped at 4%' },
        { value: 3, label: 'COLA capped at 2%', description: 'Same but capped at 2%' },
        { value: 4, label: 'Fixed pricing', description: 'No COLA - prices fixed for term' }
    ],
    'vat': [
        { value: 1, label: 'VAT inclusive', description: 'Prices include VAT/sales tax' },
        { value: 2, label: 'VAT exclusive', description: 'Prices exclude VAT/sales tax (standard)' }
    ],
    'liability_cap': [
        { value: 1, label: '100% aggregate (whole term)', description: 'Aggregate cap for whole term = 100% of annual fees' },
        { value: 2, label: '150% aggregate', description: 'Aggregate cap = 150% of annual fees' },
        { value: 3, label: '150% or agreed amount', description: 'Greater of agreed amount and 150% of annual fees' },
        { value: 4, label: '150% annual cap', description: 'Annual cap = 150% of annual fees' },
        { value: 5, label: '150% annual or agreed', description: 'Annual cap = greater of agreed amount and 150% of annual fees' },
        { value: 6, label: '200% annual cap', description: 'Annual cap per year = 200% of annual fees' }
    ],
    'excluded_losses': [
        { value: 1, label: 'Broadest exclusion', description: 'Exclude indirect/consequential AND lost profits, anticipated savings, wasted expenditure' },
        { value: 2, label: 'Standard exclusion', description: 'Exclude indirect/consequential AND lost profits, anticipated savings (not wasted expenditure)' },
        { value: 3, label: 'Including lost profits', description: 'Exclude indirect/consequential including lost profits, anticipated savings' },
        { value: 4, label: 'Excluding lost profits', description: 'Exclude indirect/consequential but NOT lost profits, anticipated savings' },
        { value: 5, label: 'Foreseeable damages', description: 'Exclude indirect/consequential but include reasonably foreseeable damages' },
        { value: 6, label: 'No exclusion', description: 'No exclusion for indirect or consequential losses' }
    ],
    'unlimited_losses': [
        { value: 1, label: 'Statutory only', description: 'Death/personal injury (negligence), fraud, implied terms under Sale of Goods/Supply of Services Acts' },
        { value: 2, label: 'Plus gross misconduct', description: 'Statutory plus gross misconduct' },
        { value: 3, label: 'Plus gross negligence', description: 'Statutory plus gross misconduct and gross negligence' },
        { value: 4, label: 'Plus wilful default', description: 'Statutory plus gross misconduct, gross negligence, and wilful default' }
    ],
    'service_credits': [
        { value: 1, label: '5% at-risk', description: '5% monthly at-risk' },
        { value: 2, label: '8% at-risk', description: '8% monthly at-risk' },
        { value: 3, label: '12% at-risk', description: '12% monthly at-risk' },
        { value: 4, label: '15% at-risk', description: '15% monthly at-risk' },
        { value: 5, label: '20% at-risk', description: '20% monthly at-risk' }
    ],
    'persistent_breach': [
        { value: 1, label: 'No termination right', description: 'Subject-matter covered by credit regime only' },
        { value: 2, label: '4 breaches / 6 months', description: '4 breaches of same service level in 6-month period' },
        { value: 3, label: '3 breaches / 6 months', description: '3 breaches of same service level in 6-month period' },
        { value: 4, label: '2 breaches / 6 months', description: '2 breaches of same service level in 6-month period' }
    ],
    'step_in': [
        { value: 1, label: 'No step-in right', description: 'No step-in right (extreme and very hard to exercise in practice)' },
        { value: 2, label: '2 months / 100% fees', description: 'Limited to max 2 months and 100% of monthly fees per month' },
        { value: 3, label: '3 months / 125% fees', description: 'Limited to max 3 months and 125% of monthly fees per month' },
        { value: 4, label: '4 months / 150% fees', description: 'Limited to max 4 months and 150% of monthly fees per month' },
        { value: 5, label: '6 months / 200% fees', description: 'Limited to max 6 months and 200% of monthly fees per month' },
        { value: 6, label: 'Unlimited', description: 'No time or financial limit on step-in' }
    ],
    'initial_term': [
        { value: 1, label: '5 years', description: '5 year initial term' },
        { value: 2, label: '3 years', description: '3 year initial term' },
        { value: 3, label: '2 years', description: '2 year initial term' },
        { value: 4, label: '1 year', description: '1 year initial term' }
    ],
    'renewal_term': [
        { value: 1, label: 'No renewal option', description: 'No renewal option - requires mutual agreement to renew' },
        { value: 2, label: 'Up to 12 months', description: 'Customer right to extend up to 12 months on existing terms' },
        { value: 3, label: 'Up to 2 years', description: 'Customer right to extend up to 2 years on existing terms' },
        { value: 4, label: 'Up to 3 years', description: 'Customer right to extend up to 3 years on existing terms' }
    ],
    'termination_convenience': [
        { value: 1, label: 'Mutual - 180 days', description: 'Mutual right with 180 days notice' },
        { value: 2, label: 'Customer only - 180 days', description: 'Customer only with 180 days notice' },
        { value: 3, label: 'Customer only - 120 days', description: 'Customer only with 120 days notice' },
        { value: 4, label: 'Customer only - 90 days', description: 'Customer only with 90 days notice' },
        { value: 5, label: 'Customer only - 60 days', description: 'Customer only with 60 days notice' },
        { value: 6, label: 'Customer only - 30 days', description: 'Customer only with 30 days notice' }
    ],
    'termination_fee': [
        { value: 1, label: 'Unrecovered + 3 months', description: 'Unrecovered costs plus 3 months charges (based on prior 6-month average)' },
        { value: 2, label: 'Sliding scale', description: 'Unrecovered costs plus sliding scale: 3 months (Y1), 2 months (Y2), 1 month (Y3), nil thereafter' },
        { value: 3, label: 'Unrecovered costs only', description: 'Unrecovered costs but no winddown charge' },
        { value: 4, label: 'No termination fee', description: 'No termination fee' }
    ],
    'key_personnel': [
        { value: 1, label: 'Request only', description: 'Customer can request removal but no right to require or agree replacement' },
        { value: 2, label: 'Request with consent', description: 'Customer can request, vendor cannot unreasonably withhold, reasonable input on replacement' },
        { value: 3, label: 'Full control', description: 'Customer has right to require removal and agree replacement' }
    ],
    'employee_costs': [
        { value: 1, label: 'Vendor indemnified both', description: 'Vendor indemnified on entry and exit' },
        { value: 2, label: 'Split indemnity', description: 'Customer indemnified on entry, Vendor indemnified on exit' },
        { value: 3, label: 'Customer indemnified both', description: 'Customer indemnified on entry and exit' },
        { value: 4, label: 'Customer exit only', description: 'No indemnity on entry, Customer indemnified on exit' },
        { value: 5, label: 'No indemnities', description: 'No indemnity on entry or exit' }
    ],
    'set_off': [
        { value: 1, label: 'No set-off', description: 'No right of set-off' },
        { value: 2, label: 'With approval', description: 'Set-off of undisputed amounts with notice and vendor approval' },
        { value: 3, label: 'With notice', description: 'Set-off of undisputed amounts with notice' },
        { value: 4, label: 'Undisputed amounts', description: 'Set-off of undisputed amounts' },
        { value: 5, label: 'Any amounts', description: 'Set-off of any amounts owing' }
    ],
    'assignment': [
        { value: 1, label: 'Both - unrestricted', description: 'Both parties can assign without consent' },
        { value: 2, label: 'Both - affiliates only', description: 'Both can assign to affiliates without consent; third parties require consent' },
        { value: 3, label: 'Both - financial standing', description: 'Both can assign to affiliates of equal financial standing; consent for third parties' },
        { value: 4, label: 'Customer - financial standing', description: 'Only customer can assign to affiliates of equal financial standing; consent for third parties' },
        { value: 5, label: 'Customer - affiliates', description: 'Only customer can assign to affiliates without consent; provider consent for third parties' },
        { value: 6, label: 'Customer - unrestricted', description: 'Only customer can assign to any third party' }
    ],
    'governing_law': [
        { value: 1, label: 'Customer jurisdiction', description: 'England and Wales (customer location)' },
        { value: 2, label: 'Vendor jurisdiction', description: 'Country/US state where vendor is located' },
        { value: 3, label: 'Neutral jurisdiction', description: 'Third country, e.g., Switzerland' },
        { value: 4, label: 'Arbitration', description: 'English law but international arbitration (e.g., SIAC)' }
    ]
}

function getPositionOptionsForClause(clauseId: string, clauseName: string): PositionOption[] | null {
    // Try direct lookup by clauseId
    const idKey = clauseId.toLowerCase().replace(/[-\s]/g, '_')
    if (CLAUSE_POSITION_OPTIONS[idKey]) {
        return CLAUSE_POSITION_OPTIONS[idKey]
    }

    // Try by clause name
    const nameKey = clauseName.toLowerCase().replace(/[\s-]+/g, '_')
    if (CLAUSE_POSITION_OPTIONS[nameKey]) {
        return CLAUSE_POSITION_OPTIONS[nameKey]
    }

    // Fuzzy match
    const searchTerms = [
        'payment', 'late', 'cola', 'vat', 'liability', 'excluded', 'unlimited',
        'service_credits', 'persistent', 'step_in', 'initial_term', 'renewal',
        'termination', 'key_personnel', 'employee', 'set_off', 'assignment', 'governing'
    ]

    for (const term of searchTerms) {
        if (nameKey.includes(term) && CLAUSE_POSITION_OPTIONS[term]) {
            return CLAUSE_POSITION_OPTIONS[term]
        }
    }

    return null
}

// ============================================================================
// SECTION 2B: CLARENCE AI API FUNCTIONS
// ============================================================================

const CLARENCE_AI_URL = `${API_BASE}/clarence-ai`

async function callClarenceAI(
    sessionId: string,
    promptType: 'welcome' | 'clause_explain' | 'chat' | 'position_change',
    options: {
        clauseId?: string
        message?: string
        positionChange?: {
            clauseName: string
            party: string
            oldPosition: number
            newPosition: number
            clauseWeight: number
            leverageImpact: number
            currentLeverageCustomer: number
            currentLeverageProvider: number
        }
    } = {}
): Promise<ClarenceAIResponse | null> {
    try {
        const response = await fetch(CLARENCE_AI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                promptType,
                ...options
            })
        })

        if (!response.ok) {
            throw new Error(`CLARENCE AI request failed: ${response.status}`)
        }

        return await response.json()
    } catch (error) {
        console.error('CLARENCE AI Error:', error)
        return null
    }
}

// ============================================================================
// SECTION 2C: POSITION UPDATE API FUNCTION
// ============================================================================

async function commitPositionChange(
    sessionId: string,
    positionId: string,
    party: 'customer' | 'provider',
    newPosition: number,
    leverageImpact: number
): Promise<{ success: boolean; newLeverage?: LeverageData }> {
    try {
        const response = await fetch(`${API_BASE}/position-update-api`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                positionId,
                party,
                newPosition,
                leverageImpact
            })
        })

        if (!response.ok) {
            throw new Error('Failed to commit position change')
        }

        return await response.json()
    } catch (error) {
        console.error('Error committing position:', error)
        return { success: false }
    }
}

// ============================================================================
// SECTION 2D: DATA FETCH FUNCTIONS
// ============================================================================

function formatCurrency(value: string | number | null, currency: string): string {
    if (!value) return '£0'
    const num = typeof value === 'string' ? parseFloat(value) : value
    const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€'
    if (num >= 1000000) {
        return `${symbol}${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
        return `${symbol}${(num / 1000).toFixed(0)}K`
    }
    return `${symbol}${num.toLocaleString()}`
}

function parsePhaseFromState(state: string | null): number {
    if (!state) return 2
    const phaseMap: Record<string, number> = {
        'deal_profiling': 1,
        'initial_positions': 2,
        'mediation_pending': 2,
        'gap_analysis': 3,
        'negotiation': 4,
        'agreement': 5,
        'execution': 6,
        'completed': 6
    }
    return phaseMap[state] || 2
}

async function fetchClauseChat(sessionId: string, positionId: string | null): Promise<ClauseChatMessage[]> {
    try {
        const url = positionId
            ? `${API_BASE}/clause-chat-api-get?session_id=${sessionId}&position_id=${positionId}`
            : `${API_BASE}/clause-chat-api-get?session_id=${sessionId}&general=true`
        const response = await fetch(url)
        if (!response.ok) throw new Error('Failed to fetch clause chat')
        const data = await response.json()

        const messages = Array.isArray(data) ? data : (data.messages || [])

        return messages.map((m: ApiMessageResponse) => ({
            messageId: m.messageId || m.message_id,
            sessionId: m.sessionId || m.session_id,
            positionId: m.positionId || m.position_id,
            sender: m.sender,
            senderUserId: m.senderUserId || m.sender_user_id,
            message: m.message,
            messageType: m.messageType || m.message_type || 'discussion',
            relatedPositionChange: m.relatedPositionChange || m.related_position_change || false,
            triggeredBy: m.triggeredBy || m.triggered_by,
            createdAt: m.createdAt || m.created_at
        }))
    } catch (error) {
        console.error('Error fetching clause chat:', error)
        return []
    }
}

async function checkPartyStatus(sessionId: string, partyRole: 'customer' | 'provider'): Promise<PartyStatus> {
    try {
        return {
            isOnline: Math.random() > 0.3,
            lastSeen: new Date(Date.now() - 300000).toISOString(),
            userName: partyRole === 'customer' ? 'Sarah Mitchell' : 'James Chen'
        }
    } catch (error) {
        console.error('Error checking party status:', error)
        return { isOnline: false, lastSeen: null, userName: null }
    }
}

// ============================================================================
// SECTION 3: LEVERAGE CALCULATION FUNCTIONS
// ============================================================================

function calculateLeverageImpact(
    oldPosition: number,
    newPosition: number,
    clauseWeight: number,
    party: 'customer' | 'provider'
): number {
    const positionDelta = newPosition - oldPosition
    const weightMultiplier = clauseWeight / 5

    let leverageImpact: number

    if (party === 'customer') {
        leverageImpact = positionDelta < 0 ? positionDelta * weightMultiplier * 0.5 : 0
    } else {
        leverageImpact = positionDelta > 0 ? positionDelta * weightMultiplier * 0.5 : 0
    }

    return Math.round(leverageImpact * 10) / 10
}

function recalculateLeverageTracker(
    baseLeverageCustomer: number,
    baseLeverageProvider: number,
    clauses: ContractClause[],
    userRole: 'customer' | 'provider'
): { customerLeverage: number; providerLeverage: number } {
    let totalAdjustment = 0

    clauses.forEach(clause => {
        const originalPos = userRole === 'customer'
            ? clause.originalCustomerPosition
            : clause.originalProviderPosition
        const currentPos = userRole === 'customer'
            ? clause.customerPosition
            : clause.providerPosition

        if (originalPos !== null && currentPos !== null && originalPos !== currentPos) {
            const weight = userRole === 'customer' ? clause.customerWeight : clause.providerWeight
            const impact = calculateLeverageImpact(originalPos, currentPos, weight, userRole)
            totalAdjustment += impact
        }
    })

    const newCustomerLeverage = Math.max(20, Math.min(80, baseLeverageCustomer + totalAdjustment))
    const newProviderLeverage = 100 - newCustomerLeverage

    return {
        customerLeverage: Math.round(newCustomerLeverage),
        providerLeverage: Math.round(newProviderLeverage)
    }
}

function calculateGapSize(customerPosition: number | null, providerPosition: number | null): number {
    if (customerPosition === null || providerPosition === null) return 0
    return Math.abs(customerPosition - providerPosition)
}

function determineClauseStatus(gapSize: number): 'aligned' | 'negotiating' | 'disputed' | 'pending' {
    if (gapSize <= 1) return 'aligned'
    if (gapSize <= 3) return 'negotiating'
    if (gapSize > 4) return 'disputed'
    return 'pending'
}

// ============================================================================
// SECTION 4: HELPER FUNCTIONS
// ============================================================================

function buildClauseTree(clauses: ContractClause[]): ContractClause[] {
    const clauseMap = new Map<string, ContractClause>()
    const rootClauses: ContractClause[] = []

    clauses.forEach(clause => {
        clauseMap.set(clause.positionId, { ...clause, children: [] })
    })

    clauses.forEach(clause => {
        const current = clauseMap.get(clause.positionId)!
        if (clause.parentPositionId && clauseMap.has(clause.parentPositionId)) {
            const parent = clauseMap.get(clause.parentPositionId)!
            parent.children = parent.children || []
            parent.children.push(current)
        } else {
            rootClauses.push(current)
        }
    })

    return rootClauses
}

function getStatusColor(status: string): string {
    switch (status) {
        case 'aligned': return 'text-emerald-600'
        case 'negotiating': return 'text-amber-600'
        case 'disputed': return 'text-red-600'
        default: return 'text-slate-400'
    }
}

function getStatusBgColor(status: string): string {
    switch (status) {
        case 'aligned': return 'bg-emerald-500'
        case 'negotiating': return 'bg-amber-500'
        case 'disputed': return 'bg-red-500'
        default: return 'bg-slate-300'
    }
}

function calculateClauseStats(clauses: ContractClause[]): {
    aligned: number
    negotiating: number
    disputed: number
    pending: number
} {
    const stats = { aligned: 0, negotiating: 0, disputed: 0, pending: 0 }

    function countStatus(clause: ContractClause) {
        if (clause.status === 'aligned') stats.aligned++
        else if (clause.status === 'negotiating') stats.negotiating++
        else if (clause.status === 'disputed') stats.disputed++
        else stats.pending++

        clause.children?.forEach(countStatus)
    }

    clauses.forEach(countStatus)
    return stats
}

function detectTradeOffOpportunities(clauses: ContractClause[], selectedClause?: ContractClause | null): TradeOffOpportunity[] {
    const opportunities: TradeOffOpportunity[] = []
    const clausesWithGaps = clauses.filter(c => c.gapSize > 0 && c.customerPosition !== null && c.providerPosition !== null)
    const baseClause = selectedClause || null

    for (let i = 0; i < clausesWithGaps.length; i++) {
        const clauseA = clausesWithGaps[i]
        if (baseClause && clauseA.clauseId !== baseClause.clauseId) continue

        for (let j = 0; j < clausesWithGaps.length; j++) {
            if (i === j) continue
            const clauseB = clausesWithGaps[j]

            const customerFavorsA = clauseA.customerWeight > clauseA.providerWeight
            const providerFavorsB = clauseB.providerWeight > clauseB.customerWeight

            if (customerFavorsA && providerFavorsB) {
                const priorityDiffA = clauseA.customerWeight - clauseA.providerWeight
                const priorityDiffB = clauseB.providerWeight - clauseB.customerWeight
                const tradeOffValue = (priorityDiffA * clauseA.gapSize) + (priorityDiffB * clauseB.gapSize)
                const alignmentImpact = Math.round((clauseA.gapSize + clauseB.gapSize) / 4)

                opportunities.push({
                    id: `trade-${clauseA.clauseId}-${clauseB.clauseId}`,
                    clauseA,
                    clauseB,
                    tradeOffValue,
                    description: `Trade ${clauseA.clauseName} concession for ${clauseB.clauseName} improvement`,
                    customerGives: `Move toward provider position on ${clauseA.clauseName}`,
                    customerGets: `Better terms on ${clauseB.clauseName}`,
                    providerGives: `Move toward customer position on ${clauseB.clauseName}`,
                    providerGets: `Better terms on ${clauseA.clauseName}`,
                    alignmentImpact
                })
            }
        }
    }

    return opportunities.sort((a, b) => b.tradeOffValue - a.tradeOffValue).slice(0, 5)
}

// ============================================================================
// SECTION 5: LOADING COMPONENT
// ============================================================================

function ContractStudioLoading() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Loading Contract Studio...</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 6: MAIN CONTRACT STUDIO COMPONENT
// ============================================================================

function ContractStudioContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // State
    const [loading, setLoading] = useState(true)
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [otherPartyStatus, setOtherPartyStatus] = useState<PartyStatus>({ isOnline: false, lastSeen: null, userName: null })
    const [session, setSession] = useState<Session | null>(null)
    const [clauses, setClauses] = useState<ContractClause[]>([])
    const [clauseTree, setClauseTree] = useState<ContractClause[]>([])
    const [leverage, setLeverage] = useState<LeverageData | null>(null)
    const [selectedClause, setSelectedClause] = useState<ContractClause | null>(null)
    const [chatMessages, setChatMessages] = useState<ClauseChatMessage[]>([])
    const [chatInput, setChatInput] = useState('')
    const [isChatLoading, setIsChatLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'dynamics' | 'tradeoffs' | 'history' | 'draft'>('dynamics')
    const [showLeverageDetails, setShowLeverageDetails] = useState(false)

    // Position adjustment state
    const [proposedPosition, setProposedPosition] = useState<number | null>(null)
    const [isAdjusting, setIsAdjusting] = useState(false)
    const [pendingLeverageImpact, setPendingLeverageImpact] = useState<number>(0)
    const [isCommitting, setIsCommitting] = useState(false)
    const [showResetConfirm, setShowResetConfirm] = useState(false)

    // CLARENCE AI state
    const [clarenceWelcomeLoaded, setClarenceWelcomeLoaded] = useState(false)
    const [lastExplainedClauseId, setLastExplainedClauseId] = useState<string | null>(null)

    // Trade-off state
    const [tradeOffOpportunities, setTradeOffOpportunities] = useState<TradeOffOpportunity[]>([])

    // Session status state
    const [sessionStatus, setSessionStatus] = useState<SessionStatus>('pending_provider')
    const [providerEmail, setProviderEmail] = useState('')
    const [inviteSending, setInviteSending] = useState(false)
    const [inviteSent, setInviteSent] = useState(false)

    const latestMessageRef = useRef<HTMLDivElement>(null)

    // ============================================================================
    // SECTION 7: DATA LOADING
    // ============================================================================

    const loadUserInfo = useCallback(() => {
        const authData = localStorage.getItem('clarence_auth')
        if (!authData) {
            router.push('/auth/login')
            return null
        }

        try {
            const parsed = JSON.parse(authData)
            return {
                firstName: parsed.userInfo?.firstName || 'User',
                lastName: parsed.userInfo?.lastName || '',
                email: parsed.userInfo?.email || '',
                company: parsed.userInfo?.company || '',
                role: parsed.userInfo?.role || 'customer',
                userId: parsed.userInfo?.userId || ''
            } as UserInfo
        } catch {
            router.push('/auth/login')
            return null
        }
    }, [router])

    const loadContractData = useCallback(async (sessionId: string) => {
        try {
            const response = await fetch(`${API_BASE}/contract-studio-api?session_id=${sessionId}`)
            if (!response.ok) throw new Error('Failed to fetch')

            const data = await response.json()
            const status = data.session?.status || 'pending_provider'

            if (status === 'customer_assessment_complete' || status === 'pending_provider') {
                setSessionStatus('pending_provider')
                return null
            } else if (status === 'provider_invited' || status === 'providers_invited') {
                setSessionStatus('provider_invited')
                const basicSession: Session = {
                    sessionId: data.session.sessionId || sessionId,
                    sessionNumber: data.session.sessionNumber || '',
                    customerCompany: data.session.customerCompany || '',
                    providerCompany: 'Awaiting Provider Response',
                    serviceType: data.session.contractType || 'Service Agreement',
                    dealValue: formatCurrency(data.session.dealValue, data.session.currency || 'GBP'),
                    phase: 1,
                    status: status
                }
                setSession(basicSession)
                return null
            } else if (status === 'provider_intake_complete' || status === 'leverage_pending') {
                setSessionStatus('leverage_pending')
                return null
            }

            setSessionStatus('ready')

            const sessionData: Session = {
                sessionId: data.session.sessionId,
                sessionNumber: data.session.sessionNumber,
                customerCompany: data.session.customerCompany,
                providerCompany: data.session.providerCompany || 'Provider (Pending)',
                serviceType: data.session.contractType || 'IT Services',
                dealValue: formatCurrency(data.session.dealValue, data.session.currency || 'GBP'),
                phase: parsePhaseFromState(data.session.phase),
                status: data.session.status
            }

            const clauseData: ContractClause[] = (data.clauses || []).map((c: ApiClauseResponse) => {
                const customerPos = c.customerPosition ? parseFloat(c.customerPosition) : null
                const providerPos = c.providerPosition ? parseFloat(c.providerPosition) : null

                return {
                    positionId: c.positionId,
                    clauseId: c.clauseId,
                    clauseNumber: c.clauseNumber,
                    clauseName: c.clauseName,
                    category: c.category,
                    description: c.description,
                    parentPositionId: c.parentPositionId,
                    clauseLevel: c.clauseLevel,
                    displayOrder: c.displayOrder,
                    customerPosition: customerPos,
                    providerPosition: providerPos,
                    originalCustomerPosition: customerPos,
                    originalProviderPosition: providerPos,
                    currentCompromise: c.currentCompromise ? parseFloat(c.currentCompromise) : null,
                    clarenceRecommendation: c.aiSuggestedCompromise ? parseFloat(c.aiSuggestedCompromise) : null,
                    industryStandard: null,
                    gapSize: c.gapSize ? parseFloat(c.gapSize) : 0,
                    customerWeight: c.customerWeight,
                    providerWeight: c.providerWeight,
                    isDealBreakerCustomer: c.isDealBreakerCustomer,
                    isDealBreakerProvider: c.isDealBreakerProvider,
                    clauseContent: c.clauseContent,
                    customerNotes: c.customerNotes,
                    providerNotes: c.providerNotes,
                    status: c.status as 'aligned' | 'negotiating' | 'disputed' | 'pending',
                    isExpanded: c.isExpanded,
                    positionOptions: c.positionOptions || getPositionOptionsForClause(c.clauseId, c.clauseName)
                }
            })

            const leverageData: LeverageData = data.leverage || {
                leverageScoreCustomer: 50,
                leverageScoreProvider: 50,
                leverageScoreCalculatedAt: '',
                leverageTrackerCustomer: 50,
                leverageTrackerProvider: 50,
                alignmentPercentage: 0,
                isAligned: false,
                leverageTrackerCalculatedAt: '',
                marketDynamicsScore: 0,
                marketDynamicsRationale: '',
                economicFactorsScore: 0,
                economicFactorsRationale: '',
                strategicPositionScore: 0,
                strategicPositionRationale: '',
                batnaScore: 0,
                batnaRationale: ''
            }

            return { session: sessionData, clauses: clauseData, leverage: leverageData }
        } catch (error) {
            console.error('Error fetching contract studio data:', error)
            setSessionStatus('pending_provider')
            return null
        }
    }, [])

    const loadClauseChat = useCallback(async (sessionId: string, positionId: string | null) => {
        return await fetchClauseChat(sessionId, positionId)
    }, [])

    const loadClarenceWelcome = useCallback(async (sessionId: string) => {
        if (clarenceWelcomeLoaded) return

        setIsChatLoading(true)

        try {
            const response = await callClarenceAI(sessionId, 'welcome')

            if (response?.success && response.response) {
                const welcomeMessage: ClauseChatMessage = {
                    messageId: `clarence-welcome-${Date.now()}`,
                    sessionId: sessionId,
                    positionId: null,
                    sender: 'clarence',
                    senderUserId: null,
                    message: response.response,
                    messageType: 'auto_response',
                    relatedPositionChange: false,
                    triggeredBy: 'session_load',
                    createdAt: new Date().toISOString()
                }

                setChatMessages(prev => [welcomeMessage, ...prev])
                setClarenceWelcomeLoaded(true)
            }
        } catch (error) {
            console.error('Failed to load CLARENCE welcome:', error)
        } finally {
            setIsChatLoading(false)
        }
    }, [clarenceWelcomeLoaded])

    const explainClauseWithClarence = useCallback(async (sessionId: string, clause: ContractClause) => {
        if (lastExplainedClauseId === clause.clauseId) return

        setIsChatLoading(true)
        setLastExplainedClauseId(clause.clauseId)

        try {
            const response = await callClarenceAI(sessionId, 'clause_explain', {
                clauseId: clause.clauseId
            })

            if (response?.success && response.response) {
                const explainMessage: ClauseChatMessage = {
                    messageId: `clarence-explain-${Date.now()}`,
                    sessionId: sessionId,
                    positionId: clause.positionId,
                    sender: 'clarence',
                    senderUserId: null,
                    message: response.response,
                    messageType: 'auto_response',
                    relatedPositionChange: false,
                    triggeredBy: 'clause_selection',
                    createdAt: new Date().toISOString()
                }

                setChatMessages(prev => [...prev, explainMessage])
            }
        } catch (error) {
            console.error('Failed to explain clause:', error)
        } finally {
            setIsChatLoading(false)
        }
    }, [lastExplainedClauseId])

    // Initial load
    useEffect(() => {
        const init = async () => {
            const user = loadUserInfo()
            if (!user) return

            setUserInfo(user)

            const sessionId = searchParams.get('session_id') || searchParams.get('session')
            const urlStatus = searchParams.get('status')
            const sessionNumber = searchParams.get('session_number')

            if (!sessionId) {
                router.push('/auth/contracts-dashboard')
                return
            }

            if (urlStatus === 'pending_provider') {
                setSessionStatus('pending_provider')

                try {
                    const response = await fetch(`${API_BASE}/customer-requirements-api?session_id=${sessionId}`)
                    if (response.ok) {
                        const data = await response.json()

                        setSession({
                            sessionId: sessionId,
                            sessionNumber: data.sessionNumber || sessionNumber || '',
                            customerCompany: data.companyName || data.company_name || user.company || '',
                            providerCompany: 'Awaiting Provider',
                            serviceType: data.serviceRequired || data.service_required || 'Service Agreement',
                            dealValue: formatCurrency(data.dealValue || data.deal_value || '0', 'GBP'),
                            phase: 1,
                            status: 'pending_provider'
                        })
                    } else {
                        setSession({
                            sessionId: sessionId,
                            sessionNumber: sessionNumber || '',
                            customerCompany: user.company || 'Your Company',
                            providerCompany: 'Awaiting Provider',
                            serviceType: 'Service Agreement',
                            dealValue: '£0',
                            phase: 1,
                            status: 'pending_provider'
                        })
                    }
                } catch (e) {
                    console.error('Error loading customer requirements:', e)
                    setSession({
                        sessionId: sessionId,
                        sessionNumber: sessionNumber || '',
                        customerCompany: user.company || 'Your Company',
                        providerCompany: 'Awaiting Provider',
                        serviceType: 'Service Agreement',
                        dealValue: '£0',
                        phase: 1,
                        status: 'pending_provider'
                    })
                }

                eventLogger.setSession(sessionId)
                eventLogger.setUser(user.userId || '')
                eventLogger.completed('contract_negotiation', 'contract_studio_loaded', {
                    sessionId: sessionId,
                    sessionNumber: sessionNumber || '',
                    userRole: user.role,
                    status: 'pending_provider'
                })

                setLoading(false)
                return
            }

            const data = await loadContractData(sessionId)

            if (data) {
                setSession(data.session)
                setClauses(data.clauses)
                setClauseTree(buildClauseTree(data.clauses))
                setLeverage(data.leverage)

                const messages = await loadClauseChat(sessionId, null)
                setChatMessages(messages)

                const otherRole = user.role === 'customer' ? 'provider' : 'customer'
                const status = await checkPartyStatus(sessionId, otherRole)
                setOtherPartyStatus(status)

                eventLogger.setSession(sessionId)
                eventLogger.setUser(user.userId || '')
                eventLogger.completed('contract_negotiation', 'contract_studio_loaded', {
                    sessionId: sessionId,
                    sessionNumber: data.session.sessionNumber,
                    userRole: user.role,
                    clauseCount: data.clauses.length,
                    alignmentPercentage: data.leverage?.alignmentPercentage
                })
            }

            setLoading(false)
        }

        init()
    }, [loadUserInfo, loadContractData, loadClauseChat, searchParams, router])

    useEffect(() => {
        if (session?.sessionId && sessionStatus === 'ready' && !clarenceWelcomeLoaded && !loading) {
            loadClarenceWelcome(session.sessionId)
        }
    }, [session?.sessionId, sessionStatus, clarenceWelcomeLoaded, loading, loadClarenceWelcome])

    useEffect(() => {
        if (latestMessageRef.current) {
            latestMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }, [chatMessages])

    useEffect(() => {
        if (clauses.length > 0) {
            const opportunities = detectTradeOffOpportunities(clauses, selectedClause)
            setTradeOffOpportunities(opportunities)
        }
    }, [clauses, selectedClause])

    useEffect(() => {
        if (selectedClause && userInfo) {
            const currentPosition = userInfo.role === 'customer'
                ? selectedClause.customerPosition
                : selectedClause.providerPosition
            setProposedPosition(currentPosition)
            setIsAdjusting(false)
            setPendingLeverageImpact(0)
        }
    }, [selectedClause?.positionId, userInfo])

    // ============================================================================
    // SECTION 8: EVENT HANDLERS
    // ============================================================================

    const handlePositionDrag = (newPosition: number) => {
        if (!selectedClause || !userInfo || !leverage) return

        setProposedPosition(newPosition)
        setIsAdjusting(true)

        const originalPosition = userInfo.role === 'customer'
            ? selectedClause.originalCustomerPosition
            : selectedClause.originalProviderPosition

        if (originalPosition !== null) {
            const weight = userInfo.role === 'customer'
                ? selectedClause.customerWeight
                : selectedClause.providerWeight

            const impact = calculateLeverageImpact(
                originalPosition,
                newPosition,
                weight,
                userInfo.role as 'customer' | 'provider'
            )
            setPendingLeverageImpact(impact)
        }
    }

    const handleSetPosition = async () => {
        if (!selectedClause || !userInfo || !session || !leverage || proposedPosition === null) return

        const currentPosition = userInfo.role === 'customer'
            ? selectedClause.customerPosition
            : selectedClause.providerPosition

        if (currentPosition === proposedPosition) {
            setIsAdjusting(false)
            return
        }

        setIsCommitting(true)

        try {
            const result = await commitPositionChange(
                session.sessionId,
                selectedClause.positionId,
                userInfo.role as 'customer' | 'provider',
                proposedPosition,
                pendingLeverageImpact
            )

            if (result.success) {
                const updatedClauses = clauses.map(c => {
                    if (c.positionId === selectedClause.positionId) {
                        const newGap = calculateGapSize(
                            userInfo.role === 'customer' ? proposedPosition : c.customerPosition,
                            userInfo.role === 'provider' ? proposedPosition : c.providerPosition
                        )
                        return {
                            ...c,
                            customerPosition: userInfo.role === 'customer' ? proposedPosition : c.customerPosition,
                            providerPosition: userInfo.role === 'provider' ? proposedPosition : c.providerPosition,
                            gapSize: newGap,
                            status: determineClauseStatus(newGap)
                        }
                    }
                    return c
                })

                setClauses(updatedClauses)
                setClauseTree(buildClauseTree(updatedClauses))

                const updatedSelectedClause = updatedClauses.find(c => c.positionId === selectedClause.positionId)
                if (updatedSelectedClause) {
                    setSelectedClause(updatedSelectedClause)
                }

                const newLeverage = recalculateLeverageTracker(
                    leverage.leverageScoreCustomer,
                    leverage.leverageScoreProvider,
                    updatedClauses,
                    userInfo.role as 'customer' | 'provider'
                )

                setLeverage({
                    ...leverage,
                    leverageTrackerCustomer: newLeverage.customerLeverage,
                    leverageTrackerProvider: newLeverage.providerLeverage,
                    leverageTrackerCalculatedAt: new Date().toISOString()
                })

                setIsAdjusting(false)
                setPendingLeverageImpact(0)
            }
        } catch (error) {
            console.error('Error setting position:', error)
        } finally {
            setIsCommitting(false)
        }
    }

    const handleResetPosition = async () => {
        if (!selectedClause || !userInfo || !session || !leverage) return

        const originalPosition = userInfo.role === 'customer'
            ? selectedClause.originalCustomerPosition
            : selectedClause.originalProviderPosition

        if (originalPosition === null) return

        setShowResetConfirm(false)
        setIsCommitting(true)

        try {
            const result = await commitPositionChange(
                session.sessionId,
                selectedClause.positionId,
                userInfo.role as 'customer' | 'provider',
                originalPosition,
                0
            )

            if (result.success) {
                const updatedClauses = clauses.map(c => {
                    if (c.positionId === selectedClause.positionId) {
                        const newGap = calculateGapSize(
                            userInfo.role === 'customer' ? originalPosition : c.customerPosition,
                            userInfo.role === 'provider' ? originalPosition : c.providerPosition
                        )
                        return {
                            ...c,
                            customerPosition: userInfo.role === 'customer' ? originalPosition : c.customerPosition,
                            providerPosition: userInfo.role === 'provider' ? originalPosition : c.providerPosition,
                            gapSize: newGap,
                            status: determineClauseStatus(newGap)
                        }
                    }
                    return c
                })

                setClauses(updatedClauses)
                setClauseTree(buildClauseTree(updatedClauses))

                const updatedSelectedClause = updatedClauses.find(c => c.positionId === selectedClause.positionId)
                if (updatedSelectedClause) {
                    setSelectedClause(updatedSelectedClause)
                }

                const newLeverage = recalculateLeverageTracker(
                    leverage.leverageScoreCustomer,
                    leverage.leverageScoreProvider,
                    updatedClauses,
                    userInfo.role as 'customer' | 'provider'
                )

                setLeverage({
                    ...leverage,
                    leverageTrackerCustomer: newLeverage.customerLeverage,
                    leverageTrackerProvider: newLeverage.providerLeverage,
                    leverageTrackerCalculatedAt: new Date().toISOString()
                })

                setProposedPosition(originalPosition)
                setIsAdjusting(false)
                setPendingLeverageImpact(0)
            }
        } catch (error) {
            console.error('Error resetting position:', error)
        } finally {
            setIsCommitting(false)
        }
    }

    const handleClauseSelect = (clause: ContractClause) => {
        setSelectedClause(clause)
        setActiveTab('dynamics')

        if (session?.sessionId && sessionStatus === 'ready') {
            explainClauseWithClarence(session.sessionId, clause)
        }
    }

    const handleClauseToggle = (positionId: string) => {
        const toggleExpanded = (items: ContractClause[]): ContractClause[] => {
            return items.map(item => {
                if (item.positionId === positionId) {
                    return { ...item, isExpanded: !item.isExpanded }
                }
                if (item.children && item.children.length > 0) {
                    return { ...item, children: toggleExpanded(item.children) }
                }
                return item
            })
        }

        setClauseTree(toggleExpanded(clauseTree))
    }

    const handleSendMessage = async () => {
        if (!chatInput.trim() || !session || !userInfo) return

        const userMessage = chatInput.trim()

        const newMessage: ClauseChatMessage = {
            messageId: `msg-${Date.now()}`,
            sessionId: session.sessionId,
            positionId: selectedClause?.positionId || null,
            sender: userInfo.role || 'customer',
            senderUserId: userInfo.userId || null,
            message: userMessage,
            messageType: 'discussion',
            relatedPositionChange: false,
            triggeredBy: 'manual',
            createdAt: new Date().toISOString()
        }

        setChatMessages(prev => [...prev, newMessage])
        setChatInput('')
        setIsChatLoading(true)

        try {
            const response = await callClarenceAI(session.sessionId, 'chat', {
                message: userMessage,
                clauseId: selectedClause?.clauseId
            })

            if (response?.success && response.response) {
                const clarenceResponse: ClauseChatMessage = {
                    messageId: `clarence-${Date.now()}`,
                    sessionId: session.sessionId,
                    positionId: selectedClause?.positionId || null,
                    sender: 'clarence',
                    senderUserId: null,
                    message: response.response,
                    messageType: 'auto_response',
                    relatedPositionChange: false,
                    triggeredBy: 'user_message',
                    createdAt: new Date().toISOString()
                }

                setChatMessages(prev => [...prev, clarenceResponse])
            }
        } catch (error) {
            console.error('CLARENCE chat error:', error)
        } finally {
            setIsChatLoading(false)
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    const handleSendInvite = async () => {
        if (!providerEmail.trim() || !session) return

        setInviteSending(true)

        try {
            const response = await fetch(`${API_BASE}/invite-provider`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: session.sessionId,
                    sessionNumber: session.sessionNumber,
                    customerCompany: session.customerCompany,
                    serviceRequired: session.serviceType,
                    dealValue: session.dealValue.replace(/[£$€,]/g, ''),
                    provider: {
                        companyName: '',
                        contactName: '',
                        contactEmail: providerEmail
                    }
                })
            })

            if (response.ok) {
                setInviteSent(true)
                setSessionStatus('provider_invited')
            } else {
                alert('Failed to send invitation. Please try again.')
            }
        } catch (error) {
            console.error('Error sending invite:', error)
            alert('Failed to send invitation. Please check your connection and try again.')
        }

        setInviteSending(false)
    }

    // ============================================================================
    // SECTION 9: LOADING & CONDITIONAL RENDERING
    // ============================================================================

    if (loading) {
        return <ContractStudioLoading />
    }

    if (sessionStatus === 'pending_provider' || sessionStatus === 'provider_invited' || sessionStatus === 'leverage_pending') {
        return <PendingProviderView
            session={session}
            sessionStatus={sessionStatus}
            setSessionStatus={setSessionStatus}
            providerEmail={providerEmail}
            setProviderEmail={setProviderEmail}
            inviteSending={inviteSending}
            inviteSent={inviteSent}
            setInviteSent={setInviteSent}
            handleSendInvite={handleSendInvite}
            router={router}
        />
    }

    if (!session || !userInfo) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 mb-4">Failed to load contract data</p>
                    <button
                        onClick={() => router.push('/auth/contracts-dashboard')}
                        className="mt-6 px-6 py-2 text-slate-600 hover:text-slate-800 transition cursor-pointer"
                    >
                        ← Return to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    const displayLeverage: LeverageData = leverage || {
        leverageScoreCustomer: 50,
        leverageScoreProvider: 50,
        leverageScoreCalculatedAt: '',
        leverageTrackerCustomer: 50,
        leverageTrackerProvider: 50,
        alignmentPercentage: 0,
        isAligned: false,
        leverageTrackerCalculatedAt: '',
        marketDynamicsScore: 0,
        marketDynamicsRationale: 'Pending provider intake',
        economicFactorsScore: 0,
        economicFactorsRationale: 'Pending provider intake',
        strategicPositionScore: 0,
        strategicPositionRationale: 'Pending provider intake',
        batnaScore: 0,
        batnaRationale: 'Pending provider intake'
    }

    const clauseStats = calculateClauseStats(clauseTree)

    // ============================================================================
    // SECTION 10: POSITION ADJUSTMENT PANEL COMPONENT
    // ============================================================================

    const PositionAdjustmentPanel = () => {
        if (!selectedClause || !userInfo) return null

        const isCustomer = userInfo.role === 'customer'
        const myPosition = isCustomer ? selectedClause.customerPosition : selectedClause.providerPosition
        const otherPosition = isCustomer ? selectedClause.providerPosition : selectedClause.customerPosition
        const originalPosition = isCustomer ? selectedClause.originalCustomerPosition : selectedClause.originalProviderPosition
        const myWeight = isCustomer ? selectedClause.customerWeight : selectedClause.providerWeight

        const hasChanged = originalPosition !== null && myPosition !== originalPosition
        const isProposing = isAdjusting && proposedPosition !== myPosition
        const hasPositionOptions = selectedClause.positionOptions && selectedClause.positionOptions.length > 0

        const getPositionLabel = (value: number | null): string => {
            if (value === null) return 'Not set'
            if (!hasPositionOptions) return `Position ${value}`
            const option = selectedClause.positionOptions?.find(o => o.value === value)
            return option?.label || `Position ${value}`
        }

        return (
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-5 mb-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isCustomer ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                        <h4 className="font-semibold text-slate-800">Your Position</h4>
                        {hasChanged && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                Changed from {getPositionLabel(originalPosition)}
                            </span>
                        )}
                    </div>
                    <div className="text-sm text-slate-500">
                        Weight: <span className="font-semibold text-slate-700">{myWeight}/10</span>
                        {myWeight >= 8 && <span className="ml-1 text-amber-600">★ High Priority</span>}
                    </div>
                </div>

                {/* Position Options View */}
                {hasPositionOptions ? (
                    <div className="space-y-3">
                        <div className="space-y-2">
                            {selectedClause.positionOptions!.map((option) => {
                                const isMyPosition = myPosition === option.value
                                const isOtherPosition = otherPosition === option.value
                                const isRecommended = selectedClause.clarenceRecommendation === option.value
                                const isProposed = proposedPosition === option.value && proposedPosition !== myPosition

                                return (
                                    <div
                                        key={option.value}
                                        onClick={() => {
                                            if (!isMyPosition) {
                                                handlePositionDrag(option.value)
                                            }
                                        }}
                                        className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${isProposed
                                                ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-200'
                                                : isMyPosition
                                                    ? `${isCustomer ? 'bg-emerald-50 border-emerald-400' : 'bg-blue-50 border-blue-400'}`
                                                    : isOtherPosition
                                                        ? `${isCustomer ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'}`
                                                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                                                        ({option.value})
                                                    </span>
                                                    <span className="text-sm font-semibold text-slate-800">{option.label}</span>

                                                    {isMyPosition && (
                                                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${isCustomer ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                                            }`}>
                                                            Your Position
                                                        </span>
                                                    )}
                                                    {isOtherPosition && (
                                                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${isCustomer ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                                                            }`}>
                                                            {isCustomer ? 'Provider' : 'Customer'}
                                                        </span>
                                                    )}
                                                    {isRecommended && (
                                                        <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded flex items-center gap-1">
                                                            <span>★</span> CLARENCE
                                                        </span>
                                                    )}
                                                    {isProposed && (
                                                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded animate-pulse">
                                                            ⟳ Proposed
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">{option.description}</p>
                                            </div>

                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isMyPosition
                                                    ? `${isCustomer ? 'border-emerald-500 bg-emerald-500' : 'border-blue-500 bg-blue-500'}`
                                                    : isProposed
                                                        ? 'border-amber-500 bg-amber-500'
                                                        : 'border-slate-300'
                                                }`}>
                                                {(isMyPosition || isProposed) && (
                                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ) : (
                    /* Numeric Slider Fallback */
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    step="0.5"
                                    value={proposedPosition ?? myPosition ?? 5}
                                    onChange={(e) => handlePositionDrag(parseFloat(e.target.value))}
                                    className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between mt-1 px-1">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                        <div key={n} className="text-xs text-slate-400">{n}</div>
                                    ))}
                                </div>
                            </div>
                            <div className="w-20">
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    step="0.5"
                                    value={proposedPosition ?? myPosition ?? 5}
                                    onChange={(e) => handlePositionDrag(parseFloat(e.target.value))}
                                    className="w-full px-3 py-2 text-center text-lg font-bold border border-slate-300 rounded-lg"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Leverage Impact Preview */}
                {isProposing && pendingLeverageImpact !== 0 && (
                    <div className={`p-3 rounded-lg mt-4 ${pendingLeverageImpact < 0 ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                        <span className={`text-sm ${pendingLeverageImpact < 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
                            <strong>Leverage Impact:</strong> This move will {pendingLeverageImpact < 0 ? 'cost you' : 'gain you'}{' '}
                            <span className="font-bold">{Math.abs(pendingLeverageImpact).toFixed(1)}%</span> leverage
                        </span>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={handleSetPosition}
                        disabled={!isProposing || isCommitting}
                        className={`flex-1 py-3 px-4 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${isProposing && !isCommitting
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        {isCommitting ? 'Setting...' : 'Set Position'}
                    </button>

                    {hasChanged && (
                        <button
                            onClick={() => setShowResetConfirm(true)}
                            disabled={isCommitting}
                            className="px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition"
                        >
                            Reset
                        </button>
                    )}
                </div>

                {/* Reset Confirmation Modal */}
                {showResetConfirm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-xl">
                            <h3 className="text-lg font-semibold text-slate-800 mb-2">Reset Position?</h3>
                            <p className="text-slate-600 mb-4">
                                This will restore your position on <strong>{selectedClause.clauseName}</strong> back to <strong>{getPositionLabel(originalPosition)}</strong>.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleResetPosition}
                                    className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition"
                                >
                                    Yes, Reset
                                </button>
                                <button
                                    onClick={() => setShowResetConfirm(false)}
                                    className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Gap Info */}
                <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Gap to other party:</span>
                        <span className={`font-semibold ${selectedClause.gapSize <= 1 ? 'text-emerald-600' :
                            selectedClause.gapSize <= 3 ? 'text-amber-600' :
                                'text-red-600'
                            }`}>
                            {selectedClause.gapSize.toFixed(1)} position{selectedClause.gapSize !== 1 ? 's' : ''} apart
                            {selectedClause.gapSize <= 1 && ' ✓ Aligned'}
                        </span>
                    </div>
                </div>
            </div>
        )
    }

    // ============================================================================
    // SECTION 11: LEVERAGE INDICATOR COMPONENT
    // ============================================================================

    const LeverageIndicator = () => {
        const customerShift = displayLeverage.leverageTrackerCustomer - displayLeverage.leverageScoreCustomer
        const isCustomerGaining = customerShift > 0

        return (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-700">Negotiation Metrics</h3>
                        <button
                            onClick={() => setShowLeverageDetails(!showLeverageDetails)}
                            className="text-xs text-slate-400 hover:text-slate-600"
                        >
                            {showLeverageDetails ? 'Hide Details' : 'Show Details'}
                        </button>
                    </div>

                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${displayLeverage.alignmentPercentage >= 90
                        ? 'bg-emerald-100 text-emerald-700'
                        : displayLeverage.alignmentPercentage >= 70
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                        {displayLeverage.alignmentPercentage}% Aligned
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">Leverage Score</div>
                        <div className="text-lg font-bold text-slate-800">
                            {displayLeverage.leverageScoreCustomer} : {displayLeverage.leverageScoreProvider}
                        </div>
                        <div className="text-xs text-slate-400">Fixed baseline</div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">Alignment Score</div>
                        <div className="text-lg font-bold text-emerald-600">
                            {displayLeverage.alignmentPercentage}%
                        </div>
                        <div className="text-xs text-slate-400">Progress to agreement</div>
                    </div>

                    <div className={`rounded-lg p-3 ${Math.abs(customerShift) > 0
                        ? (isCustomerGaining ? 'bg-emerald-50' : 'bg-amber-50')
                        : 'bg-slate-50'
                        }`}>
                        <div className="text-xs text-slate-500 mb-1">Leverage Tracker</div>
                        <div className="text-lg font-bold text-slate-800">
                            {displayLeverage.leverageTrackerCustomer} : {displayLeverage.leverageTrackerProvider}
                        </div>
                        <div className={`text-xs ${Math.abs(customerShift) > 0
                            ? (isCustomerGaining ? 'text-emerald-600' : 'text-amber-600')
                            : 'text-slate-400'
                            }`}>
                            {Math.abs(customerShift) > 0
                                ? `${isCustomerGaining ? '↑' : '↓'} ${Math.abs(customerShift)}% from baseline`
                                : 'No change yet'
                            }
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ============================================================================
    // SECTION 12: CLAUSE TREE ITEM COMPONENT
    // ============================================================================

    const ClauseTreeItem = ({ clause, depth = 0 }: { clause: ContractClause, depth?: number }) => {
        const hasChildren = clause.children && clause.children.length > 0
        const isSelected = selectedClause?.positionId === clause.positionId

        return (
            <div>
                <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition group ${isSelected
                        ? 'bg-emerald-50 border border-emerald-200'
                        : 'hover:bg-slate-50'
                        }`}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                    onClick={() => handleClauseSelect(clause)}
                >
                    {hasChildren ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleClauseToggle(clause.positionId)
                            }}
                            className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600"
                        >
                            <svg
                                className={`w-3 h-3 transition-transform ${clause.isExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    ) : (
                        <div className="w-4"></div>
                    )}

                    <div className={`w-2 h-2 rounded-full ${getStatusBgColor(clause.status)}`}></div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-mono">{clause.clauseNumber}</span>
                            <span className={`text-sm truncate ${isSelected ? 'text-emerald-700 font-medium' : 'text-slate-700'}`}>
                                {clause.clauseName}
                            </span>
                        </div>
                    </div>

                    {(clause.customerWeight >= 8 || clause.providerWeight >= 8) && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                            W{Math.max(clause.customerWeight, clause.providerWeight)}
                        </span>
                    )}

                    {(clause.isDealBreakerCustomer || clause.isDealBreakerProvider) && (
                        <span className="text-red-500 text-xs">⚑</span>
                    )}
                </div>

                {hasChildren && clause.isExpanded && (
                    <div>
                        {clause.children!.map(child => (
                            <ClauseTreeItem key={child.positionId} clause={child} depth={depth + 1} />
                        ))}
                    </div>
                )}
            </div>
        )
    }

    // ============================================================================
    // SECTION 13: PARTY STATUS BANNER COMPONENT
    // ============================================================================

    const PartyStatusBanner = () => {
        const isCustomer = userInfo.role === 'customer'

        return (
            <div className="bg-slate-800 text-white">
                <div className="px-6 py-2 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => router.push('/auth/contracts-dashboard')}
                            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition cursor-pointer"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            <span className="text-sm">Dashboard</span>
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">C</span>
                            </div>
                            <div>
                                <span className="font-semibold text-white tracking-wide">CLARENCE</span>
                                <span className="text-slate-400 text-sm ml-2">Contract Studio</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                            <span className="text-sm text-slate-300">
                                {userInfo.firstName} {userInfo.lastName}
                            </span>
                            <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">
                                {isCustomer ? 'Customer' : 'Provider'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-[200px]">
                            <div className={`w-3 h-3 rounded-full ${isCustomer ? 'bg-emerald-400 animate-pulse' : (otherPartyStatus.isOnline ? 'bg-emerald-400' : 'bg-slate-500')}`}></div>
                            <div>
                                <div className="text-xs text-slate-400">Customer</div>
                                <div className="text-sm font-medium text-emerald-400">{session.customerCompany}</div>
                            </div>
                            {isCustomer && (
                                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                                    You
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-8">
                            <div className="text-center">
                                <div className="text-xs text-slate-400">Session</div>
                                <div className="text-sm font-mono text-white">{session.sessionNumber}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs text-slate-400">Deal Value</div>
                                <div className="text-sm font-semibold text-emerald-400">{session.dealValue}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs text-slate-400">Phase</div>
                                <div className="text-sm">
                                    <span className="inline-flex items-center gap-1">
                                        <span className="w-5 h-5 bg-emerald-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                            {session.phase}
                                        </span>
                                        <span className="text-slate-300">of 6</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 min-w-[200px] justify-end">
                            {!isCustomer && (
                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                                    You
                                </span>
                            )}
                            <div className="text-right">
                                <div className="text-xs text-slate-400">Provider</div>
                                <div className="text-sm font-medium text-blue-400">{session.providerCompany}</div>
                            </div>
                            <div className={`w-3 h-3 rounded-full ${!isCustomer ? 'bg-emerald-400 animate-pulse' : (otherPartyStatus.isOnline ? 'bg-emerald-400' : 'bg-slate-500')}`}></div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ============================================================================
    // SECTION 14: MAIN LAYOUT RENDER
    // ============================================================================

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <PartyStatusBanner />

            <div className="flex h-[calc(100vh-100px)] overflow-hidden">
                {/* LEFT PANEL: Clause Navigation */}
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
                    <div className="flex-shrink-0 p-4 border-b border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-semibold text-slate-800">Contract Clauses</h2>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-center">
                            <div className="bg-emerald-50 rounded p-2">
                                <div className="text-lg font-bold text-emerald-600">{clauseStats.aligned}</div>
                                <div className="text-xs text-emerald-600">Aligned</div>
                            </div>
                            <div className="bg-amber-50 rounded p-2">
                                <div className="text-lg font-bold text-amber-600">{clauseStats.negotiating}</div>
                                <div className="text-xs text-amber-600">Active</div>
                            </div>
                            <div className="bg-red-50 rounded p-2">
                                <div className="text-lg font-bold text-red-600">{clauseStats.disputed}</div>
                                <div className="text-xs text-red-600">Disputed</div>
                            </div>
                            <div className="bg-slate-50 rounded p-2">
                                <div className="text-lg font-bold text-slate-600">{clauseStats.pending}</div>
                                <div className="text-xs text-slate-600">Pending</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                        {clauseTree.map(clause => (
                            <ClauseTreeItem key={clause.positionId} clause={clause} />
                        ))}
                    </div>
                </div>

                {/* CENTER PANEL: Main Workspace */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-shrink-0 p-4 pb-0">
                        <LeverageIndicator />
                    </div>

                    {selectedClause && (
                        <div className="flex-shrink-0 px-6 py-3 border-b border-slate-200 bg-white mx-4 rounded-t-xl mt-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-mono text-slate-400">{selectedClause.clauseNumber}</span>
                                        <h2 className="text-lg font-semibold text-slate-800">{selectedClause.clauseName}</h2>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedClause.status === 'aligned' ? 'bg-emerald-100 text-emerald-700' :
                                            selectedClause.status === 'negotiating' ? 'bg-amber-100 text-amber-700' :
                                                selectedClause.status === 'disputed' ? 'bg-red-100 text-red-700' :
                                                    'bg-slate-100 text-slate-700'
                                            }`}>
                                            {selectedClause.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 mt-1">{selectedClause.description}</p>
                                </div>

                                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                                    {(['dynamics', 'tradeoffs', 'history', 'draft'] as const).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`px-3 py-1.5 text-sm rounded-md transition ${activeTab === tab
                                                ? 'bg-white text-slate-800 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Workspace Content */}
                    <div className="flex-1 overflow-y-auto p-4 pt-0">
                        {activeTab === 'dynamics' && selectedClause && (
                            <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6">
                                <PositionAdjustmentPanel />

                                {/* Position Comparison */}
                                <div className="mb-6">
                                    <h3 className="text-sm font-semibold text-slate-700 mb-4">Position Overview</h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className={`p-4 rounded-lg ${userInfo.role === 'customer' ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                                <span className="text-sm font-medium text-slate-700">{session.customerCompany}</span>
                                                {userInfo.role === 'customer' && <span className="text-xs text-emerald-600">(You)</span>}
                                            </div>
                                            <div className="text-2xl font-bold text-slate-800">
                                                {selectedClause.customerPosition ?? 'Not set'}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                Weight: {selectedClause.customerWeight}/10
                                            </div>
                                        </div>

                                        <div className={`p-4 rounded-lg ${userInfo.role === 'provider' ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50'}`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                                <span className="text-sm font-medium text-slate-700">{session.providerCompany}</span>
                                                {userInfo.role === 'provider' && <span className="text-xs text-blue-600">(You)</span>}
                                            </div>
                                            <div className="text-2xl font-bold text-slate-800">
                                                {selectedClause.providerPosition ?? 'Not set'}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                Weight: {selectedClause.providerWeight}/10
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'tradeoffs' && selectedClause && (
                            <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6">
                                <p className="text-slate-600">Trade-offs panel</p>
                            </div>
                        )}

                        {activeTab === 'draft' && selectedClause && (
                            <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6">
                                <p className="text-slate-600">Draft language panel</p>
                            </div>
                        )}

                        {!selectedClause && (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center">
                                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-medium text-slate-700 mb-2">Select a Clause</h3>
                                    <p className="text-sm text-slate-500">Choose a clause from the left panel to view and adjust positions</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL: CLARENCE Chat */}
                <div className="w-96 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
                    <div className="flex-shrink-0 p-4 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold">C</span>
                            </div>
                            <div className="flex-1">
                                <div className="font-semibold text-slate-800">CLARENCE</div>
                                <div className="text-xs text-slate-500">
                                    {selectedClause
                                        ? `Discussing: ${selectedClause.clauseNumber} ${selectedClause.clauseName}`
                                        : 'General Discussion'
                                    }
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                        {chatMessages.map((msg, index) => {
                            const isLatestMessage = index === chatMessages.length - 1

                            return (
                                <div
                                    key={msg.messageId}
                                    ref={isLatestMessage ? latestMessageRef : null}
                                    className={`flex ${msg.sender === 'customer' || msg.sender === 'provider' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[85%] rounded-lg p-3 ${msg.sender === 'clarence'
                                        ? 'bg-white text-slate-700 border border-slate-200'
                                        : msg.sender === 'customer'
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-blue-500 text-white'
                                        }`}>
                                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                        <div className={`text-xs mt-2 ${msg.sender === 'clarence' ? 'text-slate-400' : 'text-white/70'}`}>
                                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}

                        {isChatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white rounded-lg p-3 border border-slate-200">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-shrink-0 p-4 border-t border-slate-200 bg-white">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Ask CLARENCE anything..."
                                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                disabled={isChatLoading}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!chatInput.trim() || isChatLoading}
                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-lg transition"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 15: PENDING PROVIDER VIEW COMPONENT
// ============================================================================

interface PendingProviderViewProps {
    session: Session | null
    sessionStatus: SessionStatus
    setSessionStatus: (status: SessionStatus) => void
    providerEmail: string
    setProviderEmail: (email: string) => void
    inviteSending: boolean
    inviteSent: boolean
    setInviteSent: (sent: boolean) => void
    handleSendInvite: () => void
    router: ReturnType<typeof useRouter>
}

function PendingProviderView({
    session,
    sessionStatus,
    providerEmail,
    setProviderEmail,
    inviteSending,
    inviteSent,
    handleSendInvite,
    router
}: PendingProviderViewProps) {
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="bg-slate-800 text-white px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">C</span>
                        </div>
                        <div>
                            <h1 className="font-semibold">Contract Studio</h1>
                            <p className="text-sm text-slate-400">{session?.sessionNumber}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push('/auth/contracts-dashboard')}
                        className="text-slate-400 hover:text-white transition"
                    >
                        ← Back to Dashboard
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-8">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                    <div className="text-center">
                        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                            {sessionStatus === 'pending_provider' && !inviteSent ? 'Invite Your Provider' : 'Awaiting Provider Response'}
                        </h2>
                        <p className="text-slate-600 max-w-md mx-auto mb-6">
                            {sessionStatus === 'pending_provider' && !inviteSent
                                ? 'Your strategic assessment is complete. Invite the provider to complete their intake.'
                                : 'We\'ve sent an invitation. You\'ll be notified when they complete their questionnaire.'
                            }
                        </p>

                        {sessionStatus === 'pending_provider' && !inviteSent && (
                            <div className="max-w-md mx-auto">
                                <input
                                    type="email"
                                    value={providerEmail}
                                    onChange={(e) => setProviderEmail(e.target.value)}
                                    placeholder="provider@company.com"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4"
                                />
                                <button
                                    onClick={handleSendInvite}
                                    disabled={!providerEmail.trim() || inviteSending}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold rounded-lg"
                                >
                                    {inviteSending ? 'Sending...' : 'Send Invitation'}
                                </button>
                            </div>
                        )}

                        {(sessionStatus === 'provider_invited' || inviteSent) && (
                            <button
                                onClick={() => router.push('/auth/contracts-dashboard')}
                                className="px-6 py-2 text-slate-600 border border-slate-300 rounded-lg"
                            >
                                ← Return to Dashboard
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 16: DEFAULT EXPORT WITH SUSPENSE WRAPPER
// ============================================================================

export default function ContractStudioPage() {
    return (
        <Suspense fallback={<ContractStudioLoading />}>
            <ContractStudioContent />
        </Suspense>
    )
}