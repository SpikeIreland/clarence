'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { eventLogger } from '@/lib/eventLogger'
import { createClient } from '@/lib/supabase'
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
    customerContactName: string | null
    providerContactName: string | null
    serviceType: string
    dealValue: string
    phase: number
    status: string
    createdAt?: string  // ADD THIS IF MISSING
}

interface NegotiationHistoryEntry {
    id: string
    timestamp: string
    eventType: 'position_change' | 'agreement' | 'comment' | 'tradeoff_accepted' | 'session_started'
    party: 'customer' | 'provider' | 'system'
    partyName: string
    clauseId?: string
    clauseName?: string
    clauseNumber?: string      // ADD THIS
    description: string
    oldValue?: number | string
    newValue?: number | string
    leverageImpact?: number
    seen?: boolean             // ADD THIS
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
    originalCustomerPosition: string | null
    originalProviderPosition: string | null
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
    // ========== SERVICE ==========
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

    // ========== TERM AND TERMINATION ==========
    'Term': [
        { value: 1, label: 'Initial term only', description: 'Fixed initial term with no automatic renewal rights' },
        { value: 2, label: 'Term with renewal option', description: 'Initial term with optional renewal periods by mutual agreement' },
        { value: 3, label: 'Auto-renewal', description: 'Automatic renewal unless either party provides termination notice' },
        { value: 4, label: 'Evergreen', description: 'Continuous contract with no fixed end date, terminable on notice' }
    ],
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
        { value: 1, label: '30 days', description: '30 days from invoice' },
        { value: 2, label: '45 days', description: '45 days from invoice' },
        { value: 3, label: '60 days', description: '60 days from invoice' },
        { value: 4, label: '90 days', description: '90 days from invoice' }
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
    leverageImpact: number,
    userContext?: {
        userId?: string;
        userName?: string;
        companyName?: string;
    }
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
                leverageImpact,
                userId: userContext?.userId || null,
                userName: userContext?.userName || null,
                companyName: userContext?.companyName || null
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
 * Calculate leverage impact for a position move
 */
function calculateLeverageImpact(
    oldPosition: number,
    newPosition: number,
    clauseWeight: number,
    party: 'customer' | 'provider'
): number {
    const positionDelta = newPosition - oldPosition

    if (positionDelta === 0) return 0

    // Weight multiplier: weight 5 = 1x, weight 3 = 0.6x, weight 2 = 0.4x
    const weightMultiplier = clauseWeight / 5

    // Scale factor: 1 position point on weight-5 clause = 1% leverage
    const scaleFactor = 1.0

    // Calculate raw impact magnitude
    const impactMagnitude = Math.abs(positionDelta) * weightMultiplier * scaleFactor

    // Determine direction based on who moved and which way
    // Customer scale: 1 = provider-friendly, 10 = customer-friendly
    // Provider scale: 1 = provider-friendly, 10 = customer-friendly

    if (party === 'customer') {
        // Customer moving DOWN (negative delta) = accommodating provider = CUSTOMER LOSES
        // Return negative value to show loss
        if (positionDelta < 0) {
            return -Math.round(impactMagnitude * 10) / 10
        }
        // Customer moving UP = demanding more = no leverage change (can't gain by demanding)
        return 0
    } else {
        // Provider moving UP (positive delta) = accommodating customer = PROVIDER LOSES
        // Return negative value to show loss
        if (positionDelta > 0) {
            return -Math.round(impactMagnitude * 10) / 10
        }
        // Provider moving DOWN = demanding more = no leverage change
        return 0
    }
}

/**
 * Recalculate the Leverage Tracker based on ALL position changes
 */
function recalculateLeverageTracker(
    baseLeverageCustomer: number,
    baseLeverageProvider: number,
    clauses: ContractClause[],
    userRole: 'customer' | 'provider'
): { customerLeverage: number; providerLeverage: number } {

    console.log('=== LEVERAGE TRACKER RECALCULATION ===')
    console.log('Base leverage:', baseLeverageCustomer, ':', baseLeverageProvider)

    let customerLeverageShift = 0  // Positive = customer gaining, Negative = customer losing

    clauses.forEach(clause => {
        // Skip parent categories
        if (clause.clauseLevel === 0) return
        if (clause.customerPosition === null || clause.providerPosition === null) return

        // Check customer movement
        const origCustPos = clause.originalCustomerPosition
        const currCustPos = clause.customerPosition

        if (origCustPos !== null && currCustPos !== null && origCustPos !== currCustPos) {
            const custDelta = currCustPos - origCustPos
            const weight = clause.customerWeight ?? 3

            // Customer moving DOWN = accommodating = PROVIDER GAINS (customer loses)
            if (custDelta < 0) {
                const impact = Math.abs(custDelta) * (weight / 5) * 1.0
                customerLeverageShift -= impact  // Customer LOSES
                console.log(`${clause.clauseName}: Customer accommodated (${origCustPos.toFixed(1)}→${currCustPos.toFixed(1)}), Provider gains +${impact.toFixed(2)} (weight ${weight})`)
            }
        }

        // Check provider movement
        const origProvPos = clause.originalProviderPosition
        const currProvPos = clause.providerPosition

        if (origProvPos !== null && currProvPos !== null && origProvPos !== currProvPos) {
            const provDelta = currProvPos - origProvPos
            const weight = clause.providerWeight ?? 3

            // Provider moving UP = accommodating = CUSTOMER GAINS (provider loses)
            if (provDelta > 0) {
                const impact = provDelta * (weight / 5) * 1.0
                customerLeverageShift += impact  // Customer GAINS
                console.log(`${clause.clauseName}: Provider accommodated (${origProvPos.toFixed(1)}→${currProvPos.toFixed(1)}), Customer gains +${impact.toFixed(2)} (weight ${weight})`)
            }
        }
    })

    console.log('Net customer leverage shift:', customerLeverageShift.toFixed(2))

    // Apply shift to base (bounded 20-80 to prevent runaway)
    const newCustomerLeverage = Math.max(20, Math.min(80, baseLeverageCustomer + customerLeverageShift))
    const newProviderLeverage = 100 - newCustomerLeverage

    console.log('Final leverage:', Math.round(newCustomerLeverage), ':', Math.round(newProviderLeverage))
    console.log('=== END RECALCULATION ===')

    return {
        customerLeverage: Math.round(newCustomerLeverage),
        providerLeverage: Math.round(newProviderLeverage)
    }
}

/**
 * Calculate gap size
 */
function calculateGapSize(customerPosition: number | null, providerPosition: number | null): number {
    if (customerPosition === null || providerPosition === null) return 0
    return Math.abs(customerPosition - providerPosition)
}

/**
 * Determine clause status based on gap size
 */
function determineClauseStatus(gapSize: number): 'aligned' | 'negotiating' | 'disputed' | 'pending' {
    if (gapSize <= 1) return 'aligned'
    if (gapSize <= 4) return 'negotiating'
    return 'disputed'
}

/**
 * Calculate alignment percentage across all clauses
 */
function calculateAlignmentPercentage(clauses: ContractClause[]): number {
    const childClauses = clauses.filter(c => c.clauseLevel === 1 && c.customerPosition !== null && c.providerPosition !== null)

    if (childClauses.length === 0) return 0

    const alignedCount = childClauses.filter(c => {
        const gap = Math.abs((c.customerPosition || 0) - (c.providerPosition || 0))
        return gap <= 1
    }).length

    return Math.round((alignedCount / childClauses.length) * 100)
}

// ============================================================================
// SECTION 4: HELPER FUNCTIONS
// ============================================================================

function buildClauseTree(clauses: ContractClause[], preserveExpandedFrom?: ContractClause[]): ContractClause[] {
    const clauseMap = new Map<string, ContractClause>()
    const rootClauses: ContractClause[] = []

    // Build a map of current expanded states to preserve
    const expandedStates = new Map<string, boolean>()
    if (preserveExpandedFrom) {
        const collectExpandedStates = (items: ContractClause[]) => {
            items.forEach(item => {
                expandedStates.set(item.positionId, item.isExpanded ?? false)
                if (item.children && item.children.length > 0) {
                    collectExpandedStates(item.children)
                }
            })
        }
        collectExpandedStates(preserveExpandedFrom)
    }

    // First pass: create map - preserve expanded state if available, otherwise default to collapsed
    clauses.forEach(clause => {
        const isExpanded = expandedStates.get(clause.positionId) ?? false
        clauseMap.set(clause.positionId, { ...clause, children: [], isExpanded })
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
// SECTION 5D: MOVES TRACKER OVERLAY COMPONENT
// ============================================================================

interface MovesTrackerOverlayProps {
    isOpen: boolean
    onClose: () => void
    negotiationHistory: NegotiationHistoryEntry[]
    userRole: 'customer' | 'provider'
    sessionId: string
    onMarkAllSeen?: () => void
}

function MovesTrackerOverlay({ isOpen, onClose, negotiationHistory, userRole, sessionId, onMarkAllSeen }: MovesTrackerOverlayProps) {
    const [timeFilter, setTimeFilter] = useState<'all' | 'hour' | 'today' | 'week'>('all')
    const [partyFilter, setPartyFilter] = useState<'all' | 'customer' | 'provider'>('all')

    if (!isOpen) return null

    // Filter history entries
    const filteredHistory = negotiationHistory
        .filter(entry => {
            // Only show position changes
            if (entry.eventType !== 'position_change') return false

            // Party filter
            if (partyFilter !== 'all' && entry.party !== partyFilter) return false

            // Time filter
            if (timeFilter !== 'all') {
                const entryTime = new Date(entry.timestamp).getTime()
                const now = Date.now()
                const hourAgo = now - (60 * 60 * 1000)
                const startOfToday = new Date().setHours(0, 0, 0, 0)
                const weekAgo = now - (7 * 24 * 60 * 60 * 1000)

                if (timeFilter === 'hour' && entryTime < hourAgo) return false
                if (timeFilter === 'today' && entryTime < startOfToday) return false
                if (timeFilter === 'week' && entryTime < weekAgo) return false
            }

            return true
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return date.toLocaleDateString()
    }

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">Moves Tracker</h2>
                        <p className="text-sm text-slate-500">All position changes in this negotiation</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 p-4 border-b border-slate-100">
                    {/* Time Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Time:</span>
                        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                            {(['all', 'hour', 'today', 'week'] as const).map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => setTimeFilter(filter)}
                                    className={`px-2 py-1 text-xs rounded-md transition ${timeFilter === filter
                                        ? 'bg-white text-slate-800 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-800'
                                        }`}
                                >
                                    {filter === 'all' ? 'All' : filter === 'hour' ? 'Last Hour' : filter === 'today' ? 'Today' : 'This Week'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Party Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Party:</span>
                        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                            {(['all', 'customer', 'provider'] as const).map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => setPartyFilter(filter)}
                                    className={`px-2 py-1 text-xs rounded-md transition ${partyFilter === filter
                                        ? 'bg-white text-slate-800 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-800'
                                        }`}
                                >
                                    {filter === 'all' ? 'All' : filter === 'customer' ? 'Customer' : 'Provider'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Count */}
                    <div className="ml-auto text-xs text-slate-400">
                        {filteredHistory.length} move{filteredHistory.length !== 1 ? 's' : ''}
                    </div>
                </div>

                {/* Moves List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {filteredHistory.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                            </div>
                            <p className="text-slate-600">No moves found</p>
                            <p className="text-sm text-slate-400 mt-1">
                                {timeFilter !== 'all' || partyFilter !== 'all'
                                    ? 'Try adjusting your filters'
                                    : 'Position changes will appear here'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredHistory.map((entry) => (
                                <div
                                    key={entry.id}
                                    className={`border rounded-lg p-3 ${entry.party === 'customer'
                                        ? 'border-emerald-200 bg-emerald-50/50'
                                        : 'border-blue-200 bg-blue-50/50'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${entry.party === 'customer' ? 'bg-emerald-500' : 'bg-blue-500'
                                                }`}>
                                                {entry.party === 'customer' ? 'C' : 'P'}
                                            </div>
                                            <div>
                                                <span className={`text-sm font-medium ${entry.party === 'customer' ? 'text-emerald-700' : 'text-blue-700'
                                                    }`}>
                                                    {entry.partyName}
                                                </span>
                                                {entry.party !== userRole && (
                                                    <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">
                                                        Other Party
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-xs text-slate-400">
                                            {formatTimestamp(entry.timestamp)}
                                        </span>
                                    </div>

                                    <div className="ml-8">
                                        <p className="text-sm text-slate-700 mb-2">{entry.description}</p>

                                        <div className="flex items-center gap-3">
                                            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                                                {entry.clauseName}
                                            </span>

                                            {entry.oldValue !== undefined && entry.newValue !== undefined && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-slate-400">Position:</span>
                                                    <span className="text-red-500 line-through">{entry.oldValue}</span>
                                                    <span className="text-slate-400">→</span>
                                                    <span className="text-emerald-600 font-medium">{entry.newValue}</span>
                                                </div>
                                            )}

                                            {entry.leverageImpact !== undefined && entry.leverageImpact !== 0 && (
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${entry.leverageImpact > 0
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {entry.leverageImpact > 0 ? '+' : ''}{entry.leverageImpact.toFixed(1)}%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 flex justify-between">
                    <button
                        onClick={async () => {
                            if (sessionId) {
                                try {
                                    const response = await fetch(`${API_BASE}/mark-moves-seen`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            session_id: sessionId,
                                            viewer_role: userRole,
                                            clause_id: null
                                        })
                                    })
                                    if (response.ok) {
                                        // Trigger parent to clear badges - we need to pass a callback
                                        if (onMarkAllSeen) onMarkAllSeen()
                                        onClose()
                                    }
                                } catch (error) {
                                    console.error('Error marking all as seen:', error)
                                }
                            }
                        }}
                        className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg transition flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Mark all as read
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition"
                    >
                        Close
                    </button>
                </div>
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
    const [activeTab, setActiveTab] = useState<'positions' | 'tradeoffs' | 'history' | 'draft'>('positions')
    const [showLeverageDetails, setShowLeverageDetails] = useState(false)
    const [negotiationHistory, setNegotiationHistory] = useState<NegotiationHistoryEntry[]>([])
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)
    const [historyFilter, setHistoryFilter] = useState<'all' | 'positions' | 'agreements'>('all')

    // Unseen moves tracking (badges for other party's changes)
    const [unseenMoves, setUnseenMoves] = useState<Map<string, number>>(new Map())
    const [totalUnseenMoves, setTotalUnseenMoves] = useState(0)
    const [showMovesTracker, setShowMovesTracker] = useState(false)

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
    const positionPanelRef = useRef<HTMLDivElement>(null)

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
    // MARK MOVES AS SEEN
    // ============================================================================

    const markMovesAsSeen = async (clauseId?: string) => {
        if (!session?.sessionId || !userInfo?.role) return

        try {
            const response = await fetch(`${API_BASE}/mark-moves-seen`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: session.sessionId,
                    viewer_role: userInfo.role,
                    clause_id: clauseId || null
                })
            })

            if (response.ok) {
                // Update local state to clear badges
                if (clauseId) {
                    // Clear specific clause
                    setUnseenMoves(prev => {
                        const newMap = new Map(prev)
                        newMap.delete(clauseId)
                        return newMap
                    })
                    setTotalUnseenMoves(prev => Math.max(0, prev - (unseenMoves.get(clauseId) || 0)))
                } else {
                    // Clear all
                    setUnseenMoves(new Map())
                    setTotalUnseenMoves(0)
                }
            }
        } catch (error) {
            console.error('Error marking moves as seen:', error)
        }
    }

    // ============================================================================
    // REALTIME SUBSCRIPTION FOR POSITION CHANGES
    // ============================================================================

    useEffect(() => {
        // Only subscribe when we have session and user info
        if (!session?.sessionId || !userInfo?.role) return

        const supabase = createClient()
        const viewerRole = userInfo.role

        // Subscribe to new position changes for this session
        const channel = supabase
            .channel(`position-changes-${session.sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'position_change_history',
                    filter: `session_id=eq.${session.sessionId}`
                },
                (payload) => {
                    console.log('Realtime position change received:', payload)

                    const newRecord = payload.new as {
                        clause_id: string
                        party: 'customer' | 'provider'
                        seen_by_customer: boolean
                        seen_by_provider: boolean
                    }

                    // Only count if it's from the OTHER party and not yet seen by viewer
                    const isFromOtherParty = newRecord.party !== viewerRole
                    const isUnseen = viewerRole === 'customer'
                        ? !newRecord.seen_by_customer
                        : !newRecord.seen_by_provider

                    if (isFromOtherParty && isUnseen) {
                        // Update unseen moves count for this clause
                        setUnseenMoves(prev => {
                            const newMap = new Map(prev)
                            const currentCount = newMap.get(newRecord.clause_id) || 0
                            newMap.set(newRecord.clause_id, currentCount + 1)
                            return newMap
                        })

                        // Update total count
                        setTotalUnseenMoves(prev => prev + 1)

                        console.log(`New unseen move on clause ${newRecord.clause_id} from ${newRecord.party}`)
                    }
                }
            )
            .subscribe((status) => {
                console.log('Realtime subscription status:', status)
            })

        // Cleanup on unmount or when session/user changes
        return () => {
            console.log('Unsubscribing from position changes')
            supabase.removeChannel(channel)
        }
    }, [session?.sessionId, userInfo?.role])

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

    const loadContractData = useCallback(async (sessionId: string, viewerRole?: string) => {
        try {
            const roleParam = viewerRole ? `&viewer_role=${viewerRole}` : ''
            const response = await fetch(`${API_BASE}/contract-studio-api?session_id=${sessionId}${roleParam}`)
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
                    customerContactName: data.session.customerContactName || null,
                    providerContactName: null,
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
                customerContactName: data.session.customerContactName || null,
                providerContactName: data.session.providerContactName || null,
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
                    originalCustomerPosition: c.originalCustomerPosition != null
                        ? parseFloat(c.originalCustomerPosition)
                        : customerPos,
                    originalProviderPosition: c.originalProviderPosition != null
                        ? parseFloat(c.originalProviderPosition)
                        : providerPos,
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

            // Parse unseen moves from API response
            if (data.unseenMoves && Array.isArray(data.unseenMoves)) {
                const movesMap = new Map<string, number>()
                data.unseenMoves.forEach((item: { clauseId: string, unseenCount: number }) => {
                    movesMap.set(item.clauseId, item.unseenCount)
                })
                setUnseenMoves(movesMap)
                setTotalUnseenMoves(data.totalUnseenMoves || 0)
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
    // SECTION 7B: LOAD AVAILABLE PROVIDERS (MULTI-PROVIDER SUPPORT)
    // ============================================================================

    const loadAvailableProviders = useCallback(async (sessionId: string) => {
        setIsLoadingProviders(true)
        try {
            const response = await fetch(`${API_BASE}/provider-bids-api?session_id=${sessionId}`)
            if (response.ok) {
                const data = await response.json()

                // API returns [{ success: true, bids: [...] }] - extract the bids array
                const bidsArray = Array.isArray(data) && data[0]?.bids
                    ? data[0].bids
                    : Array.isArray(data?.bids)
                        ? data.bids
                        : []

                const providers: ProviderBid[] = bidsArray.map((bid: ApiProviderBidResponse) => ({
                    bidId: bid.bid_id,
                    providerId: bid.provider_id,
                    providerCompany: bid.provider_company,
                    providerContactName: bid.provider_contact_name,
                    providerContactEmail: bid.provider_contact_email,
                    status: bid.status,
                    intakeComplete: bid.intake_complete,
                    questionnaireComplete: bid.questionnaire_complete,
                    invitedAt: bid.invited_at,
                    submittedAt: bid.submitted_at,
                    isCurrentProvider: false
                }))
                setAvailableProviders(providers)
                console.log('Loaded providers:', providers)
            }
        } catch (error) {
            console.error('Failed to load providers:', error)
        } finally {
            setIsLoadingProviders(false)
        }
    }, [])

    // Load providers when session is available (customers only)
    useEffect(() => {
        if (session?.sessionId && userInfo?.role === 'customer') {
            loadAvailableProviders(session.sessionId)
        }
    }, [session?.sessionId, userInfo?.role, loadAvailableProviders])

    const loadClarenceWelcome = useCallback(async (sessionId: string, viewerRole: 'customer' | 'provider') => {
        if (clarenceWelcomeLoaded) return

        // CRITICAL: Stop the working overlay - data is loaded, now just loading welcome
        stopWorking()
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
            }
        } catch (error) {
            console.error('Failed to load CLARENCE welcome:', error)
        } finally {
            setIsChatLoading(false)
        }
    }, [clarenceWelcomeLoaded, stopWorking])


    // ============================================================================
    // SECTION 7C: CLARENCE AI CLAUSE EXPLAINER
    // ============================================================================

    const explainClauseWithClarence = useCallback(async (sessionId: string, clause: ContractClause, viewerRole: 'customer' | 'provider') => {
        if (lastExplainedClauseId === clause.clauseId) return

        // TEMPORARILY DISABLED FOR DEMOS - re-enable after demo period
        // startWorking('clause_loading')
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
                // TEMPORARILY DISABLED FOR DEMOS
                // stopWorking()
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
                            customerContactName: data.contactName || data.contact_name || null,
                            providerContactName: null,
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
                            customerContactName: null,
                            providerContactName: null,
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
                        customerContactName: null,
                        providerContactName: null,
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

            const data = await loadContractData(sessionId, user.role)

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

    // ============================================================================
    // RECALCULATE LEVERAGE TRACKER ON DATA LOAD
    // Ensures tracker reflects all position changes, not just baseline
    // ============================================================================

    // ============================================================================
    // LEVERAGE TRACKER - TRUST PERSISTED VALUES FROM API
    // ============================================================================
    // Leverage tracker values are now persisted to the database on each position
    // change (via position-update-api) and loaded from the Contract Studio API.
    // We no longer recalculate on page load to avoid overwriting persisted values.
    // 
    // The recalculateLeverageTracker function is still used for real-time UI 
    // updates DURING the session when positions change, but the database values
    // are the source of truth on page refresh.
    // ============================================================================

    useEffect(() => {
        if (session?.sessionId && sessionStatus === 'ready' && !clarenceWelcomeLoaded && !loading && userInfo?.role) {
            loadClarenceWelcome(session.sessionId, userInfo.role as 'customer' | 'provider')
        }
    }, [session?.sessionId, sessionStatus, clarenceWelcomeLoaded, loading, loadClarenceWelcome, userInfo?.role])

    useEffect(() => {
        if (session?.sessionId && sessionStatus === 'ready' && !clarenceWelcomeLoaded && !loading && userInfo?.role) {
            loadClarenceWelcome(session.sessionId, userInfo.role as 'customer' | 'provider')
        }
    }, [session?.sessionId, sessionStatus, clarenceWelcomeLoaded, loading, loadClarenceWelcome, userInfo?.role])


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
    // SECTION 7H: FETCH NEGOTIATION HISTORY FROM DATABASE
    // ============================================================================

    const fetchNegotiationHistory = useCallback(async () => {
        if (!session?.sessionId) return

        try {
            setIsLoadingHistory(true)
            const supabase = createClient()

            // Fetch position changes from database with real timestamps
            const { data: positionChanges, error } = await supabase
                .from('position_change_history')
                .select(`
                    id,
                    clause_id,
                    clause_name,
                    clause_number,
                    party,
                    changed_by_name,
                    changed_by_company,
                    old_position,
                    new_position,
                    position_delta,
                    leverage_impact,
                    changed_at,
                    seen_by_customer,
                    seen_by_provider
                `)
                .eq('session_id', session.sessionId)
                .order('changed_at', { ascending: false })
                .limit(100)

            if (error) {
                console.error('Error fetching position history:', error)
                return
            }

            console.log('Fetched position history:', positionChanges?.length, 'records')

            // Map database records to NegotiationHistoryEntry format
            const history: NegotiationHistoryEntry[] = (positionChanges || []).map(change => {
                const isViewerCustomer = userInfo?.role === 'customer'
                const isOwnMove = change.party === userInfo?.role

                // Determine party name for display
                let displayName: string
                if (isOwnMove) {
                    displayName = 'You'
                } else if (change.changed_by_name) {
                    displayName = change.changed_by_name
                } else if (change.changed_by_company) {
                    displayName = change.changed_by_company
                } else {
                    displayName = change.party === 'customer' ? session.customerCompany : session.providerCompany
                }

                return {
                    id: change.id,
                    timestamp: change.changed_at,  // REAL TIMESTAMP FROM DB
                    eventType: 'position_change' as const,
                    party: change.party as 'customer' | 'provider',
                    partyName: displayName,
                    clauseId: change.clause_id,
                    clauseName: change.clause_name || 'Unknown Clause',
                    clauseNumber: change.clause_number,
                    description: `${displayName} moved position on ${change.clause_name}`,
                    oldValue: parseFloat(change.old_position),
                    newValue: parseFloat(change.new_position),
                    leverageImpact: parseFloat(change.leverage_impact) || 0,
                    seen: isViewerCustomer ? change.seen_by_customer : change.seen_by_provider
                }
            })

            // Add session start entry at the end
            history.push({
                id: 'session-start',
                timestamp: session.createdAt || new Date(Date.now() - 86400000).toISOString(),
                eventType: 'session_started',
                party: 'system',
                partyName: 'CLARENCE',
                description: `Negotiation session opened between ${session.customerCompany} and ${session.providerCompany}`
            })

            setNegotiationHistory(history)

        } catch (error) {
            console.error('Error fetching negotiation history:', error)
        } finally {
            setIsLoadingHistory(false)
        }
    }, [session?.sessionId, session?.customerCompany, session?.providerCompany, session?.createdAt, userInfo?.role])

    // Fetch history on mount and when session changes
    useEffect(() => {
        fetchNegotiationHistory()
    }, [fetchNegotiationHistory])

    // ============================================================================
    // SECTION 7I: SCROLL POSITION PANEL TO TOP WHEN CLAUSE CHANGES
    // ============================================================================

    useEffect(() => {
        if (selectedClause && positionPanelRef.current) {
            positionPanelRef.current.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }, [selectedClause?.positionId])

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

        // Start working overlay
        startWorking('position_commit')
        setIsCommitting(true)

        try {
            const result = await commitPositionChange(
                session.sessionId,
                selectedClause.positionId,
                userInfo.role as 'customer' | 'provider',
                proposedPosition,
                pendingLeverageImpact,
                {
                    userId: userInfo.userId,
                    userName: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || undefined,
                    companyName: userInfo.company
                }
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
                setClauseTree(buildClauseTree(updatedClauses, clauseTree))

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

                // Use the values we already calculated
                setLeverage({
                    ...leverage,
                    leverageTrackerCustomer: newLeverage.customerLeverage,
                    leverageTrackerProvider: newLeverage.providerLeverage,
                    leverageTrackerCalculatedAt: new Date().toISOString()
                })

                // ============================================================
                // CLARENCE RESPONSE TO POSITION CHANGE
                // ============================================================
                const newGap = calculateGapSize(
                    userInfo.role === 'customer' ? proposedPosition : selectedClause.customerPosition,
                    userInfo.role === 'provider' ? proposedPosition : selectedClause.providerPosition
                )
                const isNowAligned = newGap < 0.5
                const clarenceRec = selectedClause.clarenceRecommendation
                const alignedWithClarence = clarenceRec !== null && Math.abs(proposedPosition - clarenceRec) < 0.5

                let clarenceMessage: string | null = null

                if (isNowAligned) {
                    // Both parties are now aligned on this clause
                    clarenceMessage = `🎉 Excellent news! Both parties have reached agreement on **${selectedClause.clauseName}**. This clause is now fully aligned. Well done to both sides for finding common ground.`
                } else if (alignedWithClarence) {
                    // User adopted CLARENCE's recommendation
                    clarenceMessage = `Thank you for adopting my suggested position on **${selectedClause.clauseName}**. This positions you well for constructive dialogue with the other party. I'd encourage you to discuss this clause directly to help them understand your reasoning.`
                } else {
                    // Standard position change
                    clarenceMessage = `New position noted on **${selectedClause.clauseName}**. The current gap to the other party is ${newGap.toFixed(1)} points.`
                }

                if (clarenceMessage) {
                    const clarenceResponse: ClauseChatMessage = {
                        messageId: `clarence-position-${Date.now()}`,
                        sessionId: session.sessionId,
                        positionId: selectedClause.positionId,
                        sender: 'clarence',
                        senderUserId: null,
                        message: clarenceMessage,
                        messageType: 'auto_response',
                        relatedPositionChange: true,
                        triggeredBy: 'position_change',
                        createdAt: new Date().toISOString()
                    }
                    setChatMessages(prev => [...prev, clarenceResponse])
                }
                // ============================================================

                setIsAdjusting(false)
                setPendingLeverageImpact(0)
                // Refresh negotiation history to include the new move
                await fetchNegotiationHistory()
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
        setActiveTab('positions')

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
- Customer position: ${clause.customerPosition}/5
- Provider position: ${clause.providerPosition}/5
- CLARENCE recommended position: ${clause.clarenceRecommendation ?? 'Not set'}/5
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
            <div className="mb-3">  {/* Was mb-6 */}
                {/* Header - CONDENSED */}
                <div className="flex items-center justify-between mb-2">  {/* Was mb-3 */}
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isCustomer ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                        <h4 className="font-semibold text-slate-800 text-sm">Your Position</h4>  {/* Added text-sm */}
                        {hasChanged && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                Changed
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-slate-500">
                        Weight: <span className="font-semibold text-slate-700">{myWeight}/5</span>
                    </div>
                </div>

                {/* Position Options View */}
                {hasPositionOptions ? (
                    <div className="space-y-2">

                        {/* ============================================================ */}
                        {/* COMPACT SPECTRUM BAR WITH ZONE LABELS */}
                        {/* ============================================================ */}
                        {(() => {
                            // Convert DB positions (1-10) to percentage for bar placement
                            const toBarPercent = (dbPos: number | null) => dbPos !== null ? ((dbPos - 1) / 9) * 100 : null

                            const myBarPercent = toBarPercent(myDbPosition)
                            const otherBarPercent = toBarPercent(otherDbPosition)
                            const clarenceBarPercent = toBarPercent(clarenceDbPosition)
                            const proposedBarPercent = toBarPercent(proposedPosition)

                            // Check for TRUE alignment (within 0.5 points on DB scale)
                            const isAligned = myDbPosition !== null && otherDbPosition !== null &&
                                Math.abs(myDbPosition - otherDbPosition) < 0.5
                            const isMeAtClarence = myDbPosition !== null && clarenceDbPosition !== null &&
                                Math.abs(myDbPosition - clarenceDbPosition) < 0.5
                            const isOtherAtClarence = otherDbPosition !== null && clarenceDbPosition !== null &&
                                Math.abs(otherDbPosition - clarenceDbPosition) < 0.5

                            // Get zone info for current/proposed position
                            const getZoneForPosition = (pos: number | null) => {
                                if (pos === null || !selectedClause.positionOptions) return null
                                const zoneIndex = Math.min(
                                    Math.floor((pos - 1) / (9 / selectedClause.positionOptions.length)),
                                    selectedClause.positionOptions.length - 1
                                )
                                return selectedClause.positionOptions[zoneIndex]
                            }

                            const currentZone = getZoneForPosition(proposedPosition ?? myDbPosition)
                            const zoneCount = selectedClause.positionOptions?.length || 4

                            // Handle bar click to set position
                            const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                const clickPercent = ((e.clientX - rect.left) / rect.width) * 100
                                const newPosition = Math.round(((clickPercent / 100) * 9 + 1) * 10) / 10
                                const clampedPosition = Math.max(1, Math.min(10, newPosition))
                                handlePositionDrag(clampedPosition)
                            }

                            return (
                                <div className="space-y-3">
                                    {/* Spectrum Labels */}
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                                            Provider-Friendly
                                        </span>
                                        <span className="flex items-center gap-1">
                                            Customer-Friendly
                                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                        </span>
                                    </div>

                                    {/* Main Interactive Bar */}
                                    <div
                                        className="relative h-12 bg-gradient-to-r from-blue-200 via-slate-100 to-emerald-200 rounded-lg border border-slate-300 cursor-pointer hover:border-slate-400 transition-all"
                                        onClick={handleBarClick}
                                        title="Click to set your position"
                                    >
                                        {/* Zone dividers */}
                                        {Array.from({ length: zoneCount - 1 }).map((_, i) => (
                                            <div
                                                key={i}
                                                className="absolute top-0 bottom-0 w-px bg-slate-300"
                                                style={{ left: `${((i + 1) / zoneCount) * 100}%` }}
                                            />
                                        ))}

                                        {/* Position Markers */}
                                        {/* Other Party marker */}
                                        {otherBarPercent !== null && !isAligned && (
                                            <div
                                                className={`absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold z-10 shadow-md ${isOtherAtClarence ? 'ring-2 ring-purple-400 ring-offset-1' : ''}`}
                                                style={{
                                                    left: `${otherBarPercent}%`,
                                                    transform: 'translate(-50%, -50%)',
                                                    backgroundColor: isCustomer ? '#3b82f6' : '#10b981',
                                                    borderColor: isCustomer ? '#1d4ed8' : '#047857',
                                                    color: 'white'
                                                }}
                                                title={`${isCustomer ? 'Provider' : 'Customer'}: ${otherDbPosition?.toFixed(1)}`}
                                            >
                                                {isCustomer ? 'P' : 'C'}
                                                {isOtherAtClarence && (
                                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                                                        <span className="text-[10px] text-white">★</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* CLARENCE marker */}
                                        {clarenceBarPercent !== null && !isMeAtClarence && !isOtherAtClarence && (
                                            <div
                                                className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-purple-500 border-2 border-purple-700 flex items-center justify-center text-sm font-bold text-white z-10 shadow-md"
                                                style={{
                                                    left: `${clarenceBarPercent}%`,
                                                    transform: 'translate(-50%, -50%)'
                                                }}
                                                title={`CLARENCE suggests: ${clarenceDbPosition?.toFixed(1)}`}
                                            >
                                                ★
                                            </div>
                                        )}

                                        {/* Your position / Aligned marker */}
                                        {isAligned && myBarPercent !== null ? (
                                            <div
                                                className={`absolute top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold z-20 shadow-lg ${isMeAtClarence ? 'ring-2 ring-purple-400 ring-offset-2' : ''}`}
                                                style={{
                                                    left: `${myBarPercent}%`,
                                                    transform: 'translate(-50%, -50%)',
                                                    background: 'linear-gradient(135deg, #10b981 50%, #3b82f6 50%)',
                                                    color: 'white',
                                                    border: '3px solid white'
                                                }}
                                                title={`Aligned at ${myDbPosition?.toFixed(1)}`}
                                            >
                                                ✓
                                            </div>
                                        ) : myBarPercent !== null && (
                                            <div
                                                className={`absolute top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold z-20 shadow-lg ${isMeAtClarence ? 'ring-2 ring-purple-400 ring-offset-2' : ''}`}
                                                style={{
                                                    left: `${myBarPercent}%`,
                                                    transform: 'translate(-50%, -50%)',
                                                    backgroundColor: isCustomer ? '#10b981' : '#3b82f6',
                                                    borderColor: 'white',
                                                    color: 'white',
                                                    borderWidth: '3px'
                                                }}
                                                title={`You: ${myDbPosition?.toFixed(1)}`}
                                            >
                                                {isCustomer ? 'C' : 'P'}
                                                {isMeAtClarence && (
                                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                                                        <span className="text-[10px] text-white">★</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Proposed position marker */}
                                        {proposedBarPercent !== null && proposedPosition !== myDbPosition && (
                                            <div
                                                className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-amber-500 border-3 border-white flex items-center justify-center text-xs font-bold text-white z-25 shadow-lg animate-pulse"
                                                style={{
                                                    left: `${proposedBarPercent}%`,
                                                    transform: 'translate(-50%, -50%)'
                                                }}
                                                title={`Proposed: ${proposedPosition?.toFixed(1)}`}
                                            >
                                                →
                                            </div>
                                        )}
                                    </div>

                                    {/* Zone Labels */}
                                    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${zoneCount}, 1fr)` }}>
                                        {selectedClause.positionOptions?.map((option, idx) => {
                                            const isCurrentZone = currentZone?.value === option.value
                                            const zoneStart = 1 + (idx * 9 / zoneCount)
                                            const zoneEnd = 1 + ((idx + 1) * 9 / zoneCount)
                                            const hasMyPosition = myDbPosition !== null && myDbPosition >= zoneStart && myDbPosition < zoneEnd
                                            const hasOtherPosition = otherDbPosition !== null && otherDbPosition >= zoneStart && otherDbPosition < zoneEnd
                                            const hasClarence = clarenceDbPosition !== null && clarenceDbPosition >= zoneStart && clarenceDbPosition < zoneEnd

                                            return (
                                                <div
                                                    key={option.value}
                                                    onClick={() => {
                                                        // Click zone to jump to zone midpoint
                                                        const midpoint = (zoneStart + zoneEnd) / 2
                                                        handlePositionDrag(Math.round(midpoint * 10) / 10)
                                                    }}
                                                    className={`p-2 rounded text-center cursor-pointer transition-all ${isCurrentZone
                                                        ? 'bg-slate-800 text-white'
                                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                                        }`}
                                                    title={option.description}
                                                >
                                                    <div className="text-xs font-medium truncate">{option.label}</div>
                                                    <div className="flex justify-center gap-1 mt-1">
                                                        {hasMyPosition && (
                                                            <span className={`w-2 h-2 rounded-full ${isCustomer ? 'bg-emerald-400' : 'bg-blue-400'}`}></span>
                                                        )}
                                                        {hasOtherPosition && (
                                                            <span className={`w-2 h-2 rounded-full ${isCustomer ? 'bg-blue-400' : 'bg-emerald-400'}`}></span>
                                                        )}
                                                        {hasClarence && (
                                                            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Current Zone Description */}
                                    {currentZone && (
                                        <div className={`p-3 rounded-lg border-2 ${isAdjusting
                                            ? 'bg-amber-50 border-amber-300'
                                            : 'bg-slate-50 border-slate-200'
                                            }`}>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="text-xs text-slate-500">
                                                        {isAdjusting ? 'Proposed Position' : 'Your Position'}
                                                    </span>
                                                    <div className="font-medium text-slate-800">
                                                        {currentZone.label}
                                                        <span className="ml-2 text-xs text-slate-400 font-mono">
                                                            ({(proposedPosition ?? myDbPosition)?.toFixed(1)})
                                                        </span>
                                                    </div>
                                                </div>
                                                {isAdjusting && (
                                                    <span className="px-2 py-1 bg-amber-200 text-amber-800 text-xs font-medium rounded">
                                                        Unsaved
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">{currentZone.description}</p>
                                        </div>
                                    )}

                                    {/* Compact Legend */}
                                    <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500 pt-2 border-t border-slate-200">
                                        <div className="flex items-center gap-1">
                                            <div className={`w-3 h-3 rounded-full ${isCustomer ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                                            <span>You</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className={`w-3 h-3 rounded-full ${isCustomer ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                                            <span>{isCustomer ? 'Provider' : 'Customer'}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                                            <span>CLARENCE</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                            <span>Proposed</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-3 rounded-full overflow-hidden flex">
                                                <div className="w-1/2 h-full bg-emerald-500"></div>
                                                <div className="w-1/2 h-full bg-blue-500"></div>
                                            </div>
                                            <span>Aligned</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
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

                {/* Leverage Impact Preview - CONDENSED */}
                {isProposing && pendingLeverageImpact !== 0 && (
                    <div className={`p-2 rounded-lg mt-2 ${pendingLeverageImpact < 0 ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                        <span className={`text-xs ${pendingLeverageImpact < 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
                            <strong>Leverage Impact:</strong> This move will {pendingLeverageImpact < 0 ? 'cost you' : 'gain you'}{' '}
                            <span className="font-bold">{Math.abs(pendingLeverageImpact).toFixed(1)}%</span> leverage
                        </span>
                    </div>
                )}

                {/* Action Buttons - CONDENSED */}
                <div className="flex gap-2 mt-2">
                    <button
                        onClick={handleSetPosition}
                        disabled={!isProposing || isCommitting}
                        className={`flex-1 py-2 px-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 text-sm ${isProposing && !isCommitting
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        {isCommitting ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Setting...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition flex items-center gap-1.5 text-sm"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Reset
                        </button>
                    )}
                </div>

                {/* Reset Confirmation Modal */}
                {showResetConfirm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-4 max-w-md mx-4 shadow-xl">
                            <h3 className="text-base font-semibold text-slate-800 mb-2">Reset Position?</h3>
                            <p className="text-sm text-slate-600 mb-3">
                                This will restore your position on <strong>{selectedClause.clauseName}</strong> back to{' '}
                                <strong>{getPositionLabel(originalDbPosition)}</strong>.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleResetPosition}
                                    className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition text-sm"
                                >
                                    Yes, Reset
                                </button>
                                <button
                                    onClick={() => setShowResetConfirm(false)}
                                    className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition text-sm"
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
                        <span className={`font-semibold ${selectedClause.gapSize < 0.5 ? 'text-emerald-600' :
                            selectedClause.gapSize <= 1 ? 'text-emerald-600' :
                                selectedClause.gapSize <= 3 ? 'text-amber-600' :
                                    'text-red-600'
                            }`}>
                            {selectedClause.gapSize < 0.5
                                ? '0 points apart ✓ Fully Aligned'
                                : selectedClause.gapSize <= 1
                                    ? `${selectedClause.gapSize.toFixed(1)} points apart ✓ Nearly Aligned`
                                    : selectedClause.gapSize <= 3
                                        ? `${selectedClause.gapSize.toFixed(1)} points apart`
                                        : `${selectedClause.gapSize.toFixed(1)} points apart ⚠ Significant Gap`
                            }
                        </span>
                    </div>
                    {hasPositionOptions && (
                        <div className="text-xs text-slate-400 mt-1">
                            {selectedClause.gapSize < 0.5
                                ? `Both parties at: ${getPositionLabel(myDbPosition)}`
                                : `You: ${getPositionLabel(myDbPosition)} → ${isCustomer ? 'Provider' : 'Customer'}: ${getPositionLabel(otherDbPosition)}`
                            }
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ============================================================================
    // SECTION 11: LEVERAGE INDICATOR COMPONENT (COMPACT VERSION)
    // ============================================================================

    const LeverageIndicator = () => {
        // Determine viewer's perspective
        const isCustomer = userInfo?.role === 'customer'

        // Get leverage values - ALWAYS Customer vs Provider (not "you" vs "them")
        const customerBaseline = displayLeverage.leverageScoreCustomer
        const providerBaseline = displayLeverage.leverageScoreProvider
        const customerTracker = displayLeverage.leverageTrackerCustomer
        const providerTracker = displayLeverage.leverageTrackerProvider

        // Calculate shifts for display
        const customerShift = customerTracker - customerBaseline
        const providerShift = providerTracker - providerBaseline

        // Company names
        const customerCompanyName = session?.customerCompany?.split(' ')[0] || 'Customer'
        const providerCompanyName = session?.providerCompany?.split(' ')[0] || 'Provider'

        // Calculate dynamic alignment percentage
        const dynamicAlignmentPercentage = calculateAlignmentPercentage(clauses)

        // Get actual leverage factor scores from the data
        const marketDynamicsScore = displayLeverage.marketDynamicsScore ?? 50
        const economicFactorsScore = displayLeverage.economicFactorsScore ?? 50
        const strategicPositionScore = displayLeverage.strategicPositionScore ?? 50
        const batnaScore = displayLeverage.batnaScore ?? 50

        return (
            <div className="bg-white rounded-xl border border-slate-200 p-3 mb-2">
                {/* Header Row - More Compact */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-700">Negotiation Metrics</h3>
                        <button
                            onClick={() => {
                                if (typeof eventLogger !== 'undefined') {
                                    eventLogger.completed('contract_negotiation', 'leverage_details_toggled', {
                                        sessionId: session?.sessionId,
                                        expanded: !showLeverageDetails
                                    })
                                }
                                setShowLeverageDetails(!showLeverageDetails)
                            }}
                            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                        >
                            <svg className={`w-3 h-3 transition-transform ${showLeverageDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            {showLeverageDetails ? 'Hide Details' : 'Show Details'}
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Moves Tracker Button */}
                        <button
                            onClick={() => setShowMovesTracker(true)}
                            className="relative px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition flex items-center gap-1"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            Moves
                            {totalUnseenMoves > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                                    {totalUnseenMoves > 9 ? '9+' : totalUnseenMoves}
                                </span>
                            )}
                        </button>

                        {/* Dynamic Alignment Badge */}
                        <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${dynamicAlignmentPercentage >= 90
                            ? 'bg-emerald-100 text-emerald-700'
                            : dynamicAlignmentPercentage >= 70
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                            {dynamicAlignmentPercentage}% Aligned
                        </div>
                    </div>
                </div>

                {/* Compact Inline Layout: Baseline + Tracker + Bar */}
                <div className="flex items-center gap-3 mb-2">
                    {/* Baseline */}
                    <div className="flex items-center gap-1.5 bg-slate-50 rounded px-2 py-1">
                        <span className="text-xs text-slate-500">◆ Baseline:</span>
                        <span className="text-sm font-bold">
                            <span className="text-emerald-600">{customerBaseline}</span>
                            <span className="text-slate-400">:</span>
                            <span className="text-blue-600">{providerBaseline}</span>
                        </span>
                    </div>

                    {/* Tracker */}
                    <div className="flex items-center gap-1.5 bg-slate-50 rounded px-2 py-1">
                        <span className="text-xs text-slate-500">⬡ Tracker:</span>
                        <span className="text-sm font-bold">
                            <span className="text-emerald-600">{customerTracker}</span>
                            <span className="text-slate-400">:</span>
                            <span className="text-blue-600">{providerTracker}</span>
                        </span>
                        {(Math.abs(customerShift) > 0 || Math.abs(providerShift) > 0) && (
                            <span className="text-xs text-slate-400">
                                ({customerShift > 0 ? '+' : ''}{customerShift.toFixed(0)})
                            </span>
                        )}
                    </div>

                    {/* Company Labels */}
                    <div className="text-xs text-slate-400 ml-auto">
                        <span className="text-emerald-600">{customerCompanyName}</span>
                        {' vs '}
                        <span className="text-blue-600">{providerCompanyName}</span>
                    </div>
                </div>

                {/* Visual Leverage Bar - Compact */}
                <div className="relative">
                    {/* Split Bar */}
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative">
                        {/* Customer portion - Emerald from left */}
                        <div
                            className="absolute left-0 top-0 bottom-0 bg-emerald-500 transition-all duration-500"
                            style={{ width: `${customerTracker}%` }}
                        />

                        {/* Provider portion - Blue from right */}
                        <div
                            className="absolute right-0 top-0 bottom-0 bg-blue-500 transition-all duration-500"
                            style={{ width: `${providerTracker}%` }}
                        />

                        {/* Center line (50% mark) */}
                        <div
                            className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white z-30"
                            style={{ transform: 'translateX(-50%)', boxShadow: '0 0 2px rgba(0,0,0,0.3)' }}
                            title="50-50 neutral point"
                        ></div>

                        {/* Customer Baseline marker */}
                        <div
                            className="absolute top-0 bottom-0 w-1.5 bg-emerald-950 z-20 rounded-sm"
                            style={{
                                left: `${customerBaseline}%`,
                                transform: 'translateX(-50%)',
                                boxShadow: '0 0 3px rgba(0,0,0,0.5)'
                            }}
                            title={`Customer Baseline: ${customerBaseline}%`}
                        />

                        {/* Provider Baseline marker */}
                        <div
                            className="absolute top-0 bottom-0 w-1.5 bg-blue-950 z-20 rounded-sm"
                            style={{
                                left: `${100 - providerBaseline}%`,
                                transform: 'translateX(-50%)',
                                boxShadow: '0 0 3px rgba(0,0,0,0.5)'
                            }}
                            title={`Provider Baseline: ${providerBaseline}%`}
                        />
                    </div>

                    {/* Tracker values below the bar - inline */}
                    <div className="flex justify-between text-xs font-bold mt-1">
                        <span className="text-emerald-600">{customerTracker}%</span>
                        <span className="text-blue-600">{providerTracker}%</span>
                    </div>
                </div>

                {/* Expandable 4-Factor Breakdown */}
                {showLeverageDetails && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold text-slate-600">Leverage Factors (from Assessment)</h4>
                            <p className="text-xs text-slate-400">Scores &gt;50 favor Customer • &lt;50 favor Provider</p>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {/* Market Dynamics */}
                            <div className="bg-slate-50 rounded p-2">
                                <div className="text-xs text-slate-500 mb-0.5">Market Dynamics</div>
                                <div className="flex items-center gap-1">
                                    <span className={`text-sm font-bold ${marketDynamicsScore >= 60 ? 'text-emerald-600' :
                                        marketDynamicsScore <= 40 ? 'text-blue-600' : 'text-slate-700'
                                        }`}>
                                        {marketDynamicsScore}
                                    </span>
                                    <span className="text-xs text-slate-400">/ 100</span>
                                </div>
                                {displayLeverage.marketDynamicsRationale && (
                                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                                        {displayLeverage.marketDynamicsRationale}
                                    </p>
                                )}
                            </div>

                            {/* Economic Factors */}
                            <div className="bg-slate-50 rounded p-2">
                                <div className="text-xs text-slate-500 mb-0.5">Economic Factors</div>
                                <div className="flex items-center gap-1">
                                    <span className={`text-sm font-bold ${economicFactorsScore >= 60 ? 'text-emerald-600' :
                                        economicFactorsScore <= 40 ? 'text-blue-600' : 'text-slate-700'
                                        }`}>
                                        {economicFactorsScore}
                                    </span>
                                    <span className="text-xs text-slate-400">/ 100</span>
                                </div>
                                {displayLeverage.economicFactorsRationale && (
                                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                                        {displayLeverage.economicFactorsRationale}
                                    </p>
                                )}
                            </div>

                            {/* Strategic Position */}
                            <div className="bg-slate-50 rounded p-2">
                                <div className="text-xs text-slate-500 mb-0.5">Strategic Position</div>
                                <div className="flex items-center gap-1">
                                    <span className={`text-sm font-bold ${strategicPositionScore >= 60 ? 'text-emerald-600' :
                                        strategicPositionScore <= 40 ? 'text-blue-600' : 'text-slate-700'
                                        }`}>
                                        {strategicPositionScore}
                                    </span>
                                    <span className="text-xs text-slate-400">/ 100</span>
                                </div>
                                {displayLeverage.strategicPositionRationale && (
                                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                                        {displayLeverage.strategicPositionRationale}
                                    </p>
                                )}
                            </div>

                            {/* BATNA */}
                            <div className="bg-slate-50 rounded p-2">
                                <div className="text-xs text-slate-500 mb-0.5">BATNA Analysis</div>
                                <div className="flex items-center gap-1">
                                    <span className={`text-sm font-bold ${batnaScore >= 60 ? 'text-emerald-600' :
                                        batnaScore <= 40 ? 'text-blue-600' : 'text-slate-700'
                                        }`}>
                                        {batnaScore}
                                    </span>
                                    <span className="text-xs text-slate-400">/ 100</span>
                                </div>
                                {displayLeverage.batnaRationale && (
                                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                                        {displayLeverage.batnaRationale}
                                    </p>
                                )}
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

        // Get the weight based on current user's role (or default to customerWeight)
        const clauseWeight = userInfo?.role === 'provider'
            ? clause.providerWeight
            : clause.customerWeight
        const weightDisplay = clauseWeight ? clauseWeight.toFixed(0) : null

        return (
            <div>
                <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition group ${isSelected
                        ? 'bg-emerald-50 border border-emerald-200'
                        : 'hover:bg-slate-50'
                        }`}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                    onClick={() => {
                        // Parent clauses (level 0) only toggle expand/collapse
                        // Child clauses trigger selection and position panel
                        if (clause.clauseLevel === 0) {
                            handleClauseToggle(clause.positionId)
                        } else {
                            handleClauseSelect(clause)
                        }
                    }}
                >
                    {hasChildren ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleClauseToggle(clause.positionId)
                            }}
                            className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600 relative"
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
                        <span className="w-4"></span>
                    )}

                    {/* Status indicator */}
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${clause.status === 'aligned' ? 'bg-emerald-500' :
                        clause.status === 'negotiating' ? 'bg-amber-500' :
                            clause.status === 'disputed' ? 'bg-red-500' :
                                'bg-slate-300'
                        }`}></span>

                    {/* Clause number & name */}
                    <span className="text-xs text-slate-400 font-mono flex-shrink-0">{clause.clauseNumber}</span>
                    <span className={`text-sm truncate flex-1 ${isSelected ? 'text-emerald-700 font-medium' : 'text-slate-700'}`}>
                        {clause.clauseName}
                    </span>

                    {/* Weight indicator - only show for child clauses (level > 0) */}
                    {clause.clauseLevel > 0 && weightDisplay && (
                        <span
                            className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${clauseWeight >= 4 ? 'bg-red-100 text-red-700' :
                                clauseWeight >= 3 ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-600'
                                }`}
                            title={`Weight: ${weightDisplay}/5 - ${clauseWeight >= 4 ? 'High Impact' :
                                clauseWeight >= 3 ? 'Medium Impact' :
                                    'Standard'
                                }`}
                        >
                            W{weightDisplay}
                        </span>
                    )}
                </div>

                {/* Children */}
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

                        {/* Right: Documents Centre Button */}
                        <button
                            onClick={() => router.push(`/auth/document-centre?session_id=${session.sessionId}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Documents
                        </button>
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
                                <div className="text-xs text-slate-500">
                                    {isCustomer
                                        ? `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || session.customerContactName || 'Contact'
                                        : session.customerContactName || 'Contact'
                                    }
                                </div>
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

                        {/* Right: Provider Info with Dropdown (customers) or Static (providers) + Party Chat */}
                        <div className="flex items-center gap-3 min-w-[280px] justify-end">
                            {!isCustomer && (
                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                                    You
                                </span>
                            )}

                            {/* Customer sees provider dropdown, Provider sees static display */}
                            {isCustomer ? (
                                <div className="relative" ref={providerDropdownRef}>
                                    <button
                                        onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                                        className="flex items-center gap-2 text-right hover:bg-slate-700/50 px-2 py-1 rounded transition"
                                    >
                                        <div>
                                            <div className="text-xs text-slate-400">Provider</div>
                                            <div className="text-sm font-medium text-blue-400 flex items-center gap-1">
                                                {providerCompany}
                                                <svg className={`w-3 h-3 transition-transform ${showProviderDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {isCustomer
                                                    ? session.providerContactName || 'Contact'
                                                    : `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || session.providerContactName || 'Contact'
                                                }
                                            </div>
                                        </div>
                                    </button>

                                    {/* Provider Dropdown */}
                                    {showProviderDropdown && (
                                        <div className="absolute right-0 top-full mt-1 w-72 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden">
                                            <div className="p-2 border-b border-slate-700">
                                                <div className="text-xs text-slate-400 px-2">Select Provider</div>
                                            </div>

                                            {isLoadingProviders ? (
                                                <div className="p-4 text-center text-slate-400 text-sm">
                                                    Loading providers...
                                                </div>
                                            ) : availableProviders.length === 0 ? (
                                                <div className="p-4 text-center text-slate-400 text-sm">
                                                    No providers invited yet
                                                </div>
                                            ) : (
                                                <div className="max-h-64 overflow-y-auto">
                                                    {availableProviders.map((provider) => (
                                                        <button
                                                            key={provider.bidId}
                                                            onClick={() => {
                                                                // TODO: Implement provider switching
                                                                alert(`Provider switching to ${provider.providerCompany} coming soon!`)
                                                                setShowProviderDropdown(false)
                                                            }}
                                                            className={`w-full px-3 py-2 text-left hover:bg-slate-700 transition flex items-center justify-between ${provider.providerCompany === providerCompany ? 'bg-slate-700/50' : ''
                                                                }`}
                                                        >
                                                            <div>
                                                                <div className="text-sm font-medium text-white">{provider.providerCompany}</div>
                                                                <div className="text-xs text-slate-400">{provider.providerContactEmail}</div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {provider.providerCompany === providerCompany && (
                                                                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Active</span>
                                                                )}
                                                                <span className={`text-xs px-2 py-0.5 rounded ${provider.questionnaireComplete
                                                                    ? 'bg-emerald-500/20 text-emerald-400'
                                                                    : provider.intakeComplete
                                                                        ? 'bg-amber-500/20 text-amber-400'
                                                                        : 'bg-slate-500/20 text-slate-400'
                                                                    }`}>
                                                                    {provider.questionnaireComplete ? 'Ready' : provider.intakeComplete ? 'Intake Done' : 'Invited'}
                                                                </span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Invite New Provider Button */}
                                            <div className="border-t border-slate-700 p-2">
                                                <button
                                                    onClick={() => {
                                                        const sessionNum = session?.sessionNumber || ''
                                                        router.push(`/auth/invite-providers?session_id=${session?.sessionId}&session_number=${sessionNum}`)
                                                    }}
                                                    className="w-full px-3 py-2 text-sm text-purple-400 hover:bg-purple-500/10 rounded transition flex items-center gap-2 justify-center"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                                    </svg>
                                                    Invite New Provider
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Provider sees simple static display */
                                <div className="text-right">
                                    <div className="text-xs text-slate-400">Provider</div>
                                    <div className="text-sm font-medium text-blue-400">{providerCompany}</div>
                                    <div className="text-xs text-slate-500">
                                        {`${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Contact'}
                                    </div>
                                </div>
                            )}

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

                {/* Moves Tracker Overlay */}
                <MovesTrackerOverlay
                    isOpen={showMovesTracker}
                    onClose={() => setShowMovesTracker(false)}
                    negotiationHistory={negotiationHistory}
                    userRole={userInfo?.role || 'customer'}
                    sessionId={session?.sessionId || ''}
                    onMarkAllSeen={() => {
                        setUnseenMoves(new Map())
                        setTotalUnseenMoves(0)
                    }}
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
                                    {(['positions', 'tradeoffs', 'history', 'draft'] as const).map(tab => {
                                        // Calculate unseen count for history tab badge
                                        const historyBadgeCount = tab === 'history' && selectedClause
                                            ? (unseenMoves.get(selectedClause.clauseId) || 0)
                                            : 0

                                        return (
                                            <button
                                                key={tab}
                                                onClick={() => {
                                                    setActiveTab(tab)
                                                    // Mark moves as seen when viewing History tab
                                                    if (tab === 'history' && selectedClause) {
                                                        markMovesAsSeen(selectedClause.clauseId)
                                                    }
                                                }}
                                                className={`relative px-3 py-1.5 text-sm rounded-md transition ${activeTab === tab
                                                    ? 'bg-white text-slate-800 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                            >
                                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                                {/* Unseen moves badge on History tab */}
                                                {historyBadgeCount > 0 && (
                                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                                                        {historyBadgeCount > 9 ? '9+' : historyBadgeCount}
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Workspace Content */}
                    <div className="flex-1 overflow-y-auto p-4 pt-0">

                        {/* ==================== POSITIONS TAB ==================== */}
                        {activeTab === 'positions' && selectedClause && (
                            <div
                                ref={positionPanelRef}
                                className="flex-1 overflow-y-auto p-3 bg-white mx-4 mb-2 rounded-b-xl border border-t-0 border-slate-200"
                            >
                                {selectedClause && (
                                    <PositionAdjustmentPanel />
                                )}

                                {/* Position Comparison - CONDENSED */}
                                <div className="mb-3">
                                    <h3 className="text-xs font-semibold text-slate-700 mb-2">Position Overview</h3>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className={`p-2 rounded-lg ${userInfo.role === 'customer' ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                <span className="text-xs font-medium text-slate-700">{session.customerCompany}</span>
                                                {userInfo.role === 'customer' && <span className="text-xs text-emerald-600">(You)</span>}
                                            </div>
                                            <div className="text-lg font-bold text-slate-800">
                                                {selectedClause.customerPosition?.toFixed(1) ?? 'Not set'}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                Weight: {selectedClause.customerWeight}/5
                                            </div>
                                        </div>

                                        <div className={`p-2 rounded-lg ${userInfo.role === 'provider' ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50'}`}>
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                <span className="text-xs font-medium text-slate-700">{session.providerCompany}</span>
                                                {userInfo.role === 'provider' && <span className="text-xs text-blue-600">(You)</span>}
                                            </div>
                                            <div className="text-lg font-bold text-slate-800">
                                                {selectedClause.providerPosition?.toFixed(1) ?? 'Not set'}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                Weight: {selectedClause.providerWeight}/5
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Gap Analysis - CONDENSED */}
                                <div className="bg-slate-50 rounded-lg p-2 mb-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-600">Current Gap:</span>
                                        <span className={`text-sm font-bold ${selectedClause.gapSize <= 1 ? 'text-emerald-600' :
                                            selectedClause.gapSize <= 3 ? 'text-amber-600' :
                                                'text-red-600'
                                            }`}>
                                            {selectedClause.gapSize?.toFixed(1)} points
                                            {selectedClause.gapSize <= 1 && ' ✓ Aligned'}
                                        </span>
                                    </div>
                                    {selectedClause.clarenceRecommendation && (
                                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-200">
                                            <span className="text-xs text-slate-600">CLARENCE Suggests:</span>
                                            <span className="text-sm font-semibold text-purple-600">
                                                {selectedClause.clarenceRecommendation.toFixed(1)}
                                            </span>
                                        </div>
                                    )}
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
                                            <h3 className="text-lg font-semibold text-slate-800">Position History</h3>
                                            <p className="text-sm text-slate-500">
                                                Changes for <span className="font-medium text-slate-700">{selectedClause.clauseName}</span>
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

                                        {/* History entries - FILTERED BY SELECTED CLAUSE */}
                                        <div className="space-y-4">
                                            {negotiationHistory
                                                .filter(entry => {
                                                    // First: filter to selected clause only
                                                    if (entry.clauseId !== selectedClause.clauseId) return false
                                                    // Then: apply type filter
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

                                            {negotiationHistory.filter(e => e.clauseId === selectedClause.clauseId).length === 0 && (
                                                <div className="text-center py-8 pl-10">
                                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                        <span className="text-2xl">📋</span>
                                                    </div>
                                                    <p className="text-slate-600">No changes to this clause yet</p>
                                                    <p className="text-sm text-slate-400 mt-1">
                                                        History will appear when positions are adjusted on {selectedClause.clauseName}
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