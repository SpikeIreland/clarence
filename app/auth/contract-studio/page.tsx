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
// SECTION 2A: POSITION OPTIONS LOOKUP (MAPPED TO ACTUAL DATABASE CLAUSE NAMES)
// ============================================================================

// Maps actual clause_name values from contract_clauses table to position options
// Based on John Hayward's Appendix A negotiation framework

const CLAUSE_POSITION_OPTIONS: Record<string, PositionOption[]> = {
    // ========== SERVICE DELIVERY ==========
    'Scope of Services': [
        { value: 1, label: 'Listed services only', description: 'Only those services explicitly listed in the contract' },
        { value: 2, label: 'Plus reasonable adjuncts', description: 'Listed services plus those seen as a reasonable adjunct' },
        { value: 3, label: 'Plus inherent services', description: 'Plus those inherent in and ordinarily part of the services' },
        { value: 4, label: 'Maximum scope', description: 'Plus those previously done by transferring personnel and within scope of transferring contracts' }
    ],
    'Due Diligence': [
        { value: 1, label: 'No DD clause', description: 'No due diligence clause included' },
        { value: 2, label: 'DD with material claims', description: 'DD clause included but right to claim for material inaccuracies' },
        { value: 3, label: 'DD with reasonable efforts', description: 'Claims limited to those provider could not have uncovered exercising reasonable efforts' },
        { value: 4, label: 'Full DD conducted', description: 'All due diligence conducted, provider accepts full responsibility' }
    ],
    'Customer Dependencies': [
        { value: 1, label: 'Minimal dependencies', description: 'Very limited customer obligations' },
        { value: 2, label: 'Standard dependencies', description: 'Reasonable customer inputs required' },
        { value: 3, label: 'Extensive list', description: 'Comprehensive list of customer obligations' },
        { value: 4, label: 'Maximum dependencies', description: 'Extensive obligations including "reasonably required" inputs' }
    ],
    'Transition & Transformation': [
        { value: 1, label: 'Best efforts', description: 'Supplier uses best efforts to complete on time' },
        { value: 2, label: 'Reasonable endeavours', description: 'Reasonable endeavours with limited penalties' },
        { value: 3, label: 'Fixed plans', description: 'Binding obligation with reasonable financial penalties' },
        { value: 4, label: 'Strict obligation', description: 'Binding obligation with penalties and long stop termination right' }
    ],
    'Relief Events': [
        { value: 1, label: 'No relief provision', description: 'Contract silent on relief; prevention principle applies' },
        { value: 2, label: 'Limited relief', description: 'Relief for major force majeure events only' },
        { value: 3, label: 'Standard relief', description: 'Standard force majeure and customer-caused delays' },
        { value: 4, label: 'Broad relief', description: 'Comprehensive relief provisions favoring supplier' }
    ],

    // ========== SERVICE LEVELS ==========
    'At Risk Amount': [
        { value: 1, label: '5% at-risk', description: '5% of monthly charges at risk' },
        { value: 2, label: '8% at-risk', description: '8% of monthly charges at risk' },
        { value: 3, label: '10% at-risk', description: '10% of monthly charges at risk' },
        { value: 4, label: '12.5% at-risk', description: '12.5% of monthly charges at risk' },
        { value: 5, label: '15% at-risk', description: '15% of monthly charges at risk' },
        { value: 6, label: '20% at-risk', description: '20% of monthly charges at risk' }
    ],
    'Link to Damages': [
        { value: 1, label: 'Sole remedy', description: 'Service credits are the sole and exclusive remedy' },
        { value: 2, label: 'Primary remedy', description: 'Service credits primary but damages for persistent breach' },
        { value: 3, label: 'Not exclusive', description: 'Service credits expressly not the sole remedy' },
        { value: 4, label: 'Plus full damages', description: 'Service credits plus right to claim all direct damages' }
    ],
    'Earn-back / Bonus': [
        { value: 1, label: 'No earn-back', description: 'No earn-back or bonus provisions' },
        { value: 2, label: 'Same SL only', description: 'Earn-back against same service level only' },
        { value: 3, label: 'Within category', description: 'Earn-back within same service level category' },
        { value: 4, label: 'General earn-back', description: 'Earn-back across all service levels each month' }
    ],
    'Termination & Step In': [
        { value: 1, label: 'Material breach only', description: 'Termination only for material breach of SLAs' },
        { value: 2, label: 'Persistent breach', description: 'Termination for persistent SLA failures' },
        { value: 3, label: 'Defined breaches', description: 'Termination for defined SLA breaches (less than material)' },
        { value: 4, label: 'Any SLA breach', description: 'Broad termination rights for service level failures' }
    ],
    'Non-Financial Remedies': [
        { value: 1, label: 'No escalation', description: 'No formal escalation process' },
        { value: 2, label: 'Basic escalation', description: 'Escalation to account manager level' },
        { value: 3, label: 'Senior escalation', description: 'Escalation to senior management with correction plan' },
        { value: 4, label: 'Executive escalation', description: 'Escalation to executive level with binding remediation' }
    ],

    // ========== TERMINATION ==========
    'Term Renewal / Extension': [
        { value: 1, label: 'No extension right', description: 'No automatic extension rights' },
        { value: 2, label: 'Single extension', description: 'One extension period with mutual agreement' },
        { value: 3, label: 'Two extensions', description: 'Two separate 1-year extension rights' },
        { value: 4, label: 'Flexible extensions', description: 'Multiple extensions; supplier cannot refuse' }
    ],
    'Renewal / Extension Pricing': [
        { value: 1, label: 'Market rates', description: 'Extension at then-current market rates' },
        { value: 2, label: 'Capped increase', description: 'Maximum 5% increase on extension' },
        { value: 3, label: 'Index-linked', description: 'Pricing adjusted by inflation index only' },
        { value: 4, label: 'Same pricing', description: 'No difference in pricing during extended term' }
    ],
    'Customer Termination Right': [
        { value: 1, label: 'Material breach only', description: 'Termination only for material unremedied breach' },
        { value: 2, label: 'Standard rights', description: 'Material breach plus insolvency events' },
        { value: 3, label: 'Extended rights', description: 'Including persistent defaults and SLA breaches' },
        { value: 4, label: 'Extensive rights', description: 'Extensive list including non-material persistent defaults' }
    ],
    'Supplier Termination Right': [
        { value: 1, label: 'Any material breach', description: 'Termination for any material customer breach' },
        { value: 2, label: 'Payment default', description: 'Termination for payment default after notice' },
        { value: 3, label: 'Material non-payment', description: 'Material non-payment after extended notice' },
        { value: 4, label: 'Very limited', description: 'Limited to material non-payment after lengthy notice' }
    ],
    'Termination for Convenience': [
        { value: 1, label: 'Mutual - 180 days', description: 'Mutual right with 180 days notice' },
        { value: 2, label: 'Customer - 180 days', description: 'Customer only with 180 days notice' },
        { value: 3, label: 'Customer - 90 days', description: 'Customer only with 90 days notice' },
        { value: 4, label: 'Customer - 60 days', description: 'Customer only with 60 days notice' },
        { value: 5, label: 'Customer - 30 days', description: 'Customer only with 30 days notice' },
        { value: 6, label: 'Customer - immediate', description: 'Customer can terminate with 0-6 months notice' }
    ],
    'Exit Assistance': [
        { value: 1, label: '3 months', description: '3 months post-termination assistance' },
        { value: 2, label: '6 months', description: '6 months post-termination assistance' },
        { value: 3, label: '9 months', description: '9 months with month-to-month extension option' },
        { value: 4, label: '12 months', description: '12 months minimum, starting when notice given' }
    ],
    'Termination Fee': [
        { value: 1, label: 'Full remaining term', description: 'All charges for remaining contract term' },
        { value: 2, label: 'Unrecovered + 3 months', description: 'Unrecovered costs plus 3 months charges' },
        { value: 3, label: 'Sliding scale', description: 'Sliding scale: 3 months Y1, 2 months Y2, 1 month Y3' },
        { value: 4, label: 'Unrecovered only', description: 'Unrecovered costs but no winddown charge' },
        { value: 5, label: 'No fee', description: 'No termination fee payable' }
    ],
    'Step In Rights': [
        { value: 1, label: 'No step-in', description: 'No step-in rights (extreme, hard to exercise)' },
        { value: 2, label: 'Material breach only', description: 'Step-in for material unremedied breach only' },
        { value: 3, label: 'Service degradation', description: 'For service degradation left unremedied' },
        { value: 4, label: 'Any unremedied issue', description: 'For any unremedied issue without materiality threshold' }
    ],

    // ========== INTELLECTUAL PROPERTY ==========
    'Ownership of New IP': [
        { value: 1, label: 'Supplier owns all', description: 'Supplier owns all new IP created' },
        { value: 2, label: 'Supplier with license', description: 'Supplier owns but customer has perpetual license' },
        { value: 3, label: 'Joint ownership', description: 'Joint ownership of new IP' },
        { value: 4, label: 'Customer owns new', description: 'Customer owns all new IP except supplier modifications' }
    ],
    'Scope of Usage Rights': [
        { value: 1, label: 'Term only', description: 'Rights to use during contract term only' },
        { value: 2, label: 'Term + transition', description: 'Term plus transition period' },
        { value: 3, label: 'Perpetual limited', description: 'Perpetual but limited to specific uses' },
        { value: 4, label: 'Unlimited perpetual', description: 'Unlimited and unrestricted post-termination' }
    ],
    'Protection Against 3rd Party IPR Claims': [
        { value: 1, label: 'No indemnity', description: 'No indemnity for IP claims' },
        { value: 2, label: 'Proven infringement', description: 'Indemnity for proven infringement only' },
        { value: 3, label: 'Full indemnity', description: 'Full indemnity for all losses from allegations' },
        { value: 4, label: 'Full + control', description: 'Full indemnity; customer controls defense' }
    ],

    // ========== EMPLOYMENT ==========
    'Control of Key Personnel': [
        { value: 1, label: 'No control', description: 'No customer control over personnel' },
        { value: 2, label: 'Consultation', description: 'Customer consulted on key personnel changes' },
        { value: 3, label: 'Consent required', description: 'Customer consent for key personnel changes' },
        { value: 4, label: 'Absolute veto', description: 'Absolute right of veto/removal for key personnel' }
    ],
    'Employee Related Costs': [
        { value: 1, label: 'Customer indemnified', description: 'Customer indemnified on entry and exit' },
        { value: 2, label: 'Split indemnity', description: 'Customer on entry, Supplier on exit' },
        { value: 3, label: 'Mutual indemnities', description: 'Mutual indemnities on entry and exit' },
        { value: 4, label: 'Supplier indemnified', description: 'Supplier indemnified on entry and exit' }
    ],

    // ========== CHARGES AND PAYMENT ==========
    'Certainty of Pricing': [
        { value: 1, label: 'Market adjustment', description: 'Annual adjustment to market rates' },
        { value: 2, label: 'High index', description: 'CPI/RPI adjustment uncapped' },
        { value: 3, label: 'Capped index', description: 'Low index applicable with a cap' },
        { value: 4, label: 'Fixed pricing', description: 'No change in first year; low index thereafter' }
    ],
    'Interest / Late Payment Sanctions': [
        { value: 1, label: '10% per annum', description: '10% per annum from due date' },
        { value: 2, label: 'Base + 8%', description: '8% above base rate' },
        { value: 3, label: 'Base + 4%', description: '4% above base rate' },
        { value: 4, label: 'Base + 2%', description: '2% above base; only after 30 days notice' },
        { value: 5, label: 'No interest', description: 'No late payment interest' }
    ],
    'Benchmarking': [
        { value: 1, label: 'No benchmarking', description: 'No benchmarking rights' },
        { value: 2, label: 'Advisory only', description: 'Benchmarking for information only' },
        { value: 3, label: 'Median adjustment', description: 'Adjustment to median within 6 months' },
        { value: 4, label: 'Upper quartile', description: 'Upper quartile; automatic adjustment in 3 months' }
    ],
    'Time for Payment': [
        { value: 1, label: '14 days', description: '14 days from invoice' },
        { value: 2, label: '30 days', description: '30 days from invoice' },
        { value: 3, label: '45 days', description: '45 days from invoice' },
        { value: 4, label: '60 days', description: '60 days from invoice' },
        { value: 5, label: '90 days', description: '90 days from invoice' }
    ],

    // ========== LIABILITY ==========
    'Cap for Supplier': [
        { value: 1, label: '50% annual', description: 'Aggregate cap at 50% of annual charges' },
        { value: 2, label: '100% annual', description: 'Aggregate cap at 100% of annual charges' },
        { value: 3, label: '150% annual', description: 'Aggregate cap at 150% of annual charges' },
        { value: 4, label: '200% annual', description: 'Aggregate cap at 200% of annual charges' },
        { value: 5, label: 'Per-claim 150%', description: 'Per-claim cap at 150% of annual charges' },
        { value: 6, label: 'Per-claim 200%', description: 'Per-claim cap at 200% of annual charges' }
    ],
    'Cap for Customer': [
        { value: 1, label: '50% annual', description: 'Customer liability at 50% of annual charges' },
        { value: 2, label: '100% annual', description: 'Customer liability at 100% of annual charges' },
        { value: 3, label: '150% annual', description: 'Customer liability at 150% of annual charges' },
        { value: 4, label: 'Unlimited', description: 'No cap on customer liability' }
    ],
    'Exclusions': [
        { value: 1, label: 'No exclusions', description: 'No exclusion for indirect or consequential losses' },
        { value: 2, label: 'Indirect only', description: 'Exclude indirect/consequential only' },
        { value: 3, label: 'Standard exclusions', description: 'Exclude indirect plus lost profits' },
        { value: 4, label: 'Broad exclusions', description: 'Exclude indirect, profits, savings, data, goodwill' }
    ],
    'Unlimited Losses': [
        { value: 1, label: 'Statutory only', description: 'Death/PI and employee claims only' },
        { value: 2, label: 'Plus confidentiality', description: 'Statutory plus confidentiality breach' },
        { value: 3, label: 'Plus IP', description: 'Statutory plus IP and confidentiality' },
        { value: 4, label: 'Plus gross negligence', description: 'Statutory plus gross negligence and wilful default' }
    ],

    // ========== DATA PROTECTION ==========
    'Appointment of Sub-Processors': [
        { value: 1, label: 'Supplier discretion', description: 'Supplier can appoint at discretion' },
        { value: 2, label: 'Notify only', description: 'Supplier notifies customer of appointments' },
        { value: 3, label: 'Object right', description: 'Customer can object within defined period' },
        { value: 4, label: 'Prior consent', description: 'Prior written consent required for each' }
    ],
    'Security Incidents': [
        { value: 1, label: '72 hours', description: 'Notification within 72 hours' },
        { value: 2, label: '48 hours', description: 'Notification within 48 hours' },
        { value: 3, label: '24 hours', description: 'Notification within 24 hours' },
        { value: 4, label: '12 hours', description: 'Notification within 12 hours of awareness' }
    ],
    'Audit Rights': [
        { value: 1, label: 'No audit', description: 'No audit rights' },
        { value: 2, label: 'Third party only', description: 'Third party audit reports only' },
        { value: 3, label: 'Annual on-site', description: 'On-site audit once per year with notice' },
        { value: 4, label: 'Unlimited audit', description: 'On-site audits at any time with reasonable notice' }
    ]
}

