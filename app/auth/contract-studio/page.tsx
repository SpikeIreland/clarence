'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { eventLogger } from '@/lib/eventLogger'
import { PartyChatPanel } from './components/party-chat-component'


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

interface NegotiationHistoryEntry {
    id: string
    timestamp: string
    eventType: 'position_change' | 'agreement' | 'comment' | 'tradeoff_accepted' | 'session_started'
    party: 'customer' | 'provider' | 'system'
    partyName: string
    clauseId?: string
    clauseName?: string
    description: string
    oldValue?: number | string
    newValue?: number | string
    leverageImpact?: number
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
        { value: 3, label: 'Customer - 150 days', description: 'Customer only with 150 days notice' },
        { value: 4, label: 'Customer - 120 days', description: 'Customer only with 120 days notice' },
        { value: 5, label: 'Customer - 90 days', description: 'Customer only with 90 days notice' },
        { value: 6, label: 'Customer - 60 days', description: 'Customer only with 60 days notice' },
        { value: 7, label: 'Customer - 30 days', description: 'Customer only with 30 days notice' },
        { value: 8, label: 'Customer - immediate', description: 'Customer can terminate with 0-6 months notice' }
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
        { value: 1, label: '100% annual', description: 'Aggregate cap at 100% of annual charges' },
        { value: 2, label: '125% annual', description: 'Aggregate cap at 125% of annual charges' },
        { value: 3, label: '150% annual', description: 'Aggregate cap at 150% of annual charges' },
        { value: 4, label: '175% annual', description: 'Aggregate cap at 175% of annual charges' },
        { value: 5, label: '200% annual', description: 'Aggregate cap at 200% of annual charges' },
        { value: 6, label: '250% annual', description: 'Aggregate cap at 250% of annual charges' }
    ],
    'Cap for Customer': [
        { value: 1, label: '100% annual', description: 'Customer liability at 100% of annual charges' },
        { value: 2, label: '150% annual', description: 'Customer liability at 150% of annual charges' },
        { value: 3, label: '200% annual', description: 'Customer liability at 200% of annual charges' },
        { value: 4, label: '250% annual', description: 'Customer liability at 250% of annual charges' }
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
    viewerRole: 'customer' | 'provider',
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
                viewerRole,
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

/**
 * Calculate leverage impact FROM THE MOVER'S PERSPECTIVE
 * Returns NEGATIVE if you're conceding (moving toward other party)
 * Returns POSITIVE if you're gaining (other party moved toward you, or you're standing firm)
 * 
 * This is used for the UI preview "This move will cost/gain you X%"
 */
function calculateLeverageImpact(
    oldPosition: number,
    newPosition: number,
    clauseWeight: number,
    party: 'customer' | 'provider',
    otherPartyPosition: number
): number {
    // Calculate movement
    const positionDelta = newPosition - oldPosition

    // No movement = no impact
    if (positionDelta === 0) return 0

    // Weight multiplier (weight 5 = 1x, weight 10 = 2x, weight 1 = 0.2x)
    const weightMultiplier = clauseWeight / 5

    // Scale factor for impact (each point on weight-5 clause = ~0.5% leverage)
    const scaleFactor = 0.5

    let leverageImpact = 0

    if (party === 'customer') {
        // Customer scale: 1 = provider-friendly, 10 = customer-friendly
        // Moving DOWN (toward provider) = ACCOMMODATING = GAINS leverage credits
        if (positionDelta < 0) {
            leverageImpact = Math.abs(positionDelta) * weightMultiplier * scaleFactor // POSITIVE
        }
        // Moving UP = demanding more = no leverage gained
    } else {
        // Provider scale: 1 = provider-friendly, 10 = customer-friendly
        // Moving UP (toward customer) = ACCOMMODATING = GAINS leverage credits
        if (positionDelta > 0) {
            leverageImpact = positionDelta * weightMultiplier * scaleFactor // POSITIVE
        }
        // Moving DOWN = demanding more = no leverage gained
    }

    return Math.round(leverageImpact * 10) / 10
}

/**
 * Recalculate the Leverage Tracker based on ALL position changes across ALL clauses
 * DEBUG VERSION - includes console logging
 */
function recalculateLeverageTracker(
    baseLeverageCustomer: number,
    baseLeverageProvider: number,
    clauses: ContractClause[],
    userRole: 'customer' | 'provider'
): { customerLeverage: number; providerLeverage: number } {

    console.log('=== LEVERAGE TRACKER RECALCULATION ===')
    console.log('Base leverage:', baseLeverageCustomer, ':', baseLeverageProvider)
    console.log('User role:', userRole)

    let customerCredits = 0
    let providerCredits = 0

    clauses.forEach(clause => {
        if (clause.clauseLevel === 0 || clause.customerPosition === null) return

        const originalCustomerPos = clause.originalCustomerPosition
        const currentCustomerPos = clause.customerPosition
        const originalProviderPos = clause.originalProviderPosition
        const currentProviderPos = clause.providerPosition

        // Customer movement
        if (originalCustomerPos !== null && currentCustomerPos !== null && originalCustomerPos !== currentCustomerPos) {
            const customerDelta = currentCustomerPos - originalCustomerPos
            const weight = clause.customerWeight ?? 5

            // Customer moving DOWN = accommodating = CUSTOMER earns credits
            if (customerDelta < 0) {
                const impact = Math.abs(customerDelta) * (weight / 5) * 0.5
                customerCredits += impact
                console.log(`${clause.clauseName}: Customer accommodated, +${impact.toFixed(2)} customer credits`)
            }
        }

        // Provider movement
        if (originalProviderPos !== null && currentProviderPos !== null && originalProviderPos !== currentProviderPos) {
            const providerDelta = currentProviderPos - originalProviderPos
            const weight = clause.providerWeight ?? 5

            // Provider moving UP = accommodating = PROVIDER earns credits
            if (providerDelta > 0) {
                const impact = providerDelta * (weight / 5) * 0.5
                providerCredits += impact  // ← FIXED: Provider gets their own credits
                console.log(`${clause.clauseName}: Provider accommodated, +${impact.toFixed(2)} provider credits`)
            }
        }
    })

    console.log('Customer credits earned:', customerCredits.toFixed(2))
    console.log('Provider credits earned:', providerCredits.toFixed(2))

    // Each party's tracker increases by THEIR OWN credits earned
    const newCustomerLeverage = Math.max(15, Math.min(85, Math.round(baseLeverageCustomer + customerCredits)))
    const newProviderLeverage = Math.max(15, Math.min(85, Math.round(baseLeverageProvider + providerCredits)))

    console.log('New customer tracker:', newCustomerLeverage)
    console.log('New provider tracker:', newProviderLeverage)
    console.log('=== END RECALCULATION ===')

    return {
        customerLeverage: newCustomerLeverage,
        providerLeverage: newProviderLeverage
    }
}

function calculateAlignmentPercentage(clauses: ContractClause[]): number {
    // Filter to only negotiable clauses (level 1, with positions)
    const negotiableClauses = clauses.filter(c =>
        c.clauseLevel === 1 &&
        c.customerPosition !== null &&
        c.providerPosition !== null
    )

    if (negotiableClauses.length === 0) return 0

    // Count aligned clauses (gap <= 1 point)
    const alignedCount = negotiableClauses.filter(c => {
        const gap = Math.abs((c.customerPosition ?? 0) - (c.providerPosition ?? 0))
        return gap <= 1
    }).length

    // Calculate percentage
    return Math.round((alignedCount / negotiableClauses.length) * 100)
}

/**
 * Helper to determine gap between positions
 */
function calculateGap(customerPos: number | null, providerPos: number | null): number {
    if (customerPos === null || providerPos === null) return 0
    return Math.abs(customerPos - providerPos)
}

/**
 * Helper to determine clause status based on gap
 */
function determineClauseStatus(gap: number): 'aligned' | 'negotiating' | 'disputed' | 'pending' {
    if (gap <= 1) return 'aligned'
    if (gap <= 3) return 'negotiating'
    if (gap > 4) return 'disputed'
    return 'pending'
}

// ============================================================================
// SECTION 4: HELPER FUNCTIONS
// ============================================================================

function buildClauseTree(clauses: ContractClause[]): ContractClause[] {
    const clauseMap = new Map<string, ContractClause>()
    const rootClauses: ContractClause[] = []

    // First pass: create map - default all categories to collapsed
    clauses.forEach(clause => {
        clauseMap.set(clause.positionId, { ...clause, children: [], isExpanded: false })
    })

    // Second pass: build tree structure
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

function formatHistoryTimestamp(timestamp: string): string {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`

    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    })
}

function getHistoryEventIcon(eventType: string): string {
    switch (eventType) {
        case 'position_change': return '↔'
        case 'agreement': return '✓'
        case 'comment': return '💬'
        case 'tradeoff_accepted': return '⇄'
        case 'session_started': return '🚀'
        default: return '•'
    }
}

function getHistoryEventColor(eventType: string, party: string): string {
    if (eventType === 'agreement') return 'border-emerald-400 bg-emerald-50'
    if (eventType === 'session_started') return 'border-slate-400 bg-slate-50'
    if (party === 'customer') return 'border-emerald-300 bg-white'
    if (party === 'provider') return 'border-blue-300 bg-white'
    return 'border-slate-300 bg-white'
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
// SECTION 5B: WORKING OVERLAY COMPONENT
// ============================================================================

type WorkingType =
    | 'initial_load'
    | 'welcome_message'
    | 'clause_loading'
    | 'position_commit'
    | 'chat_response'
    | 'provider_switch'
    | null

interface WorkingState {
    isWorking: boolean
    type: WorkingType
    message: string
    startedAt: number | null
    hasError: boolean
    errorMessage: string | null
}

const WORKING_MESSAGES: Record<NonNullable<WorkingType>, string> = {
    initial_load: 'Loading your negotiation session...',
    welcome_message: 'CLARENCE is preparing your briefing...',
    clause_loading: 'Analysing clause details...',
    position_commit: 'Recording your position...',
    chat_response: 'CLARENCE is thinking...',
    provider_switch: 'Switching provider view...'
}

const WORKING_TIMEOUT_MS = 30000 // 30 seconds

interface WorkingOverlayProps {
    workingState: WorkingState
    onRetry?: () => void
    onDismiss?: () => void
}

function WorkingOverlay({ workingState, onRetry, onDismiss }: WorkingOverlayProps) {
    const [elapsedTime, setElapsedTime] = useState(0)

    // Update elapsed time every second
    useEffect(() => {
        if (!workingState.isWorking || !workingState.startedAt) {
            setElapsedTime(0)
            return
        }

        const interval = setInterval(() => {
            setElapsedTime(Date.now() - workingState.startedAt!)
        }, 1000)

        return () => clearInterval(interval)
    }, [workingState.isWorking, workingState.startedAt])

    if (!workingState.isWorking && !workingState.hasError) return null

    const showSlowWarning = elapsedTime > 10000 && !workingState.hasError
    const formatElapsed = (ms: number) => Math.floor(ms / 1000)

    return (
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm mx-4 text-center">
                {/* Error State */}
                {workingState.hasError ? (
                    <>
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">
                            Something went wrong
                        </h3>
                        <p className="text-slate-600 mb-6 text-sm">
                            {workingState.errorMessage || 'The operation took too long to complete. Please try again.'}
                        </p>
                        <div className="flex gap-3 justify-center">
                            {onRetry && (
                                <button
                                    onClick={onRetry}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition"
                                >
                                    Try Again
                                </button>
                            )}
                            {onDismiss && (
                                <button
                                    onClick={onDismiss}
                                    className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition"
                                >
                                    Dismiss
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        {/* CLARENCE Avatar with pulse animation */}
                        <div className="relative mx-auto w-20 h-20 mb-6">
                            <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-25"></div>
                            <div className="relative w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold text-2xl">C</span>
                            </div>
                        </div>

                        {/* Status message */}
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">
                            CLARENCE
                        </h3>
                        <p className="text-slate-600 mb-4">
                            {workingState.message}
                        </p>

                        {/* Animated dots */}
                        <div className="flex justify-center gap-1.5 mb-4">
                            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>

                        {/* Elapsed time indicator (shows after 10s) */}
                        {showSlowWarning && (
                            <p className="text-xs text-slate-400">
                                Still working... ({formatElapsed(elapsedTime)}s)
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 5C: ENHANCED POSITION MARKER HELPERS
// ============================================================================

/**
 * Determines overlap states between position markers
 */
const getPositionOverlaps = (
    myValue: number | null,
    otherValue: number | null,
    clarenceValue: number | null
) => {
    const isCustomerProviderAligned = myValue !== null && otherValue !== null && myValue === otherValue
    const isMeAtClarence = myValue !== null && clarenceValue !== null && myValue === clarenceValue
    const isOtherAtClarence = otherValue !== null && clarenceValue !== null && otherValue === clarenceValue
    const isAllThreeAligned = isCustomerProviderAligned && isMeAtClarence

    return {
        isCustomerProviderAligned,
        isMeAtClarence,
        isOtherAtClarence,
        isAllThreeAligned
    }
}

/**
 * Combined marker component for overlapping positions
 */
interface CombinedMarkerProps {
    position: number
    optionCount: number
    parties: Array<'customer' | 'provider' | 'clarence'>
    isCustomer: boolean
    label: string
}

const CombinedPositionMarker = ({
    position,
    optionCount,
    parties,
    isCustomer,
    label
}: CombinedMarkerProps) => {
    const leftPercent = ((position - 1) / (optionCount - 1)) * 100

    // Determine marker style based on what's combined
    const hasCustomer = parties.includes('customer')
    const hasProvider = parties.includes('provider')
    const hasClarence = parties.includes('clarence')
    const isBothParties = hasCustomer && hasProvider

    // For aligned parties, show split circle
    if (isBothParties) {
        return (
            <div
                className="absolute top-1/2 -translate-y-1/2 z-30"
                style={{
                    left: `${leftPercent}%`,
                    transform: 'translate(-50%, -50%)'
                }}
            >
                {/* Aligned indicator badge */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full border border-emerald-300 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        ALIGNED
                    </span>
                </div>

                {/* Split circle marker - Customer left, Provider right */}
                <div
                    className="w-8 h-8 rounded-full overflow-hidden border-3 border-white shadow-lg flex"
                    style={{ borderWidth: '3px' }}
                    title={label}
                >
                    <div className="w-1/2 h-full bg-emerald-500"></div>
                    <div className="w-1/2 h-full bg-blue-500"></div>
                </div>

                {/* CLARENCE ring if also aligned */}
                {hasClarence && (
                    <div className="absolute inset-0 -m-1 rounded-full border-2 border-purple-500 animate-pulse"></div>
                )}

                {/* Labels below */}
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-slate-600 font-medium">
                    C+P{hasClarence ? '+★' : ''}
                </div>
            </div>
        )
    }

    return null
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
    const [negotiationHistory, setNegotiationHistory] = useState<NegotiationHistoryEntry[]>([])
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)
    const [historyFilter, setHistoryFilter] = useState<'all' | 'positions' | 'agreements'>('all')

    // Position adjustment state
    const [proposedPosition, setProposedPosition] = useState<number | null>(null)
    const [isAdjusting, setIsAdjusting] = useState(false)
    const [pendingLeverageImpact, setPendingLeverageImpact] = useState<number>(0)
    const [isCommitting, setIsCommitting] = useState(false)
    const [showResetConfirm, setShowResetConfirm] = useState(false)

    // Party Chat state
    const [isChatOpen, setIsChatOpen] = useState(false)
    const [chatUnreadCount, setChatUnreadCount] = useState(0)

    // CLARENCE AI state
    const [clarenceWelcomeLoaded, setClarenceWelcomeLoaded] = useState(false)
    const [lastExplainedClauseId, setLastExplainedClauseId] = useState<string | null>(null)

    // Trade-off state
    const [tradeOffOpportunities, setTradeOffOpportunities] = useState<TradeOffOpportunity[]>([])
    const [selectedTradeOff, setSelectedTradeOff] = useState<TradeOffOpportunity | null>(null)
    const [tradeOffExplanation, setTradeOffExplanation] = useState<string | null>(null)
    const [isLoadingTradeOff, setIsLoadingTradeOff] = useState(false)

    // Draft Tab State
    const [draftLanguage, setDraftLanguage] = useState<string | null>(null)
    const [isLoadingDraft, setIsLoadingDraft] = useState(false)
    // Draft style removed - CLARENCE always generates balanced language as "The Honest Broker"
    const [lastDraftedClauseId, setLastDraftedClauseId] = useState<string | null>(null)

    // Session status state
    const [sessionStatus, setSessionStatus] = useState<SessionStatus>('pending_provider')
    const [providerEmail, setProviderEmail] = useState('')
    const [inviteSending, setInviteSending] = useState(false)
    const [inviteSent, setInviteSent] = useState(false)

    // ============================================================================
    // SECTION 6E: MULTI-PROVIDER STATE
    // ============================================================================

    const [availableProviders, setAvailableProviders] = useState<ProviderBid[]>([])
    const [showProviderDropdown, setShowProviderDropdown] = useState(false)
    const [isLoadingProviders, setIsLoadingProviders] = useState(false)
    const providerDropdownRef = useRef<HTMLDivElement>(null)

    // Close provider dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (providerDropdownRef.current && !providerDropdownRef.current.contains(event.target as Node)) {
                setShowProviderDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const latestMessageRef = useRef<HTMLDivElement>(null)

    // ============================================================================
    // SECTION 6H: GLOBAL WORKING STATE MANAGEMENT
    // ============================================================================

    const [workingState, setWorkingState] = useState<WorkingState>({
        isWorking: true,
        type: 'initial_load',
        message: WORKING_MESSAGES.initial_load,
        startedAt: Date.now(),
        hasError: false,
        errorMessage: null
    })

    const workingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const lastWorkingTypeRef = useRef<WorkingType>(null)

    const startWorking = useCallback((type: NonNullable<WorkingType>) => {
        // Clear any existing timeout
        if (workingTimeoutRef.current) {
            clearTimeout(workingTimeoutRef.current)
        }

        lastWorkingTypeRef.current = type

        setWorkingState({
            isWorking: true,
            type,
            message: WORKING_MESSAGES[type],
            startedAt: Date.now(),
            hasError: false,
            errorMessage: null
        })

        // Set timeout for error state
        workingTimeoutRef.current = setTimeout(() => {
            setWorkingState(prev => ({
                ...prev,
                isWorking: false,
                hasError: true,
                errorMessage: `The operation timed out after 30 seconds. Please try again.`
            }))

            // Log the timeout error
            eventLogger.failed('contract_negotiation', 'working_timeout',
                `Operation ${type} timed out after 30 seconds`,
                'TIMEOUT_ERROR'
            )
        }, WORKING_TIMEOUT_MS)
    }, [])

    const stopWorking = useCallback(() => {
        // Clear timeout
        if (workingTimeoutRef.current) {
            clearTimeout(workingTimeoutRef.current)
            workingTimeoutRef.current = null
        }

        setWorkingState({
            isWorking: false,
            type: null,
            message: '',
            startedAt: null,
            hasError: false,
            errorMessage: null
        })
    }, [])

    const setWorkingError = useCallback((errorMessage: string) => {
        // Clear timeout
        if (workingTimeoutRef.current) {
            clearTimeout(workingTimeoutRef.current)
            workingTimeoutRef.current = null
        }

        setWorkingState(prev => ({
            ...prev,
            isWorking: false,
            hasError: true,
            errorMessage
        }))
    }, [])

    const dismissError = useCallback(() => {
        setWorkingState({
            isWorking: false,
            type: null,
            message: '',
            startedAt: null,
            hasError: false,
            errorMessage: null
        })
    }, [])

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (workingTimeoutRef.current) {
                clearTimeout(workingTimeoutRef.current)
            }
        }
    }, [])

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

    // ============================================================================
    // SECTION 7B: CLARENCE AI WELCOME MESSAGE LOADER
    // ============================================================================

    const loadClarenceWelcome = useCallback(async (sessionId: string, viewerRole: 'customer' | 'provider') => {
        if (clarenceWelcomeLoaded) {
            stopWorking()
            return
        }

        startWorking('welcome_message')
        setIsChatLoading(true)

        try {
            const response = await callClarenceAI(sessionId, 'welcome', viewerRole)

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
                stopWorking()
            } else {
                setWorkingError('CLARENCE could not prepare your briefing. Please refresh to try again.')
            }
        } catch (error) {
            console.error('Failed to load CLARENCE welcome:', error)
            setWorkingError('Failed to connect to CLARENCE. Please check your connection and refresh.')
        } finally {
            setIsChatLoading(false)
        }
    }, [clarenceWelcomeLoaded, startWorking, stopWorking, setWorkingError])

    // ============================================================================
    // SECTION 7C: CLARENCE AI CLAUSE EXPLAINER
    // ============================================================================

    const explainClauseWithClarence = useCallback(async (sessionId: string, clause: ContractClause, viewerRole: 'customer' | 'provider') => {
        if (lastExplainedClauseId === clause.clauseId) return

        startWorking('clause_loading')
        setIsChatLoading(true)
        setLastExplainedClauseId(clause.clauseId)

        try {
            const response = await callClarenceAI(sessionId, 'clause_explain', viewerRole, {
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
                stopWorking()
            } else {
                setWorkingError('CLARENCE could not analyse this clause. Please try selecting it again.')
            }
        } catch (error) {
            console.error('Failed to explain clause:', error)
            setWorkingError('Failed to connect to CLARENCE. Please try again.')
        } finally {
            setIsChatLoading(false)
        }
    }, [lastExplainedClauseId, startWorking, stopWorking, setWorkingError])

    // Initial load
    useEffect(() => {
        const init = async () => {
            // Working state is already set to 'initial_load' in useState default

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

                // LOG: Contract Studio loaded in pending provider state
                eventLogger.setSession(sessionId)
                eventLogger.setUser(user.userId || '')
                eventLogger.completed('contract_negotiation', 'contract_studio_loaded', {
                    sessionId: sessionId,
                    sessionNumber: sessionNumber || '',
                    userRole: user.role,
                    status: 'pending_provider'
                })

                setLoading(false)
                stopWorking() // Stop working overlay
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

                // LOG: Contract Studio loaded successfully
                eventLogger.setSession(sessionId)
                eventLogger.setUser(user.userId || '')
                eventLogger.completed('contract_negotiation', 'contract_studio_loaded', {
                    sessionId: sessionId,
                    sessionNumber: data.session.sessionNumber,
                    userRole: user.role,
                    clauseCount: data.clauses.length,
                    alignmentPercentage: data.leverage?.alignmentPercentage
                })
            } else {
                // Data load failed
                setWorkingError('Failed to load contract data. Please refresh the page.')
            }

            setLoading(false)
            // Don't stopWorking here - let the welcome message take over
        }

        init()
    }, [loadUserInfo, loadContractData, loadClauseChat, searchParams, router, stopWorking, setWorkingError])

    // Scroll to top when page loads
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' })
    }, [])

    useEffect(() => {
        if (session?.sessionId && sessionStatus === 'ready' && !clarenceWelcomeLoaded && !loading && userInfo?.role) {
            loadClarenceWelcome(session.sessionId, userInfo.role)
        }
    }, [session?.sessionId, sessionStatus, clarenceWelcomeLoaded, loading, loadClarenceWelcome, userInfo?.role])

    // ============================================================================
    // SECTION 7D2: LOAD AVAILABLE PROVIDERS FOR MULTI-PROVIDER DROPDOWN
    // ============================================================================

    const loadAvailableProviders = useCallback(async (sessionId: string, currentProviderCompany: string) => {
        setIsLoadingProviders(true)
        try {
            const response = await fetch(`${API_BASE}/provider-bids-api?session_id=${sessionId}`)
            if (response.ok) {
                const data = await response.json()
                const providers: ProviderBid[] = (data.bids || []).map((bid: ApiProviderBidResponse) => ({
                    bidId: bid.bid_id,
                    providerId: bid.provider_id,
                    providerCompany: bid.provider_company || 'Unknown Provider',
                    providerContactName: bid.provider_contact_name,
                    providerContactEmail: bid.provider_contact_email,
                    status: bid.status,
                    intakeComplete: bid.intake_complete || false,
                    questionnaireComplete: bid.questionnaire_complete || false,
                    invitedAt: bid.invited_at,
                    submittedAt: bid.submitted_at,
                    isCurrentProvider: bid.provider_company === currentProviderCompany
                }))
                setAvailableProviders(providers)
            }
        } catch (error) {
            console.error('Failed to load available providers:', error)
        } finally {
            setIsLoadingProviders(false)
        }
    }, [])

    // Load providers when session is available (for customers only)
    useEffect(() => {
        if (session?.sessionId && session?.providerCompany && userInfo?.role === 'customer') {
            loadAvailableProviders(session.sessionId, session.providerCompany)
        }
    }, [session?.sessionId, session?.providerCompany, userInfo?.role, loadAvailableProviders])

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

    // Generate negotiation history from clauses
    useEffect(() => {
        if (!clauses.length || !session) return

        const history: NegotiationHistoryEntry[] = []
        const viewerRole = userInfo?.role || 'customer'
        const isViewerCustomer = viewerRole === 'customer'

        // Add session start entry
        history.push({
            id: 'session-start',
            timestamp: new Date().toISOString(),
            eventType: 'session_started',
            party: 'system',
            partyName: 'CLARENCE',
            description: `Negotiation session opened between ${session.customerCompany} and ${session.providerCompany}`
        })

        // Check each clause for position changes
        clauses.forEach(clause => {
            if (clause.clauseLevel === 0) return // Skip category headers

            // Customer position change
            if (clause.customerPosition !== null &&
                clause.originalCustomerPosition !== null &&
                clause.customerPosition !== clause.originalCustomerPosition) {

                const delta = clause.customerPosition - clause.originalCustomerPosition
                // Customer moving DOWN = conceding to provider
                const isCustomerConceding = delta < 0

                // Calculate impact FROM VIEWER'S PERSPECTIVE
                // If viewer is customer: conceding = negative, other conceding = positive
                // If viewer is provider: customer conceding = positive (good for you)
                let viewerImpact = Math.abs(delta) * 0.5
                if (isViewerCustomer && isCustomerConceding) {
                    viewerImpact = -viewerImpact // You conceded
                } else if (!isViewerCustomer && !isCustomerConceding) {
                    viewerImpact = -viewerImpact // Customer pushed, bad for you
                }

                history.push({
                    id: `cust-${clause.clauseId}`,
                    timestamp: new Date().toISOString(),
                    eventType: 'position_change',
                    party: 'customer',
                    partyName: isViewerCustomer ? 'You' : session.customerCompany,
                    clauseId: clause.clauseId,
                    clauseName: clause.clauseName,
                    description: isViewerCustomer
                        ? `You adjusted position on ${clause.clauseName}`
                        : `${session.customerCompany} adjusted position on ${clause.clauseName}`,
                    oldValue: clause.originalCustomerPosition,
                    newValue: clause.customerPosition,
                    leverageImpact: viewerImpact
                })
            }

            // Provider position change
            if (clause.providerPosition !== null &&
                clause.originalProviderPosition !== null &&
                clause.providerPosition !== clause.originalProviderPosition) {

                const delta = clause.providerPosition - clause.originalProviderPosition
                // Provider moving UP = conceding to customer
                const isProviderConceding = delta > 0

                // Calculate impact FROM VIEWER'S PERSPECTIVE
                // If viewer is provider: conceding = negative, other conceding = positive
                // If viewer is customer: provider conceding = positive (good for you)
                let viewerImpact = Math.abs(delta) * 0.5
                if (!isViewerCustomer && isProviderConceding) {
                    viewerImpact = -viewerImpact // You conceded
                } else if (isViewerCustomer && !isProviderConceding) {
                    viewerImpact = -viewerImpact // Provider pushed, bad for you
                }

                history.push({
                    id: `prov-${clause.clauseId}`,
                    timestamp: new Date().toISOString(),
                    eventType: 'position_change',
                    party: 'provider',
                    partyName: isViewerCustomer ? session.providerCompany : 'You',
                    clauseId: clause.clauseId,
                    clauseName: clause.clauseName,
                    description: isViewerCustomer
                        ? `${session.providerCompany} adjusted position on ${clause.clauseName}`
                        : `You adjusted position on ${clause.clauseName}`,
                    oldValue: clause.originalProviderPosition,
                    newValue: clause.providerPosition,
                    leverageImpact: viewerImpact
                })
            }

            // Agreement reached
            if (clause.status === 'aligned' && clause.gapSize <= 1) {
                history.push({
                    id: `agree-${clause.clauseId}`,
                    timestamp: new Date().toISOString(),
                    eventType: 'agreement',
                    party: 'system',
                    partyName: 'CLARENCE',
                    clauseId: clause.clauseId,
                    clauseName: clause.clauseName,
                    description: `Agreement reached on ${clause.clauseName}`
                })
            }
        })

        // Sort by timestamp, newest first
        history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

        setNegotiationHistory(history)
    }, [clauses, session])


    // ============================================================================
    // SECTION 8: EVENT HANDLERS
    // ============================================================================

    const handlePositionDrag = (newPosition: number) => {
        if (!selectedClause || !userInfo || !leverage) return

        // Don't allow position changes while working
        if (workingState.isWorking) return

        setProposedPosition(newPosition)
        setIsAdjusting(true)

        const originalPosition = userInfo.role === 'customer'
            ? selectedClause.originalCustomerPosition
            : selectedClause.originalProviderPosition

        if (originalPosition !== null) {
            const weight = userInfo.role === 'customer'
                ? selectedClause.customerWeight
                : selectedClause.providerWeight

            const otherPosition = userInfo.role === 'customer'
                ? selectedClause.providerPosition ?? 5
                : selectedClause.customerPosition ?? 5

            const impact = calculateLeverageImpact(
                originalPosition,
                newPosition,
                weight,
                userInfo.role as 'customer' | 'provider',
                otherPosition
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

        // Start working overlay
        startWorking('position_commit')
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
                        const newGap = calculateGap(
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
                stopWorking()
            } else {
                setWorkingError('Failed to save your position. Please try again.')
            }
        } catch (error) {
            console.error('Error setting position:', error)
            setWorkingError('An error occurred while saving your position. Please try again.')
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

        // Start working overlay
        startWorking('position_commit')
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
                        const newGap = calculateGap(
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
                stopWorking()
            } else {
                setWorkingError('Failed to reset your position. Please try again.')
            }
        } catch (error) {
            console.error('Error resetting position:', error)
            setWorkingError('An error occurred while resetting your position. Please try again.')
        } finally {
            setIsCommitting(false)
        }
    }

    const handleClauseSelect = (clause: ContractClause) => {
        // Don't allow clause selection while working
        if (workingState.isWorking) return

        setSelectedClause(clause)
        setActiveTab('dynamics')

        if (session?.sessionId && sessionStatus === 'ready' && userInfo?.role) {
            explainClauseWithClarence(session.sessionId, clause, userInfo.role)
        }
    }

    const handleClauseToggle = (positionId: string) => {
        // Allow toggle even while working (just expanding/collapsing tree)
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

        // Don't allow sending while working
        if (workingState.isWorking) return

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

        // Start working overlay
        startWorking('chat_response')
        setIsChatLoading(true)

        try {
            const response = await callClarenceAI(session.sessionId, 'chat', userInfo.role || 'customer', {
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
                stopWorking()
            } else {
                // Add error message to chat but don't show error overlay
                const errorMessage: ClauseChatMessage = {
                    messageId: `error-${Date.now()}`,
                    sessionId: session.sessionId,
                    positionId: selectedClause?.positionId || null,
                    sender: 'clarence',
                    senderUserId: null,
                    message: 'I apologize, but I encountered an issue processing your request. Please try again.',
                    messageType: 'auto_response',
                    relatedPositionChange: false,
                    triggeredBy: 'error',
                    createdAt: new Date().toISOString()
                }
                setChatMessages(prev => [...prev, errorMessage])
                stopWorking()
            }
        } catch (error) {
            console.error('CLARENCE chat error:', error)
            // Add error message to chat
            const errorMessage: ClauseChatMessage = {
                messageId: `error-${Date.now()}`,
                sessionId: session.sessionId,
                positionId: selectedClause?.positionId || null,
                sender: 'clarence',
                senderUserId: null,
                message: 'I apologize, but I encountered a connection issue. Please try again in a moment.',
                messageType: 'auto_response',
                relatedPositionChange: false,
                triggeredBy: 'error',
                createdAt: new Date().toISOString()
            }
            setChatMessages(prev => [...prev, errorMessage])
            stopWorking()
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
    // SECTION 8E: TRADE-OFF HANDLERS
    // ============================================================================

    const explainTradeOff = useCallback(async (tradeOff: TradeOffOpportunity) => {
        if (!session?.sessionId) return

        // Don't allow while working
        if (workingState.isWorking) return

        setSelectedTradeOff(tradeOff)
        setIsLoadingTradeOff(true)
        setTradeOffExplanation(null)

        // Start working overlay
        startWorking('chat_response')

        try {
            const message = `Analyze this trade-off opportunity between "${tradeOff.clauseA.clauseName}" and "${tradeOff.clauseB.clauseName}". 
    
The customer values ${tradeOff.clauseA.clauseName} (weight: ${tradeOff.clauseA.customerWeight}) more than the provider (weight: ${tradeOff.clauseA.providerWeight}).
The provider values ${tradeOff.clauseB.clauseName} (weight: ${tradeOff.clauseB.providerWeight}) more than the customer (weight: ${tradeOff.clauseB.customerWeight}).

Current gaps: ${tradeOff.clauseA.clauseName} has ${tradeOff.clauseA.gapSize.toFixed(1)} points gap, ${tradeOff.clauseB.clauseName} has ${tradeOff.clauseB.gapSize.toFixed(1)} points gap.

Explain why this trade makes sense and what each party gains.`

            const response = await callClarenceAI(session.sessionId, 'chat', userInfo?.role || 'customer', { message })

            if (response?.success && response.response) {
                setTradeOffExplanation(response.response)
                stopWorking()
            } else {
                setTradeOffExplanation('Unable to analyze this trade-off at the moment. Please try again.')
                stopWorking()
            }
        } catch (error) {
            console.error('Trade-off explanation error:', error)
            setTradeOffExplanation('An error occurred while analyzing this trade-off.')
            stopWorking()
        } finally {
            setIsLoadingTradeOff(false)
        }
    }, [session?.sessionId, workingState.isWorking, startWorking, stopWorking])

    // ============================================================================
    // SECTION 8F: DRAFT LANGUAGE HANDLER
    // ============================================================================

    const generateDraftLanguage = useCallback(async (clause: ContractClause) => {
        if (!session?.sessionId) return

        // Don't allow while working
        if (workingState.isWorking) return

        setIsLoadingDraft(true)
        setLastDraftedClauseId(clause.clauseId)

        // Start working overlay
        startWorking('chat_response')

        try {
            const message = `Generate professional contract clause language for "${clause.clauseName}" that is balanced and fair to both parties.

Current positions:
- Customer position: ${clause.customerPosition}/10
- Provider position: ${clause.providerPosition}/10
- CLARENCE recommended position: ${clause.clarenceRecommendation ?? 'Not set'}/10
- Gap: ${clause.gapSize.toFixed(1)} points

Clause description: ${clause.description}

As "The Honest Broker", generate clear, legally-appropriate contract language that reflects a fair compromise between the parties' positions. Keep it concise but comprehensive.`

            const response = await callClarenceAI(session.sessionId, 'chat', userInfo?.role || 'customer', { message })

            if (response?.success && response.response) {
                setDraftLanguage(response.response)
                stopWorking()
            } else {
                setDraftLanguage('Unable to generate draft language at the moment. Please try again.')
                stopWorking()
            }
        } catch (error) {
            console.error('Draft generation error:', error)
            setDraftLanguage('An error occurred while generating the draft.')
            stopWorking()
        } finally {
            setIsLoadingDraft(false)
        }
    }, [session?.sessionId, userInfo?.role, workingState.isWorking, startWorking, stopWorking])

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
                            {(() => {
                                // Calculate overlap states
                                const overlaps = getPositionOverlaps(myOptionValue, otherOptionValue, clarenceOptionValue)

                                return (
                                    <>
                                        {/* CASE 1: Customer and Provider are ALIGNED */}
                                        {overlaps.isCustomerProviderAligned && myOptionValue !== null ? (
                                            <CombinedPositionMarker
                                                position={myOptionValue}
                                                optionCount={optionCount}
                                                parties={[
                                                    'customer',
                                                    'provider',
                                                    ...(overlaps.isMeAtClarence ? ['clarence' as const] : [])
                                                ]}
                                                isCustomer={isCustomer}
                                                label={`Aligned at ${getPositionLabel(myDbPosition)}${overlaps.isMeAtClarence ? ' (CLARENCE agrees)' : ''}`}
                                            />
                                        ) : (
                                            <>
                                                {/* CASE 2: Separate markers - Other Party */}
                                                {otherOptionValue !== null && (
                                                    <div
                                                        className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold z-10 transition-all ${overlaps.isOtherAtClarence ? 'ring-2 ring-purple-400 ring-offset-1' : ''
                                                            }`}
                                                        style={{
                                                            left: `${((otherOptionValue - 1) / (optionCount - 1)) * 100}%`,
                                                            transform: 'translate(-50%, -50%)',
                                                            backgroundColor: isCustomer ? '#3b82f6' : '#10b981',
                                                            borderColor: isCustomer ? '#1d4ed8' : '#047857',
                                                            color: 'white'
                                                        }}
                                                        title={`${isCustomer ? 'Provider' : 'Customer'}: ${getPositionLabel(otherDbPosition)}${overlaps.isOtherAtClarence ? ' (matches CLARENCE)' : ''}`}
                                                    >
                                                        {isCustomer ? 'P' : 'C'}
                                                        {overlaps.isOtherAtClarence && (
                                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full flex items-center justify-center">
                                                                <span className="text-[8px] text-white">★</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* CASE 3: CLARENCE marker (only if not overlapping with other markers) */}
                                                {clarenceOptionValue !== null && !overlaps.isMeAtClarence && !overlaps.isOtherAtClarence && (
                                                    <div
                                                        className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-purple-500 border-2 border-purple-700 flex items-center justify-center text-xs font-bold text-white z-10"
                                                        style={{
                                                            left: `${((clarenceOptionValue - 1) / (optionCount - 1)) * 100}%`,
                                                            transform: 'translate(-50%, -50%)'
                                                        }}
                                                        title={`CLARENCE suggests: ${getPositionLabel(clarenceDbPosition)}`}
                                                    >
                                                        ★
                                                    </div>
                                                )}

                                                {/* CASE 4: Your position marker */}
                                                {myOptionValue !== null && (
                                                    <div
                                                        className={`absolute top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold z-20 transition-all ${overlaps.isMeAtClarence ? 'ring-2 ring-purple-400 ring-offset-1' : ''
                                                            }`}
                                                        style={{
                                                            left: `${((myOptionValue - 1) / (optionCount - 1)) * 100}%`,
                                                            transform: 'translate(-50%, -50%)',
                                                            backgroundColor: isCustomer ? '#10b981' : '#3b82f6',
                                                            borderColor: isCustomer ? '#047857' : '#1d4ed8',
                                                            color: 'white',
                                                            borderWidth: '3px'
                                                        }}
                                                        title={`You: ${getPositionLabel(myDbPosition)}${overlaps.isMeAtClarence ? ' (matches CLARENCE)' : ''}`}
                                                    >
                                                        {isCustomer ? 'C' : 'P'}
                                                        {overlaps.isMeAtClarence && (
                                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full flex items-center justify-center">
                                                                <span className="text-[8px] text-white">★</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* Proposed position marker (always separate) */}
                                        {proposedOptionValue !== null && proposedOptionValue !== myOptionValue && (
                                            <div
                                                className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-amber-500 border-2 border-amber-600 flex items-center justify-center text-xs font-bold text-white z-25 animate-pulse"
                                                style={{
                                                    left: `${((proposedOptionValue - 1) / (optionCount - 1)) * 100}%`,
                                                    transform: 'translate(-50%, -50%)'
                                                }}
                                                title={`Proposed: ${getPositionLabel(proposedPosition)}`}
                                            >
                                                ?
                                            </div>
                                        )}
                                    </>
                                )
                            })()}
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
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 rounded-full overflow-hidden flex">
                                    <div className="w-1/2 h-full bg-emerald-500"></div>
                                    <div className="w-1/2 h-full bg-blue-500"></div>
                                </div>
                                <span>Aligned</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 rounded-full bg-slate-400 ring-2 ring-purple-400"></div>
                                <span>+ CLARENCE</span>
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
    // SECTION 11: LEVERAGE INDICATOR COMPONENT (ROLE-AWARE)
    // ============================================================================

    const LeverageIndicator = () => {
        // Determine viewer's perspective
        const isCustomer = userInfo?.role === 'customer'

        // Get leverage values from viewer's perspective
        const yourBaselineLeverage = isCustomer
            ? displayLeverage.leverageScoreCustomer
            : displayLeverage.leverageScoreProvider
        const theirBaselineLeverage = isCustomer
            ? displayLeverage.leverageScoreProvider
            : displayLeverage.leverageScoreCustomer
        const yourTrackerLeverage = isCustomer
            ? displayLeverage.leverageTrackerCustomer
            : displayLeverage.leverageTrackerProvider
        const theirTrackerLeverage = isCustomer
            ? displayLeverage.leverageTrackerProvider
            : displayLeverage.leverageTrackerCustomer

        // Calculate shift from YOUR perspective
        const yourShift = yourTrackerLeverage - yourBaselineLeverage
        const isYouGaining = yourShift > 0

        // Company names from your perspective
        const yourCompanyName = isCustomer
            ? session?.customerCompany?.split(' ')[0] || 'You'
            : session?.providerCompany?.split(' ')[0] || 'You'
        const theirCompanyName = isCustomer
            ? session?.providerCompany?.split(' ')[0] || 'Provider'
            : session?.customerCompany?.split(' ')[0] || 'Customer'

        // Calculate dynamic alignment percentage
        const dynamicAlignmentPercentage = calculateAlignmentPercentage(clauses)

        // Get actual leverage factor scores from the data
        const marketDynamicsScore = displayLeverage.marketDynamicsScore ?? 50
        const economicFactorsScore = displayLeverage.economicFactorsScore ?? 50
        const strategicPositionScore = displayLeverage.strategicPositionScore ?? 50
        const batnaScore = displayLeverage.batnaScore ?? 50

        return (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
                {/* Header Row */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-700">Leverage Metrics Underpinning Baseline Assessment</h3>
                        <button
                            onClick={() => {
                                // LOG: Leverage details toggled
                                if (typeof eventLogger !== 'undefined') {
                                    eventLogger.completed('contract_negotiation', 'leverage_details_toggled', {
                                        sessionId: session?.sessionId,
                                        expanded: !showLeverageDetails
                                    })
                                }
                                setShowLeverageDetails(!showLeverageDetails)
                            }}
                            className="text-xs text-slate-400 hover:text-slate-600"
                        >
                            {showLeverageDetails ? 'Hide Details' : 'Show Details'}
                        </button>
                    </div>

                    {/* Dynamic Alignment Badge */}
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${dynamicAlignmentPercentage >= 90
                        ? 'bg-emerald-100 text-emerald-700'
                        : dynamicAlignmentPercentage >= 70
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                        {dynamicAlignmentPercentage}% Aligned
                    </div>
                </div>

                {/* Two-Card Layout: Baseline and Tracker - FROM YOUR PERSPECTIVE */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* Card 1: Leverage Baseline */}
                    <div className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center gap-1 mb-1">
                            <span className="text-sm">◆</span>
                            <span className="text-xs text-slate-500">Leverage Baseline</span>
                        </div>
                        <div className="text-lg font-bold text-slate-800 text-center">
                            <span className={isCustomer ? 'text-emerald-600' : 'text-blue-600'}>{yourBaselineLeverage}</span>
                            <span className="text-slate-400 mx-1">:</span>
                            <span className={isCustomer ? 'text-blue-600' : 'text-emerald-600'}>{theirBaselineLeverage}</span>
                        </div>
                        <div className="text-xs text-slate-400 text-center">You : {theirCompanyName}</div>
                    </div>

                    {/* Card 2: Leverage Tracker */}
                    <div className={`rounded-lg p-3 ${Math.abs(yourShift) > 0
                        ? (isYouGaining ? 'bg-emerald-50' : 'bg-amber-50')
                        : 'bg-slate-50'
                        }`}>
                        <div className="flex items-center gap-1 mb-1">
                            <span className="text-sm">⬡</span>
                            <span className="text-xs text-slate-500">Leverage Tracker</span>
                        </div>
                        <div className="text-lg font-bold text-slate-800 text-center">
                            <span className={isCustomer ? 'text-emerald-600' : 'text-blue-600'}>{yourTrackerLeverage}</span>
                            <span className="text-slate-400 mx-1">:</span>
                            <span className={isCustomer ? 'text-blue-600' : 'text-emerald-600'}>{theirTrackerLeverage}</span>
                        </div>
                        <div className={`text-xs text-center ${Math.abs(yourShift) > 0
                            ? (isYouGaining ? 'text-emerald-600' : 'text-amber-600')
                            : 'text-slate-400'
                            }`}>
                            {Math.abs(yourShift) > 0
                                ? `${isYouGaining ? '↑' : '↓'} ${Math.abs(yourShift).toFixed(1)}% from baseline`
                                : 'Real-time score'
                            }
                        </div>
                    </div>
                </div>

                {/* Visual Leverage Bar - YOUR leverage on the left */}
                <div className="relative">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium w-24 ${isCustomer ? 'text-emerald-600' : 'text-blue-600'}`}>
                            You ({yourCompanyName})
                        </span>
                        <div className="flex-1"></div>
                        <span className={`text-xs font-medium w-24 text-right ${isCustomer ? 'text-blue-600' : 'text-emerald-600'}`}>
                            {theirCompanyName}
                        </span>
                    </div>

                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden relative">
                        {/* Baseline marker (Diamond) */}
                        <div
                            className="absolute top-0 bottom-0 w-1 bg-slate-800 z-10"
                            style={{
                                left: `${yourBaselineLeverage}%`,
                                transform: 'translateX(-50%)'
                            }}
                        >
                            <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-xs text-slate-600 whitespace-nowrap">
                                ◆ {yourBaselineLeverage}%
                            </div>
                        </div>

                        {/* Tracker fill - shows YOUR leverage */}
                        <div
                            className={`h-full transition-all duration-500 ${yourTrackerLeverage > yourBaselineLeverage
                                ? 'bg-emerald-500'
                                : yourTrackerLeverage < yourBaselineLeverage
                                    ? 'bg-amber-500'
                                    : 'bg-slate-300'
                                }`}
                            style={{ width: `${yourTrackerLeverage}%` }}
                        />

                        {/* Tracker marker (Hexagon) - only show if different from baseline */}
                        {Math.abs(yourShift) > 0.5 && (
                            <div
                                className="absolute top-0 bottom-0 w-0.5 bg-slate-600 z-20"
                                style={{
                                    left: `${yourTrackerLeverage}%`,
                                    transform: 'translateX(-50%)'
                                }}
                            >
                                <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs text-slate-500 whitespace-nowrap">
                                    ⬡ {yourTrackerLeverage}%
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-center gap-4 mt-6 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 bg-slate-800 rounded-sm"></span>
                            ◆ Baseline
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 bg-emerald-500 rounded-sm"></span>
                            ⬡ You gaining
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 bg-amber-500 rounded-sm"></span>
                            ⬡ You conceding
                        </span>
                    </div>
                </div>

                {/* Expandable 4-Factor Breakdown */}
                {showLeverageDetails && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <h4 className="text-xs font-semibold text-slate-600 mb-3">Leverage Factors (from Assessment)</h4>
                        <div className="grid grid-cols-2 gap-3">
                            {/* Market Dynamics */}
                            <div className="bg-slate-50 rounded-lg p-2">
                                <div className="text-xs text-slate-500 mb-1">Market Dynamics</div>
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm font-bold ${marketDynamicsScore >= 60 ? 'text-emerald-600' :
                                        marketDynamicsScore <= 40 ? 'text-red-600' : 'text-slate-700'
                                        }`}>
                                        {marketDynamicsScore}
                                    </span>
                                    <span className="text-xs text-slate-400">/ 100</span>
                                </div>
                                {displayLeverage.marketDynamicsRationale && (
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                        {displayLeverage.marketDynamicsRationale}
                                    </p>
                                )}
                            </div>

                            {/* Economic Factors */}
                            <div className="bg-slate-50 rounded-lg p-2">
                                <div className="text-xs text-slate-500 mb-1">Economic Factors</div>
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm font-bold ${economicFactorsScore >= 60 ? 'text-emerald-600' :
                                        economicFactorsScore <= 40 ? 'text-red-600' : 'text-slate-700'
                                        }`}>
                                        {economicFactorsScore}
                                    </span>
                                    <span className="text-xs text-slate-400">/ 100</span>
                                </div>
                                {displayLeverage.economicFactorsRationale && (
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                        {displayLeverage.economicFactorsRationale}
                                    </p>
                                )}
                            </div>

                            {/* Strategic Position */}
                            <div className="bg-slate-50 rounded-lg p-2">
                                <div className="text-xs text-slate-500 mb-1">Strategic Position</div>
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm font-bold ${strategicPositionScore >= 60 ? 'text-emerald-600' :
                                        strategicPositionScore <= 40 ? 'text-red-600' : 'text-slate-700'
                                        }`}>
                                        {strategicPositionScore}
                                    </span>
                                    <span className="text-xs text-slate-400">/ 100</span>
                                </div>
                                {displayLeverage.strategicPositionRationale && (
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                        {displayLeverage.strategicPositionRationale}
                                    </p>
                                )}
                            </div>

                            {/* BATNA */}
                            <div className="bg-slate-50 rounded-lg p-2">
                                <div className="text-xs text-slate-500 mb-1">BATNA Analysis</div>
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm font-bold ${batnaScore >= 60 ? 'text-emerald-600' :
                                        batnaScore <= 40 ? 'text-red-600' : 'text-slate-700'
                                        }`}>
                                        {batnaScore}
                                    </span>
                                    <span className="text-xs text-slate-400">/ 100</span>
                                </div>
                                {displayLeverage.batnaRationale && (
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                        {displayLeverage.batnaRationale}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Factor explanation - role-aware */}
                        <p className="text-xs text-slate-400 mt-3 text-center">
                            {isCustomer
                                ? 'Scores above 50 favor you • Scores below 50 favor the provider'
                                : 'Scores above 50 favor the customer • Scores below 50 favor you'
                            }
                        </p>
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
    // COMPLETE UPDATED SECTION 13: PartyStatusBanner
    // ============================================================================

    const PartyStatusBanner = () => {
        const isCustomer = userInfo.role === 'customer'
        const myCompany = isCustomer ? session.customerCompany : session.providerCompany
        const otherCompany = isCustomer ? session.providerCompany : session.customerCompany
        const myRole = isCustomer ? 'Customer' : 'Provider'
        const otherRole = isCustomer ? 'Provider' : 'Customer'

        const customerCompany = session.customerCompany
        const providerCompany = session.providerCompany

        return (
            <div className="bg-slate-800 text-white">
                {/* ============================================================ */}
                {/* ROW 1: Navigation Row */}
                {/* ============================================================ */}
                <div className="px-6 py-2 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                        {/* Left: Dashboard Button */}
                        <button
                            onClick={() => router.push('/auth/contracts-dashboard')}
                            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition cursor-pointer"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            <span className="text-sm">Dashboard</span>
                        </button>

                        {/* Center: Title */}
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">C</span>
                            </div>
                            <div>
                                <span className="font-semibold text-white tracking-wide">CLARENCE</span>
                                <span className="text-slate-400 text-sm ml-2">Contract Studio</span>
                            </div>
                        </div>

                        {/* Right: User Info / Logged in status */}
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                            <span className="text-sm text-slate-300">
                                {userInfo.firstName ? `${userInfo.firstName} ${userInfo.lastName}` : myCompany}
                            </span>
                            <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">
                                {myRole}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ============================================================ */}
                {/* ROW 2: Session Context Row */}
                {/* ============================================================ */}
                <div className="px-6 py-3">
                    <div className="flex items-center justify-between">
                        {/* Left: Customer Info (always on left) */}
                        <div className="flex items-center gap-3 min-w-[200px]">
                            <div className={`w-3 h-3 rounded-full ${isCustomer ? 'bg-emerald-400 animate-pulse' : (otherPartyStatus.isOnline ? 'bg-emerald-400' : 'bg-slate-500')}`}></div>
                            <div>
                                <div className="text-xs text-slate-400">Customer</div>
                                <div className="text-sm font-medium text-emerald-400">{customerCompany}</div>
                            </div>
                            {isCustomer && (
                                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                                    You
                                </span>
                            )}
                        </div>

                        {/* Center: Session Details (truly centered) */}
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

                        {/* Right: Provider Info (always on right) + Party Chat */}
                        <div className="flex items-center gap-3 min-w-[280px] justify-end">
                            {!isCustomer && (
                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                                    You
                                </span>
                            )}
                            <div className="text-right">
                                <div className="text-xs text-slate-400">Provider</div>
                                <div className="text-sm font-medium text-blue-400">{providerCompany}</div>
                            </div>
                            <div className={`w-3 h-3 rounded-full ${!isCustomer ? 'bg-emerald-400 animate-pulse' : (otherPartyStatus.isOnline ? 'bg-emerald-400' : 'bg-slate-500')}`}></div>

                            {/* Party Chat Toggle Button - Available to BOTH parties */}
                            <button
                                onClick={() => setIsChatOpen(true)}
                                className="relative ml-2 p-2 hover:bg-slate-700 rounded-lg transition group"
                                title={isCustomer ? `Chat with ${providerCompany}` : `Chat with ${customerCompany}`}
                            >
                                <svg
                                    className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                    />
                                </svg>

                                {/* Unread Badge */}
                                {chatUnreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                                        {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Party Chat Slide-Out Panel - Available to BOTH parties */}
                <PartyChatPanel
                    sessionId={session.sessionId}
                    providerId=""
                    providerName={isCustomer ? providerCompany : customerCompany}
                    currentUserType={isCustomer ? 'customer' : 'provider'}
                    currentUserName={userInfo.firstName || 'User'}
                    isProviderOnline={otherPartyStatus.isOnline}
                    isOpen={isChatOpen}
                    onClose={() => setIsChatOpen(false)}
                    onUnreadCountChange={setChatUnreadCount}
                />
            </div>
        )
    }

    // ============================================================================
    // SECTION 14: MAIN LAYOUT RENDER
    // ============================================================================

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <PartyStatusBanner />

            <div className="relative flex h-[calc(100vh-52px)] overflow-hidden">
                {/* Working Overlay - covers the three-panel workspace */}
                <WorkingOverlay
                    workingState={workingState}
                    onRetry={() => {
                        dismissError()
                        // Optionally trigger a refresh based on what failed
                        if (lastWorkingTypeRef.current === 'initial_load') {
                            window.location.reload()
                        }
                    }}
                    onDismiss={dismissError}
                />
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

                        {/* ==================== DYNAMICS TAB ==================== */}
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

                        {/* ==================== TRADEOFFS TAB ==================== */}
                        {activeTab === 'tradeoffs' && selectedClause && (
                            <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6">
                                <div className="space-y-4">
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-800">Trade-Off Opportunities</h3>
                                            <p className="text-sm text-slate-500">
                                                Exchange concessions on low-priority clauses for gains on high-priority ones
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const opportunities = detectTradeOffOpportunities(clauses, selectedClause)
                                                setTradeOffOpportunities(opportunities)
                                            }}
                                            className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                                        >
                                            Refresh
                                        </button>
                                    </div>

                                    {/* Trade-off List */}
                                    {tradeOffOpportunities.length === 0 ? (
                                        <div className="text-center py-8">
                                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <span className="text-2xl">⇄</span>
                                            </div>
                                            <p className="text-slate-600 mb-2">No trade-off opportunities detected</p>
                                            <p className="text-sm text-slate-400">
                                                Trade-offs appear when parties have complementary priorities on different clauses
                                            </p>
                                            <button
                                                onClick={() => {
                                                    const opportunities = detectTradeOffOpportunities(clauses, null)
                                                    setTradeOffOpportunities(opportunities)
                                                }}
                                                className="mt-4 px-4 py-2 text-sm bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition"
                                            >
                                                Scan All Clauses
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {tradeOffOpportunities.map((tradeOff, index) => (
                                                <div
                                                    key={tradeOff.id}
                                                    className={`border rounded-lg p-4 cursor-pointer transition ${selectedTradeOff?.id === tradeOff.id
                                                        ? 'border-emerald-400 bg-emerald-50'
                                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                                        }`}
                                                    onClick={() => explainTradeOff(tradeOff)}
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                                                                    Trade #{index + 1}
                                                                </span>
                                                                <span className="text-xs text-slate-500">
                                                                    Value: {tradeOff.tradeOffValue.toFixed(1)}
                                                                </span>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-4 mt-3">
                                                                {/* Give Side */}
                                                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                                                    <div className="text-xs text-red-600 font-medium mb-1">You Concede</div>
                                                                    <div className="text-sm font-medium text-slate-800">
                                                                        {tradeOff.clauseA.clauseName}
                                                                    </div>
                                                                    <div className="text-xs text-slate-500 mt-1">
                                                                        Gap: {tradeOff.clauseA.gapSize.toFixed(1)} points
                                                                    </div>
                                                                </div>

                                                                {/* Get Side */}
                                                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                                                                    <div className="text-xs text-emerald-600 font-medium mb-1">You Gain</div>
                                                                    <div className="text-sm font-medium text-slate-800">
                                                                        {tradeOff.clauseB.clauseName}
                                                                    </div>
                                                                    <div className="text-xs text-slate-500 mt-1">
                                                                        Gap: {tradeOff.clauseB.gapSize.toFixed(1)} points
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="ml-3 text-right">
                                                            <div className="text-xs text-slate-500">Alignment Impact</div>
                                                            <div className="text-lg font-bold text-emerald-600">
                                                                +{tradeOff.alignmentImpact}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Trade-off Explanation Panel */}
                                    {selectedTradeOff && (
                                        <div className="mt-4 border-t border-slate-200 pt-4">
                                            <h4 className="text-sm font-semibold text-slate-700 mb-2">
                                                CLARENCE Analysis
                                            </h4>
                                            {isLoadingTradeOff ? (
                                                <div className="flex items-center gap-2 text-slate-500">
                                                    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-sm">Analyzing trade-off...</span>
                                                </div>
                                            ) : tradeOffExplanation ? (
                                                <div className="bg-slate-50 rounded-lg p-4">
                                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{tradeOffExplanation}</p>
                                                    <div className="flex gap-2 mt-4">
                                                        <button
                                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition"
                                                            onClick={() => {
                                                                // TODO: Implement accept trade-off
                                                                alert('Accept trade-off functionality coming soon')
                                                            }}
                                                        >
                                                            Accept Trade-Off
                                                        </button>
                                                        <button
                                                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg transition"
                                                            onClick={() => {
                                                                setSelectedTradeOff(null)
                                                                setTradeOffExplanation(null)
                                                            }}
                                                        >
                                                            Dismiss
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ==================== HISTORY TAB ==================== */}
                        {activeTab === 'history' && selectedClause && (
                            <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6">
                                <div className="space-y-4">
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-800">Negotiation History</h3>
                                            <p className="text-sm text-slate-500">
                                                Track all position changes and agreements
                                            </p>
                                        </div>
                                        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                                            {(['all', 'positions', 'agreements'] as const).map(filter => (
                                                <button
                                                    key={filter}
                                                    onClick={() => setHistoryFilter(filter)}
                                                    className={`px-3 py-1 text-xs rounded-md transition capitalize ${historyFilter === filter
                                                        ? 'bg-white text-slate-800 shadow-sm'
                                                        : 'text-slate-600 hover:text-slate-800'
                                                        }`}
                                                >
                                                    {filter}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Timeline */}
                                    <div className="relative">
                                        {/* Vertical line */}
                                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>

                                        {/* History entries */}
                                        <div className="space-y-4">
                                            {negotiationHistory
                                                .filter(entry => {
                                                    if (historyFilter === 'all') return true
                                                    if (historyFilter === 'positions') return entry.eventType === 'position_change'
                                                    if (historyFilter === 'agreements') return entry.eventType === 'agreement'
                                                    return true
                                                })
                                                .slice(0, 20)
                                                .map((entry) => (
                                                    <div key={entry.id} className="relative pl-10">
                                                        {/* Timeline dot */}
                                                        <div className={`absolute left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${entry.eventType === 'agreement'
                                                            ? 'border-emerald-400 bg-emerald-100 text-emerald-600'
                                                            : entry.party === 'customer'
                                                                ? 'border-emerald-400 bg-white text-emerald-600'
                                                                : entry.party === 'provider'
                                                                    ? 'border-blue-400 bg-white text-blue-600'
                                                                    : 'border-slate-400 bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {entry.eventType === 'position_change' ? '↔' :
                                                                entry.eventType === 'agreement' ? '✓' :
                                                                    entry.eventType === 'session_started' ? '🚀' : '•'}
                                                        </div>

                                                        {/* Entry content */}
                                                        <div className={`border rounded-lg p-3 ${entry.eventType === 'agreement' ? 'border-emerald-400 bg-emerald-50' :
                                                            entry.eventType === 'session_started' ? 'border-slate-400 bg-slate-50' :
                                                                entry.party === 'customer' ? 'border-emerald-300 bg-white' :
                                                                    entry.party === 'provider' ? 'border-blue-300 bg-white' :
                                                                        'border-slate-300 bg-white'
                                                            }`}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className={`text-xs font-medium ${entry.party === 'customer' ? 'text-emerald-600' :
                                                                    entry.party === 'provider' ? 'text-blue-600' :
                                                                        'text-slate-600'
                                                                    }`}>
                                                                    {entry.partyName}
                                                                </span>
                                                                <span className="text-xs text-slate-400">
                                                                    {formatHistoryTimestamp(entry.timestamp)}
                                                                </span>
                                                            </div>

                                                            <p className="text-sm text-slate-700">{entry.description}</p>

                                                            {entry.oldValue !== undefined && entry.newValue !== undefined && (
                                                                <div className="flex items-center gap-2 mt-2 text-xs">
                                                                    <span className="text-slate-500">Position:</span>
                                                                    <span className="text-red-500 line-through">{entry.oldValue}</span>
                                                                    <span className="text-slate-400">→</span>
                                                                    <span className="text-emerald-600 font-medium">{entry.newValue}</span>
                                                                    {entry.leverageImpact !== undefined && entry.leverageImpact !== 0 && (
                                                                        <span className={`ml-2 px-1.5 py-0.5 rounded ${entry.leverageImpact > 0
                                                                            ? 'bg-emerald-100 text-emerald-700'
                                                                            : 'bg-amber-100 text-amber-700'
                                                                            }`}>
                                                                            {entry.leverageImpact > 0 ? '+' : ''}{entry.leverageImpact.toFixed(1)}% for you
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {entry.clauseName && entry.eventType !== 'position_change' && (
                                                                <div className="mt-1">
                                                                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                                                                        {entry.clauseName}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}

                                            {negotiationHistory.length === 0 && (
                                                <div className="text-center py-8 pl-10">
                                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                        <span className="text-2xl">📋</span>
                                                    </div>
                                                    <p className="text-slate-600">No negotiation activity yet</p>
                                                    <p className="text-sm text-slate-400 mt-1">
                                                        History will appear as positions are adjusted
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ==================== DRAFT TAB ==================== */}
                        {activeTab === 'draft' && selectedClause && (
                            <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6">
                                <div className="mb-6">
                                    {/* Header */}
                                    <div className="mb-4">
                                        <h3 className="text-lg font-semibold text-slate-800">Draft Contract Language</h3>
                                        <p className="text-sm text-slate-500">
                                            Generate professional clause language based on agreed positions
                                        </p>
                                    </div>

                                    {/* Clause Context */}
                                    <div className="bg-slate-50 rounded-lg p-4 mb-4">
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                            <div>
                                                <div className="text-xs text-slate-500 mb-1">Customer Position</div>
                                                <div className="text-lg font-bold text-emerald-600">
                                                    {selectedClause.customerPosition ?? '-'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-500 mb-1">CLARENCE Suggests</div>
                                                <div className="text-lg font-bold text-purple-600">
                                                    {selectedClause.clarenceRecommendation ?? '-'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-500 mb-1">Provider Position</div>
                                                <div className="text-lg font-bold text-blue-600">
                                                    {selectedClause.providerPosition ?? '-'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-center mt-3 pt-3 border-t border-slate-200">
                                            <span className={`text-sm font-medium ${selectedClause.gapSize <= 1 ? 'text-emerald-600' :
                                                selectedClause.gapSize <= 3 ? 'text-amber-600' :
                                                    'text-red-600'
                                                }`}>
                                                Gap: {selectedClause.gapSize.toFixed(1)} points
                                            </span>
                                        </div>
                                    </div>

                                    {/* Generate Button */}
                                    <button
                                        onClick={() => generateDraftLanguage(selectedClause)}
                                        disabled={isLoadingDraft}
                                        className={`w-full py-3 rounded-lg font-medium transition ${isLoadingDraft
                                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                            }`}
                                    >
                                        {isLoadingDraft ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Generating Draft...
                                            </span>
                                        ) : lastDraftedClauseId === selectedClause.clauseId && draftLanguage ? (
                                            'Regenerate Draft'
                                        ) : (
                                            '⚖️ Generate Balanced Draft'
                                        )}
                                    </button>
                                </div>

                                {/* Draft Output */}
                                {draftLanguage && lastDraftedClauseId === selectedClause.clauseId && (
                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                                            <span className="text-sm font-medium text-slate-700">
                                                ⚖️ Balanced Draft Language
                                            </span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(draftLanguage)
                                                        alert('Draft copied to clipboard')
                                                    }}
                                                    className="px-3 py-1 text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded transition"
                                                >
                                                    📋 Copy
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-white">
                                            <div
                                                className="prose prose-sm max-w-none text-slate-700"
                                                style={{ fontFamily: 'Georgia, serif', lineHeight: '1.7' }}
                                            >
                                                <p className="whitespace-pre-wrap">{draftLanguage}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* No draft yet */}
                                {(!draftLanguage || lastDraftedClauseId !== selectedClause.clauseId) && !isLoadingDraft && (
                                    <div className="text-center py-6 text-slate-500">
                                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <span className="text-2xl">📄</span>
                                        </div>
                                        <p>Click &quot;Generate Balanced Draft&quot; to create contract text</p>
                                        <p className="text-sm text-slate-400 mt-1">
                                            CLARENCE will draft fair, balanced language reflecting a compromise position
                                        </p>
                                    </div>
                                )}

                                {/* Warning for high gap */}
                                {selectedClause.gapSize > 3 && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                                        <div className="flex items-start gap-2">
                                            <span className="text-amber-500">⚠️</span>
                                            <div>
                                                <p className="text-sm font-medium text-amber-800">Positions Not Yet Aligned</p>
                                                <p className="text-xs text-amber-600 mt-1">
                                                    There&apos;s a significant gap ({selectedClause.gapSize.toFixed(1)} points) between parties.
                                                    Consider negotiating positions closer before finalising draft language.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ==================== NO CLAUSE SELECTED ==================== */}
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