// Helper function to find position options for a clause
function getPositionOptionsForClause(clauseId: string, clauseName: string): PositionOption[] | null {
    // First: Direct match on clauseName (most reliable)
    if (CLAUSE_POSITION_OPTIONS[clauseName]) {
        return CLAUSE_POSITION_OPTIONS[clauseName]
    }

    // Second: Try normalized clauseName (lowercase, trimmed)
    const normalizedName = clauseName.trim()
    for (const [key, options] of Object.entries(CLAUSE_POSITION_OPTIONS)) {
        if (key.toLowerCase() === normalizedName.toLowerCase()) {
            return options
        }
    }

    // Third: Keyword matching for partial matches
    const nameWords = clauseName.toLowerCase()

    // Map keywords to lookup keys
    const keywordMap: Record<string, string> = {
        'payment': 'Time for Payment',
        'interest': 'Interest / Late Payment Sanctions',
        'late payment': 'Interest / Late Payment Sanctions',
        'pricing': 'Certainty of Pricing',
        'benchmarking': 'Benchmarking',
        'liability cap': 'Cap for Supplier',
        'supplier cap': 'Cap for Supplier',
        'customer cap': 'Cap for Customer',
        'termination for convenience': 'Termination for Convenience',
        'exit assistance': 'Exit Assistance',
        'step in': 'Step In Rights',
        'key personnel': 'Control of Key Personnel',
        'sub-processor': 'Appointment of Sub-Processors',
        'security incident': 'Security Incidents',
        'audit': 'Audit Rights',
        'scope of services': 'Scope of Services',
        'due diligence': 'Due Diligence',
        'at risk': 'At Risk Amount',
        'earn-back': 'Earn-back / Bonus',
        'earn back': 'Earn-back / Bonus'
    }

    for (const [keyword, lookupKey] of Object.entries(keywordMap)) {
        if (nameWords.includes(keyword)) {
            return CLAUSE_POSITION_OPTIONS[lookupKey] || null
        }
    }

    // No match found - will use numeric slider fallback
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
    // SECTION 10: POSITION ADJUSTMENT PANEL COMPONENT (WITH SCALE MAPPING)
    // ============================================================================

    // Helper function to map database position (1-10) to option value
    function mapDbPositionToOptionValue(
        dbPosition: number,
        optionCount: number
    ): number {
        // DB scale: 1-10
        // Option scale: 1-optionCount
        // Linear mapping: dbPosition 1 → option 1, dbPosition 10 → option optionCount
        const normalized = (dbPosition - 1) / 9  // 0 to 1
        const optionValue = normalized * (optionCount - 1) + 1
        return Math.round(optionValue)
    }

    // Helper function to map option value back to database position (1-10)
    function mapOptionValueToDbPosition(
        optionValue: number,
        optionCount: number
    ): number {
        // Option scale: 1-optionCount → DB scale: 1-10
        const normalized = (optionValue - 1) / (optionCount - 1)  // 0 to 1
        const dbPosition = normalized * 9 + 1
        return Math.round(dbPosition * 10) / 10  // Round to 1 decimal
    }

    const PositionAdjustmentPanel = () => {
        if (!selectedClause || !userInfo) return null

        const isCustomer = userInfo.role === 'customer'
        const myDbPosition = isCustomer ? selectedClause.customerPosition : selectedClause.providerPosition
        const otherDbPosition = isCustomer ? selectedClause.providerPosition : selectedClause.customerPosition
        const originalDbPosition = isCustomer ? selectedClause.originalCustomerPosition : selectedClause.originalProviderPosition
        const clarenceDbPosition = selectedClause.clarenceRecommendation
        const myWeight = isCustomer ? selectedClause.customerWeight : selectedClause.providerWeight

        const hasChanged = originalDbPosition !== null && myDbPosition !== originalDbPosition
        const hasPositionOptions = selectedClause.positionOptions && selectedClause.positionOptions.length > 0
        const optionCount = hasPositionOptions ? selectedClause.positionOptions!.length : 10

        // Map database positions to option values for display
        const myOptionValue = myDbPosition !== null
            ? mapDbPositionToOptionValue(myDbPosition, optionCount)
            : null
        const otherOptionValue = otherDbPosition !== null
            ? mapDbPositionToOptionValue(otherDbPosition, optionCount)
            : null
        const clarenceOptionValue = clarenceDbPosition !== null
            ? mapDbPositionToOptionValue(clarenceDbPosition, optionCount)
            : null
        const originalOptionValue = originalDbPosition !== null
            ? mapDbPositionToOptionValue(originalDbPosition, optionCount)
            : null

        // Track proposed position in OPTION value space (for UI)
        // But proposedPosition state is in DB scale (1-10) for consistency with handlers
        const proposedOptionValue = proposedPosition !== null && hasPositionOptions
            ? mapDbPositionToOptionValue(proposedPosition, optionCount)
            : null

        const isProposing = isAdjusting && proposedPosition !== myDbPosition

        // Handle option card click - convert option value to DB position
        const handleOptionSelect = (optionValue: number) => {
            const dbPosition = mapOptionValueToDbPosition(optionValue, optionCount)
            handlePositionDrag(dbPosition)
        }

        // Get label for a database position value
        const getPositionLabel = (dbPos: number | null): string => {
            if (dbPos === null) return 'Not set'
            if (!hasPositionOptions) return `Position ${dbPos.toFixed(1)}`
            const optVal = mapDbPositionToOptionValue(dbPos, optionCount)
            const option = selectedClause.positionOptions?.find(o => o.value === optVal)
            return option?.label || `Position ${optVal}`
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
                                Changed from {getPositionLabel(originalDbPosition)}
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
                        {/* Visual Position Bar */}
                        <div className="relative h-8 bg-gradient-to-r from-blue-100 via-slate-100 to-emerald-100 rounded-full border border-slate-200 mb-4">
                            {/* Position markers */}
                            {otherOptionValue !== null && (
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold z-10"
                                    style={{
                                        left: `${((otherOptionValue - 1) / (optionCount - 1)) * 100}%`,
                                        transform: 'translate(-50%, -50%)',
                                        backgroundColor: isCustomer ? '#3b82f6' : '#10b981',
                                        borderColor: isCustomer ? '#1d4ed8' : '#047857',
                                        color: 'white'
                                    }}
                                    title={`${isCustomer ? 'Provider' : 'Customer'}: ${getPositionLabel(otherDbPosition)}`}
                                >
                                    {isCustomer ? 'P' : 'C'}
                                </div>
                            )}
                            {clarenceOptionValue !== null && (
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-purple-500 border-2 border-purple-700 flex items-center justify-center text-xs font-bold text-white z-10"
                                    style={{
                                        left: `${((clarenceOptionValue - 1) / (optionCount - 1)) * 100}%`,
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                    title={`CLARENCE: ${getPositionLabel(clarenceDbPosition)}`}
                                >
                                    ★
                                </div>
                            )}
                            {myOptionValue !== null && (
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-3 flex items-center justify-center text-xs font-bold z-20"
                                    style={{
                                        left: `${((myOptionValue - 1) / (optionCount - 1)) * 100}%`,
                                        transform: 'translate(-50%, -50%)',
                                        backgroundColor: isCustomer ? '#10b981' : '#3b82f6',
                                        borderColor: isCustomer ? '#047857' : '#1d4ed8',
                                        color: 'white',
                                        borderWidth: '3px'
                                    }}
                                    title={`You: ${getPositionLabel(myDbPosition)}`}
                                >
                                    {isCustomer ? 'C' : 'P'}
                                </div>
                            )}
                            {proposedOptionValue !== null && proposedOptionValue !== myOptionValue && (
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-amber-500 border-2 border-amber-600 flex items-center justify-center text-xs font-bold text-white z-15 animate-pulse"
                                    style={{
                                        left: `${((proposedOptionValue - 1) / (optionCount - 1)) * 100}%`,
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                    title={`Proposed: ${getPositionLabel(proposedPosition)}`}
                                >
                                    ?
                                </div>
                            )}
                        </div>

                        {/* Option Cards */}
                        <div className="space-y-2">
                            {selectedClause.positionOptions!.map((option) => {
                                const isMyPosition = myOptionValue === option.value
                                const isOtherPosition = otherOptionValue === option.value
                                const isRecommended = clarenceOptionValue === option.value
                                const isProposedOption = proposedOptionValue === option.value && proposedOptionValue !== myOptionValue

                                return (
                                    <div
                                        key={option.value}
                                        onClick={() => {
                                            if (!isMyPosition) {
                                                handleOptionSelect(option.value)
                                            }
                                        }}
                                        className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${isProposedOption
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
                                                    {isOtherPosition && !isMyPosition && (
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
                                                    {isProposedOption && (
                                                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded animate-pulse">
                                                            ⟳ Proposed
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">{option.description}</p>
                                            </div>

                                            {/* Selection indicator */}
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isMyPosition
                                                ? `${isCustomer ? 'border-emerald-500 bg-emerald-500' : 'border-blue-500 bg-blue-500'}`
                                                : isProposedOption
                                                    ? 'border-amber-500 bg-amber-500'
                                                    : 'border-slate-300'
                                                }`}>
                                                {(isMyPosition || isProposedOption) && (
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

                        {/* Legend */}
                        <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-2 border-t border-slate-200">
                            <div className="flex items-center gap-1">
                                <div className={`w-4 h-4 rounded-full ${isCustomer ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                                <span>You</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className={`w-4 h-4 rounded-full ${isCustomer ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                                <span>{isCustomer ? 'Provider' : 'Customer'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 rounded-full bg-purple-500"></div>
                                <span>CLARENCE</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 rounded-full bg-amber-500"></div>
                                <span>Proposed</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Numeric Slider Fallback - for clauses without position options */
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    step="0.5"
                                    value={proposedPosition ?? myDbPosition ?? 5}
                                    onChange={(e) => handlePositionDrag(parseFloat(e.target.value))}
                                    className="w-full h-3 bg-gradient-to-r from-blue-200 via-slate-200 to-emerald-200 rounded-full appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between mt-1 px-1">
                                    <span className="text-xs text-blue-600">Provider</span>
                                    <span className="text-xs text-slate-400">Neutral</span>
                                    <span className="text-xs text-emerald-600">Customer</span>
                                </div>
                            </div>
                            <div className="w-20">
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    step="0.5"
                                    value={proposedPosition ?? myDbPosition ?? 5}
                                    onChange={(e) => handlePositionDrag(parseFloat(e.target.value))}
                                    className="w-full px-3 py-2 text-center text-lg font-bold border border-slate-300 rounded-lg"
                                />
                            </div>
                        </div>

                        {/* Position markers for slider view */}
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>Your Position: <strong>{myDbPosition?.toFixed(1) ?? 'Not set'}</strong></span>
                            <span>{isCustomer ? 'Provider' : 'Customer'}: <strong>{otherDbPosition?.toFixed(1) ?? 'Not set'}</strong></span>
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
                        {isCommitting ? (
                            <>
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Setting...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Set Position
                            </>
                        )}
                    </button>

                    {hasChanged && (
                        <button
                            onClick={() => setShowResetConfirm(true)}
                            disabled={isCommitting}
                            className="px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
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
                                This will restore your position on <strong>{selectedClause.clauseName}</strong> back to{' '}
                                <strong>{getPositionLabel(originalDbPosition)}</strong>.
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
                            {selectedClause.gapSize.toFixed(1)} points apart
                            {selectedClause.gapSize <= 1 && ' ✓ Nearly Aligned'}
                            {selectedClause.gapSize > 4 && ' ⚠ Significant Gap'}
                        </span>
                    </div>
                    {hasPositionOptions && (
                        <div className="text-xs text-slate-400 mt-1">
                            You: {getPositionLabel(myDbPosition)} → {isCustomer ? 'Provider' : 'Customer'}: {getPositionLabel(otherDbPosition)}
                        </div>
                    )}
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

                {/* Visual Leverage Bar */}
                <div className="relative">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-emerald-600 font-medium w-24">{session.customerCompany.split(' ')[0]}</span>
                        <div className="flex-1"></div>
                        <span className="text-xs text-blue-600 font-medium w-24 text-right">{session.providerCompany.split(' ')[0]}</span>
                    </div>

                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden relative">
                        {/* Leverage Score marker */}
                        <div
                            className="absolute top-0 bottom-0 w-1 bg-slate-800 z-10"
                            style={{ left: `${displayLeverage.leverageScoreCustomer}%`, transform: 'translateX(-50%)' }}
                        >
                            <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-xs text-slate-600 whitespace-nowrap">
                                ◆ {displayLeverage.leverageScoreCustomer}%
                            </div>
                        </div>

                        {/* Leverage Tracker fill */}
                        <div
                            className={`h-full transition-all duration-500 ${displayLeverage.leverageTrackerCustomer > displayLeverage.leverageScoreCustomer
                                ? 'bg-emerald-500'
                                : displayLeverage.leverageTrackerCustomer < displayLeverage.leverageScoreCustomer
                                    ? 'bg-amber-500'
                                    : 'bg-slate-400'
                                }`}
                            style={{ width: `${displayLeverage.leverageTrackerCustomer}%` }}
                        ></div>

                        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-300"></div>
                    </div>

                    <div className="flex items-center justify-center gap-6 mt-2 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-slate-800 transform rotate-45"></div>
                            <span>Leverage Score (baseline)</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-2 bg-emerald-500 rounded-sm"></div>
                            <span>Leverage Tracker (current)</span>
                        </div>
                    </div>
                </div>

                {showLeverageDetails && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="text-xs font-medium text-slate-600 mb-3">Leverage Score Breakdown</div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                <span className="text-xs text-slate-600">Market Dynamics</span>
                                <span className={`text-xs font-medium ${displayLeverage.marketDynamicsScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {displayLeverage.marketDynamicsScore >= 0 ? '+' : ''}{displayLeverage.marketDynamicsScore}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                <span className="text-xs text-slate-600">Economic Factors</span>
                                <span className={`text-xs font-medium ${displayLeverage.economicFactorsScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {displayLeverage.economicFactorsScore >= 0 ? '+' : ''}{displayLeverage.economicFactorsScore}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                <span className="text-xs text-slate-600">Strategic Position</span>
                                <span className={`text-xs font-medium ${displayLeverage.strategicPositionScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {displayLeverage.strategicPositionScore >= 0 ? '+' : ''}{displayLeverage.strategicPositionScore}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                <span className="text-xs text-slate-600">BATNA Strength</span>
                                <span className={`text-xs font-medium ${displayLeverage.batnaScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {displayLeverage.batnaScore >= 0 ? '+' : ''}{displayLeverage.batnaScore}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
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