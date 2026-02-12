'use client'
import { useState, useEffect, useRef, useCallback, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { eventLogger } from '@/lib/eventLogger'
import { createClient } from '@/lib/supabase'
import { PartyChatPanel } from './components/party-chat-component'
import FeedbackButton from '@/app/components/FeedbackButton'
// ROLE MATRIX Phase 2: Dynamic position labels
import { useRoleContext, getScaleLabels } from '@/lib/useRoleContext'
import PositionScaleIndicator from '@/app/components/PositionScaleIndicator'

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
    providerId: string | null
    bidId?: string | null
    serviceType: string
    dealValue: string
    phase: number
    status: string
    createdAt?: string
    // Template & Clause Builder tracking
    templateName?: string
    templatePackId?: string
    clausesSelected?: boolean
    clauseCount?: number
    // TRAINING MODE ADDITIONS:
    isTraining?: boolean
    notes?: string
    // STRAIGHT TO CONTRACT:
    mediationType?: 'straight_to_contract' | 'partial_mediation' | 'full_mediation' | null
    templateSource?: 'existing_template' | 'modified_template' | 'uploaded' | 'from_scratch' | null
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

interface RangeMappingData {
    scale_points: {
        position: number
        value: number
        label: string
        description: string
    }[]
    interpolation: 'linear' | 'logarithmic' | 'stepped'
    format_pattern: string
    display_precision: number
}

interface RangeMapping {
    clauseId: string
    contractId: string
    isDisplayable: boolean
    valueType: string | null
    rangeUnit: string | null
    industryStandardMin: number | null
    industryStandardMax: number | null
    rangeData: RangeMappingData
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
    isLocked?: boolean
    lockedAt?: string
    lockedByUserId?: string

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
    status: 'aligned' | 'negotiating' | 'disputed' | 'pending' | 'agreed' | 'customer_confirmed' | 'provider_confirmed'

    // UI State
    isExpanded?: boolean
    children?: ContractClause[]

    // ========== NEW: Clause Management System Fields ==========

    // Source tracking
    sourceType?: 'legacy' | 'template' | 'master' | 'custom'
    sourceMasterClauseId?: string | null
    sourceTemplateClauseId?: string | null

    // Mid-session additions
    addedMidSession?: boolean
    addedByParty?: 'customer' | 'provider' | null

    // Position options from API (preferred over hardcoded)
    positionOptions?: PositionOption[] | null

    // Confirmation tracking
    customerConfirmedAt?: string | null
    customerConfirmedPosition?: number | null
    providerConfirmedAt?: string | null
    providerConfirmedPosition?: number | null
    agreementReachedAt?: string | null
    finalAgreedPosition?: number | null
    isAgreed?: boolean
    isCustomerConfirmed?: boolean
    isProviderConfirmed?: boolean

    // AI context
    aiContext?: string | null
    negotiationGuidance?: string | null

    // Category header flag
    isCategoryHeader?: boolean

    // ========== FOCUS-12: Clause Management Fields ==========

    // N/A (Not Applicable) tracking
    isApplicable?: boolean
    markedNaBy?: 'customer' | 'provider' | null
    markedNaAt?: string | null
    naReason?: string | null

    // Custom clause tracking (for manually added clauses)
    isCustomClause?: boolean
    customClauseId?: string | null
    proposedLanguage?: string | null
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
    positionOptions?: PositionOption[] | { type: string; options: PositionOption[] } | null
    isLocked?: boolean
    is_locked?: boolean
    lockedAt?: string
    locked_at?: string
    lockedByUserId?: string
    locked_by_user_id?: string

    // Clause Management System fields
    sourceType?: string
    sourceMasterClauseId?: string | null
    sourceTemplateClauseId?: string | null
    addedMidSession?: boolean
    addedByParty?: string | null
    aiContext?: string | null
    negotiationGuidance?: string | null
    isCategoryHeader?: boolean

    // Confirmation tracking fields
    customerConfirmedAt?: string | null
    customerConfirmedPosition?: number | null
    providerConfirmedAt?: string | null
    providerConfirmedPosition?: number | null
    agreementReachedAt?: string | null
    finalAgreedPosition?: number | null
    isAgreed?: boolean
    isCustomerConfirmed?: boolean
    isProviderConfirmed?: boolean
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
// SECTION 1X: NEGOTIATION HISTORY INTERFACE
// ============================================================================

interface NegotiationHistoryEntry {
    id: string
    timestamp: string
    eventType: 'position_change' | 'clause_locked' | 'clause_unlocked' | 'agreement' | 'confirmation' | 'comment' | 'tradeoff_accepted' | 'session_started'
    party: 'customer' | 'provider' | 'system'
    partyName: string
    clauseId?: string
    clauseName?: string
    clauseNumber?: string
    description: string
    oldValue?: number | string
    newValue?: number | string
    leverageImpact?: number
    seen?: boolean
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
        { value: 1, label: 'Maximum dependencies', description: 'Extensive obligations including "reasonably required" inputs' },
        { value: 2, label: 'Extensive list', description: 'Comprehensive list of customer obligations' },
        { value: 3, label: 'Standard dependencies', description: 'Reasonable customer inputs required' },
        { value: 4, label: 'Minimal dependencies', description: 'Very limited customer obligations' }
    ],
    'Transition & Transformation': [
        { value: 1, label: 'Best efforts', description: 'Supplier uses best efforts to complete on time' },
        { value: 2, label: 'Reasonable endeavours', description: 'Reasonable endeavours with limited penalties' },
        { value: 3, label: 'Fixed plans', description: 'Binding obligation with reasonable financial penalties' },
        { value: 4, label: 'Strict obligation', description: 'Binding obligation with penalties and long stop termination right' }
    ],
    'Relief Events': [
        { value: 1, label: 'Broad relief', description: 'Comprehensive relief provisions favouring supplier - maximum provider protection' },
        { value: 2, label: 'Standard relief', description: 'Standard force majeure and customer-caused delays' },
        { value: 3, label: 'Limited relief', description: 'Relief for major force majeure events only' },
        { value: 4, label: 'No relief provision', description: 'Contract silent on relief; prevention principle applies - provider must perform' }
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
        { value: 1, label: 'General earn-back', description: 'Earn-back across all service levels each month' },
        { value: 2, label: 'Within category', description: 'Earn-back within same service level category' },
        { value: 3, label: 'Same SL only', description: 'Earn-back against same service level only' },
        { value: 4, label: 'No earn-back', description: 'No earn-back or bonus provisions' }
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
        { value: 1, label: '60 months', description: 'Five year initial term - maximum provider commitment and revenue stability' },
        { value: 2, label: '48 months', description: 'Four year initial term - strong provider commitment with moderate flexibility' },
        { value: 3, label: '36 months', description: 'Three year initial term - balanced commitment for both parties' },
        { value: 4, label: '24 months', description: 'Two year initial term - moderate customer flexibility' },
        { value: 5, label: '12 months', description: 'One year initial term - maximum customer flexibility to exit or renegotiate' }
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
        { value: 1, label: 'Very limited', description: 'Limited to material non-payment after lengthy notice - maximum customer stability' },
        { value: 2, label: 'Material non-payment', description: 'Material non-payment after extended notice' },
        { value: 3, label: 'Payment default', description: 'Termination for payment default after notice' },
        { value: 4, label: 'Any material breach', description: 'Termination for any material customer breach - maximum provider flexibility' }
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
        { value: 1, label: '250% annual', description: 'Customer liability at 250% of annual charges - maximum provider recovery' },
        { value: 2, label: '200% annual', description: 'Customer liability at 200% of annual charges' },
        { value: 3, label: '150% annual', description: 'Customer liability at 150% of annual charges' },
        { value: 4, label: '100% annual', description: 'Customer liability at 100% of annual charges - minimum customer exposure' }
    ],
    'Exclusions': [
        { value: 1, label: 'Broad exclusions', description: 'Exclude indirect, profits, savings, data, goodwill - maximum provider protection' },
        { value: 2, label: 'Standard exclusions', description: 'Exclude indirect plus lost profits' },
        { value: 3, label: 'Indirect only', description: 'Exclude indirect/consequential only' },
        { value: 4, label: 'No exclusions', description: 'No exclusion for indirect or consequential losses - full customer recovery' }
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
// PRIORITY: 1) API data (clause.positionOptions), 2) Hardcoded lookup, 3) null (use slider)
function getPositionOptionsForClause(
    clause: ContractClause
): PositionOption[] | null {

    // FIRST: Check if API returned position options (handles both array and nested object format)
    if (clause.positionOptions) {
        if (Array.isArray(clause.positionOptions) && clause.positionOptions.length > 0) {
            return clause.positionOptions
        }
        // Handle nested object format { type: string; options: PositionOption[] }
        const nested = clause.positionOptions as { type?: string; options?: PositionOption[] }
        if (nested.options && Array.isArray(nested.options) && nested.options.length > 0) {
            return nested.options
        }
    }

    // SECOND: Check if API returned nested options structure (from JSONB)
    if (clause.positionOptions && typeof clause.positionOptions === 'object' && 'options' in clause.positionOptions) {
        const apiOptions = (clause.positionOptions as unknown as { type: string; options: PositionOption[] }).options
        if (Array.isArray(apiOptions) && apiOptions.length > 0) {
            return apiOptions
        }
    }

    // THIRD: Fallback to hardcoded lookup by clause name
    const clauseName = clause.clauseName

    // Direct match on clauseName
    if (CLAUSE_POSITION_OPTIONS[clauseName]) {
        return CLAUSE_POSITION_OPTIONS[clauseName]
    }

    // Try normalized clauseName (lowercase, trimmed)
    const normalizedName = clauseName.trim()
    for (const [key, options] of Object.entries(CLAUSE_POSITION_OPTIONS)) {
        if (key.toLowerCase() === normalizedName.toLowerCase()) {
            return options
        }
    }

    // Keyword matching for partial matches
    const nameWords = clauseName.toLowerCase()

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

type ClarencePromptType = 'welcome' | 'clause_explain' | 'chat' | 'position_change' | 'alignment_reached' | 'recommendation_adopted'

async function callClarenceAI(
    sessionId: string,
    promptType: ClarencePromptType,
    viewerRole: 'customer' | 'provider' | string,
    options: {
        clauseId?: string
        message?: string
        positionChange?: {
            clauseName: string
            clauseNumber?: string | null
            party: string
            oldPosition: number
            newPosition: number
            newGapSize: number
            otherPartyPosition?: number | null
            clarenceRecommendation?: number | null
            clauseWeight: number
            leverageImpact: number
            customerLeverage: number
            providerLeverage: number
            isAligned?: boolean
            alignedWithClarence?: boolean
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
        newLeverageCustomer?: number;
        newLeverageProvider?: number;
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
                companyName: userContext?.companyName || null,
                newLeverageCustomer: userContext?.newLeverageCustomer || null,
                newLeverageProvider: userContext?.newLeverageProvider || null
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
// SECTION 2D: TRAINING MODE AI FUNCTIONS
// ============================================================================

// Extract AI personality from session notes for Training Mode
function extractAIPersonality(notes: string | null): 'cooperative' | 'balanced' | 'aggressive' {
    if (!notes) return 'balanced'
    const match = notes.match(/AI:\s*(cooperative|balanced|aggressive)/i)
    return match ? match[1].toLowerCase() as 'cooperative' | 'balanced' | 'aggressive' : 'balanced'
}

// Training Avatar Information (for Party Chat AI mode)
interface TrainingAvatarInfo {
    characterName: string
    scenarioName: string
    aiPersonality: 'cooperative' | 'balanced' | 'aggressive'
    avatarInitials: string
    companyName: string
}

// Extract avatar/character information from session notes
function extractTrainingAvatarInfo(notes: string | null, providerCompany: string | null): TrainingAvatarInfo {
    const defaultInfo: TrainingAvatarInfo = {
        characterName: 'AI Opponent',
        scenarioName: 'Training Session',
        aiPersonality: 'balanced',
        avatarInitials: 'AI',
        companyName: providerCompany || 'Training Provider'
    }

    if (!notes) return defaultInfo

    // Extract scenario name: "Training scenario: BPO Fundamentals | ..."
    const scenarioMatch = notes.match(/Training scenario:\s*([^|]+)/i)
    if (scenarioMatch) {
        defaultInfo.scenarioName = scenarioMatch[1].trim()
    }

    // Extract AI personality: "... | AI: cooperative | ..."
    const personalityMatch = notes.match(/AI:\s*(cooperative|balanced|aggressive)/i)
    if (personalityMatch) {
        defaultInfo.aiPersonality = personalityMatch[1].toLowerCase() as 'cooperative' | 'balanced' | 'aggressive'
    }

    // Extract opponent name: "... | Opponent: Robert Jones"
    const opponentMatch = notes.match(/Opponent:\s*([^|]+)/i)
    if (opponentMatch) {
        defaultInfo.characterName = opponentMatch[1].trim()
        // Generate initials from name
        const nameParts = defaultInfo.characterName.split(' ')
        defaultInfo.avatarInitials = nameParts.map(p => p[0]).join('').substring(0, 2).toUpperCase()
    }

    return defaultInfo
}

// Training AI Move Response Type (matches FIXED workflow response)
interface TrainingAIMoveResult {
    success: boolean
    decision?: 'accept' | 'counter' | 'hold' | 'reject'
    newProviderPosition?: number
    previousProviderPosition?: number
    providerResponse?: string          // Provider's negotiation message
    teachingMoment?: string            // Educational tip (string, not object)
    isAligned?: boolean                // Whether agreement was reached
    newGap?: number
    customerPosition?: number
    sessionState?: {                   // Session progress info
        clausesAgreed: number
        clausesRemaining: number
        totalClauses: number
        isComplete: boolean
    }
    error?: string
}

// Trigger AI counter-move in Training Mode (UPDATED to send all parameters)
async function triggerAICounterMove(
    sessionId: string,
    clauseId: string,
    positionId: string,
    newCustomerPosition: number,
    previousCustomerPosition: number | null,
    currentProviderPosition: number,
    clauseNumber: string,
    clauseName: string,
    aiPersonality: 'cooperative' | 'balanced' | 'aggressive',
    bidId: string | null
): Promise<TrainingAIMoveResult> {
    console.log('=== TRIGGERING AI COUNTER-MOVE (UPDATED) ===')
    console.log('Session ID:', sessionId)
    console.log('Clause:', clauseNumber, '-', clauseName)
    console.log('Customer NEW Position:', newCustomerPosition)
    console.log('Customer PREVIOUS Position:', previousCustomerPosition)
    console.log('Provider Current Position:', currentProviderPosition)
    console.log('AI Personality:', aiPersonality)
    console.log('Bid ID:', bidId)

    try {
        const response = await fetch(`${API_BASE}/training-ai-move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // FIXED: Now sending ALL required parameters to the workflow
                sessionId,
                clauseId,
                newCustomerPosition,           // Matches workflow expected field
                previousCustomerPosition,
                currentProviderPosition,
                clauseNumber,                  // NEW: Included for context
                clauseName,                    // NEW: Included for context
                aiPersonality,                 // NEW: Included for personality-based response
                bidId                          // NEW: Included for multi-provider support
            })
        })

        const result = await response.json()
        console.log('AI Move Result:', result)
        return result

    } catch (error) {
        console.error('Error calling AI move endpoint:', error)
        return { success: false, error: 'Failed to call AI endpoint' }
    }
}

// ============================================================================
// SECTION 2F: CLAUSE CONFIRMATION API
// ============================================================================

async function confirmClausePosition(
    sessionId: string,
    positionId: string,
    party: 'customer' | 'provider',
    confirmedPosition: number
): Promise<{ success: boolean; status?: string; message?: string; error?: string }> {
    try {
        const response = await fetch(`${API_BASE}/confirm-clause-position`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                position_id: positionId,
                party: party,
                confirmed_position: confirmedPosition
            })
        })

        if (!response.ok) {
            throw new Error('Failed to confirm clause position')
        }

        return await response.json()
    } catch (error) {
        console.error('Error confirming clause position:', error)
        return { success: false, error: 'Failed to confirm clause position' }
    }
}

async function withdrawClauseConfirmation(
    sessionId: string,
    positionId: string,
    party: 'customer' | 'provider'
): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const response = await fetch(`${API_BASE}/withdraw-clause-confirmation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                position_id: positionId,
                party: party
            })
        })

        if (!response.ok) {
            throw new Error('Failed to withdraw confirmation')
        }

        return await response.json()
    } catch (error) {
        console.error('Error withdrawing confirmation:', error)
        return { success: false, error: 'Failed to withdraw confirmation' }
    }
}

// ============================================================================
// SECTION 2D: DATA FETCH FUNCTIONS
// ============================================================================

function formatCurrency(value: string | number | null, currency: string): string {
    if (!value) return '£0'
    const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€'

    // Handle category-based deal values from Create Contract page
    const categoryLabels: Record<string, string> = {
        'under_50k': `Under ${symbol}50k`,
        '50k_250k': `${symbol}50k - ${symbol}250k`,
        '250k_1m': `${symbol}250k - ${symbol}1M`,
        'over_1m': `Over ${symbol}1M`,
        // Legacy formats
        'under_100k': `Under ${symbol}100k`,
        '100k_250k': `${symbol}100k - ${symbol}250k`,
        '250k_500k': `${symbol}250k - ${symbol}500k`,
        '500k_1m': `${symbol}500k - ${symbol}1M`,
    }

    // Check if it's a category string
    if (typeof value === 'string' && categoryLabels[value]) {
        return categoryLabels[value]
    }

    // Parse as number
    const num = typeof value === 'string' ? parseFloat(value.replace(/[£$€,]/g, '')) : value

    // Handle NaN
    if (isNaN(num)) return 'Not specified'

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

// ============================================================================
// SECTION 2E: ADD SUB-CLAUSE API
// ============================================================================

async function addSubClause(
    sessionId: string,
    parentPositionId: string,
    clauseName: string,
    description: string | null,
    addedByParty: 'customer' | 'provider',
    aiContext: string | null = null  // Add this parameter
): Promise<{ success: boolean; subClause?: ContractClause; error?: string }> {
    try {
        const response = await fetch(`${API_BASE}/add-sub-clause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                parent_position_id: parentPositionId,
                clause_name: clauseName,
                description: description,
                added_by_party: addedByParty,
                ai_context: aiContext  // Add this
            })
        })

        if (!response.ok) {
            throw new Error('Failed to add sub-clause')
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error('Error adding sub-clause:', error)
        return { success: false, error: 'Failed to add sub-clause' }
    }
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
// SECTION 2F: DEAL CONTEXT OPTIONS
// ============================================================================

const DEAL_VALUE_OPTIONS = [
    { value: 'under_50k', label: 'Under £50k' },
    { value: '50k_250k', label: '£50k - £250k' },
    { value: '250k_1m', label: '£250k - £1M' },
    { value: '1m_5m', label: '£1M - £5M' },
    { value: 'over_5m', label: 'Over £5M' }
]

const SERVICE_CRITICALITY_OPTIONS = [
    { value: 'low', label: 'Low', description: 'Non-essential service' },
    { value: 'medium', label: 'Medium', description: 'Important but not critical' },
    { value: 'high', label: 'High', description: 'Business-critical service' },
    { value: 'critical', label: 'Critical', description: 'Mission-critical, cannot fail' }
]

// ============================================================================
// SECTION 3: LEVERAGE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate leverage impact for a position move
 * COOPERATIVE MODEL: Moving toward agreement GAINS leverage
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
    // COOPERATIVE MODEL: Moving toward agreement = GAIN, Moving away = LOSS

    if (party === 'customer') {
        // Customer moving DOWN (toward provider) = toward agreement = GAINS
        if (positionDelta < 0) {
            return Math.round(impactMagnitude * 10) / 10  // Positive = gain
        }
        // Customer moving UP (away from provider) = away from agreement = LOSES
        return -Math.round(impactMagnitude * 10) / 10  // Negative = loss
    } else {
        // Provider moving UP (toward customer) = toward agreement = GAINS
        if (positionDelta > 0) {
            return Math.round(impactMagnitude * 10) / 10  // Positive = gain
        }
        // Provider moving DOWN (away from customer) = away from agreement = LOSES
        return -Math.round(impactMagnitude * 10) / 10  // Negative = loss
    }
}

/**
 * Recalculate the Leverage Tracker based on ALL position changes
 * COOPERATIVE MODEL: Moving toward agreement GAINS leverage
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

            // Customer moving DOWN = accommodating toward agreement = CUSTOMER GAINS
            if (custDelta < 0) {
                const impact = Math.abs(custDelta) * (weight / 5) * 1.0
                customerLeverageShift += impact  // Customer GAINS
                console.log(`${clause.clauseName}: Customer moved toward agreement (${origCustPos.toFixed(1)}←’${currCustPos.toFixed(1)}), Customer gains +${impact.toFixed(2)} (weight ${weight})`)
            }
            // Customer moving UP = moving away from agreement = CUSTOMER LOSES
            if (custDelta > 0) {
                const impact = Math.abs(custDelta) * (weight / 5) * 1.0
                customerLeverageShift -= impact  // Customer LOSES
                console.log(`${clause.clauseName}: Customer moved away from agreement (${origCustPos.toFixed(1)}←’${currCustPos.toFixed(1)}), Customer loses -${impact.toFixed(2)} (weight ${weight})`)
            }
        }

        // Check provider movement
        const origProvPos = clause.originalProviderPosition
        const currProvPos = clause.providerPosition

        if (origProvPos !== null && currProvPos !== null && origProvPos !== currProvPos) {
            const provDelta = currProvPos - origProvPos
            const weight = clause.providerWeight ?? 3

            // Provider moving UP = accommodating toward agreement = PROVIDER GAINS (customer loses)
            if (provDelta > 0) {
                const impact = provDelta * (weight / 5) * 1.0
                customerLeverageShift -= impact  // Customer LOSES (provider gained)
                console.log(`${clause.clauseName}: Provider moved toward agreement (${origProvPos.toFixed(1)}←’${currProvPos.toFixed(1)}), Provider gains +${impact.toFixed(2)} (weight ${weight})`)
            }
            // Provider moving DOWN = moving away from agreement = PROVIDER LOSES (customer gains)
            if (provDelta < 0) {
                const impact = Math.abs(provDelta) * (weight / 5) * 1.0
                customerLeverageShift += impact  // Customer GAINS (provider lost)
                console.log(`${clause.clauseName}: Provider moved away from agreement (${origProvPos.toFixed(1)}←’${currProvPos.toFixed(1)}), Provider loses -${impact.toFixed(2)} (weight ${weight})`)
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
        case 'position_change': return '←”'
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
        case 'agreed': return 'text-emerald-600'  // Add this
        case 'customer_confirmed': return 'text-amber-600'  // Add this
        case 'provider_confirmed': return 'text-amber-600'  // Add this
        case 'negotiating': return 'text-amber-600'
        case 'disputed': return 'text-red-600'
        default: return 'text-slate-400'
    }
}

function getStatusBgColor(status: string): string {
    switch (status) {
        case 'aligned': return 'bg-emerald-500'
        case 'agreed': return 'bg-emerald-500'  // Add this
        case 'customer_confirmed': return 'bg-amber-500'  // Add this
        case 'provider_confirmed': return 'bg-amber-500'  // Add this
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

const WORKING_TIMEOUT_MS = 45000 // 15 seconds

interface WorkingOverlayProps {
    workingState: WorkingState
    onRetry?: () => void
    onDismiss?: () => void
}

function WorkingOverlay({ workingState, onRetry, onDismiss }: WorkingOverlayProps) {
    const [elapsedTime, setElapsedTime] = useState(0)

    // DEBUG: Log every render of WorkingOverlay
    console.log('=== WorkingOverlay RENDER ===', {
        isWorking: workingState.isWorking,
        hasError: workingState.hasError,
        willReturnNull: !workingState.isWorking && !workingState.hasError
    })

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

    if (!workingState.isWorking && !workingState.hasError) {
        console.log('=== WorkingOverlay returning NULL ===')  // ADD THIS
        return null
    }

    console.log('=== WorkingOverlay SHOWING OVERLAY ===')  // ADD THIS

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
                                                    <span className="text-slate-400">←’</span>
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
// SECTION 5E: TRAINING MODE BANNER COMPONENT
// ============================================================================

interface TrainingModeBannerProps {
    scenarioName?: string
    aiPersonality?: string
    onExitTraining: () => void
}

function TrainingModeBanner({ scenarioName, aiPersonality, onExitTraining }: TrainingModeBannerProps) {
    return (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* Training Icon */}
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                    </div>

                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm tracking-wide">TRAINING MODE</span>
                            <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-medium">
                                Practice Session
                            </span>
                        </div>
                        <p className="text-xs text-amber-100">
                            {scenarioName ? `Scenario: ${scenarioName}` : 'Practicing with CLARENCE AI'}
                            {aiPersonality && ` • AI: ${aiPersonality}`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Info tooltip */}
                    <div className="hidden sm:flex items-center gap-2 text-xs text-amber-100">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>No real contracts affected</span>
                    </div>

                    {/* Exit Training Button */}
                    <button
                        onClick={onExitTraining}
                        className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition flex items-center gap-1.5"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                        </svg>
                        Exit Training
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
    const [rangeMappings, setRangeMappings] = useState<Map<string, RangeMapping>>(new Map())
    const [leverage, setLeverage] = useState<LeverageData | null>(null)
    const [selectedClause, setSelectedClause] = useState<ContractClause | null>(null)
    const [chatMessages, setChatMessages] = useState<ClauseChatMessage[]>([])
    const [chatInput, setChatInput] = useState('')
    const [isChatLoading, setIsChatLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'positions' | 'tradeoffs' | 'history' | 'draft'>('positions')
    const [showLeverageDetails, setShowLeverageDetails] = useState(false)
    const [negotiationHistory, setNegotiationHistory] = useState<NegotiationHistoryEntry[]>([])
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)
    const [historyFilter, setHistoryFilter] = useState<'all' | 'positions' | 'locks' | 'agreements'>('all')
    // ROLE MATRIX Phase 2: Dynamic position scale labels
    const [roleSessionId, setRoleSessionId] = useState<string | null>(null)
    const [roleUserId, setRoleUserId] = useState<string | null>(null)
    const { roleContext } = useRoleContext({ sessionId: roleSessionId, userId: roleUserId })

    // Deal Context Editing state
    const [isEditingDealContext, setIsEditingDealContext] = useState(false)
    const [editedDealValue, setEditedDealValue] = useState<string>('')
    const [editedServiceCriticality, setEditedServiceCriticality] = useState<string>('medium')
    const [isSavingDealContext, setIsSavingDealContext] = useState(false)

    // Preview Contract state
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
    // Training Mode state
    const [isTrainingMode, setIsTrainingMode] = useState(false)
    const [aiThinking, setAiThinking] = useState(false)
    const [aiThinkingClause, setAiThinkingClause] = useState<string | null>(null)
    const [trainingAvatarInfo, setTrainingAvatarInfo] = useState<TrainingAvatarInfo | null>(null)

    // ==========================================================================
    // SIGN OUT FUNCTION
    // ==========================================================================

    async function handleSignOut() {
        try {
            const supabase = createClient()
            await supabase.auth.signOut()
            localStorage.removeItem('clarence_auth')
            localStorage.removeItem('clarence_provider_session')
            localStorage.removeItem('providerSession')
            localStorage.removeItem('currentSessionId')
            localStorage.removeItem('currentSession')
            router.push('/provider')
        } catch (error) {
            console.error('Sign out error:', error)
            router.push('/provider')
        }
    }

    // ============================================================================
    // SECTION 6X: SUB-CLAUSE MODAL STATE
    // ============================================================================

    const [showAddSubClauseModal, setShowAddSubClauseModal] = useState(false)
    const [subClauseParent, setSubClauseParent] = useState<ContractClause | null>(null)
    const [newSubClauseName, setNewSubClauseName] = useState('')
    const [newSubClauseDescription, setNewSubClauseDescription] = useState('')
    const [isAddingSubClause, setIsAddingSubClause] = useState(false)
    const [newSubClauseReason, setNewSubClauseReason] = useState('')
    const [isConfirming, setIsConfirming] = useState(false)

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
    const [chatUnreadCount, setChatUnreadCount] = useState(0)
    const [isChatOpen, setIsChatOpen] = useState(false)

    // NEW: Messages to inject into Party Chat from outside (e.g., AI counter-move responses)
    const [pendingPartyChatMessages, setPendingPartyChatMessages] = useState<Array<{
        messageId: string
        senderType: 'customer' | 'provider'
        senderName: string
        messageText: string
        createdAt: string
    }>>([])

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
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)

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


    // ============================================================================
    // SECTION 6A: PROVIDER STATUS CHECK
    // ============================================================================

    // Determine if a provider has been invited (for hiding provider UI in Straight to Contract)
    const hasProviderInvited = useMemo(() => {
        // Check if session has a provider
        if (session?.providerId) return true

        // Check if any providers are available
        if (availableProviders && availableProviders.length > 0) return true

        // Check session status indicates provider involvement
        const providerStatuses = ['provider_invited', 'provider_intake', 'leverage_pending', 'ready', 'active']
        if (session?.status && providerStatuses.includes(session.status)) return true

        return false
    }, [session?.providerId, session?.status, availableProviders])

    //   ============================================================================
    // SECTION 6F: CLAUSE MANAGEMENT STATE (FOCUS-12)
    // ============================================================================

    // Add Clause Modal state
    const [showAddClauseModal, setShowAddClauseModal] = useState(false)
    const [newClauseName, setNewClauseName] = useState('')
    const [newClauseCategory, setNewClauseCategory] = useState('')
    const [newClauseDescription, setNewClauseDescription] = useState('')
    const [newClauseReason, setNewClauseReason] = useState('')
    const [newClausePosition, setNewClausePosition] = useState<number>(5)
    const [newClauseProposedLanguage, setNewClauseProposedLanguage] = useState('')
    const [isAddingClause, setIsAddingClause] = useState(false)

    // N/A Modal state
    const [showNaModal, setShowNaModal] = useState(false)
    const [naTargetClause, setNaTargetClause] = useState<ContractClause | null>(null)
    const [naReason, setNaReason] = useState('')
    const [isMarkingNa, setIsMarkingNa] = useState(false)

    // Show/hide N/A clauses section
    const [showNaClauses, setShowNaClauses] = useState(false)

    // Available categories for new clauses
    const CLAUSE_CATEGORIES = [
        'Service',
        'Charges and Payment',
        'Term and Termination',
        'Service Levels',
        'Governance',
        'Staff',
        'Liability',
        'Change',
        'General',
        'Custom'
    ]

    // ========================================================================
    // STRAIGHT TO CONTRACT - PROGRESSIVE LOADING STATE
    // ========================================================================
    const [isStraightToContract, setIsStraightToContract] = useState(false)
    const [isConfiguringClauses, setIsConfiguringClauses] = useState(false)
    const [clauseConfigProgress, setClauseConfigProgress] = useState<{
        total: number
        configured: number
        currentClauseName: string | null
        status: 'idle' | 'configuring' | 'complete' | 'error'
    }>({ total: 0, configured: 0, currentClauseName: null, status: 'idle' })

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

    const [tradeOffScope, setTradeOffScope] = useState<'thisClause' | 'allClauses'>('thisClause')

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

    // DEBUG: Log all working state changes
    useEffect(() => {
        console.log('=== WORKING STATE CHANGED ===', {
            isWorking: workingState.isWorking,
            type: workingState.type,
            message: workingState.message,
            hasError: workingState.hasError
        })
    }, [workingState])

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

    const loadContractData = useCallback(async (
        sessionId: string,
        viewerRole?: string,
        providerId?: string,
        userEmail?: string,
        userId?: string
    ) => {
        try {
            const roleParam = viewerRole ? `&viewer_role=${viewerRole}` : ''
            const providerParam = providerId ? `&provider_id=${providerId}` : ''
            const emailParam = userEmail ? `&user_email=${encodeURIComponent(userEmail)}` : ''
            const userIdParam = userId ? `&user_id=${encodeURIComponent(userId)}` : ''

            const response = await fetch(
                `${API_BASE}/contract-studio-api?session_id=${sessionId}${roleParam}${providerParam}${emailParam}${userIdParam}`
            )
            if (!response.ok) throw new Error('Failed to fetch')

            const data = await response.json()
            const status = data.session?.status || 'pending_provider'
            const mediationType = data.session?.mediation_type || data.session?.mediationType || null
            const isStraightToContract = mediationType === 'straight_to_contract'

            // Straight to Contract: Bypass provider requirement and go directly to studio
            if (isStraightToContract) {
                // Allow access even without provider - they can invite later
                setSessionStatus('ready')
                // Continue to load full session data below...
            }
            else if (status === 'customer_assessment_complete' || status === 'pending_provider') {
                setSessionStatus('pending_provider')
                return null
            } else if (status === 'provider_invited' || status === 'providers_invited') {
                setSessionStatus('provider_invited')

                const basicSession: Session = {
                    sessionId: data.session.sessionId || sessionId,
                    sessionNumber: data.session.sessionNumber || '',
                    customerCompany: data.session.customerCompany || '',
                    providerCompany: data.session.providerCompany || 'Provider (Pending)',
                    providerId: data.session.providerId || null,
                    customerContactName: data.session.customerContactName || null,
                    providerContactName: null,
                    serviceType: data.session.contractType || 'IT Services',
                    dealValue: formatCurrency(data.session.dealValue, data.session.currency || 'GBP'),
                    phase: parsePhaseFromState(data.session.phase),
                    status: data.session.status
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
                providerId: data.session.providerId || null,
                customerContactName: data.session.customerContactName || null,
                providerContactName: data.session.providerContactName || null,
                serviceType: data.session.contractType || 'IT Services',
                dealValue: formatCurrency(data.session.dealValue, data.session.currency || 'GBP'),
                phase: parsePhaseFromState(data.session.phase),
                status: data.session.status,
                createdAt: data.session.createdAt || null,
                templateName: data.session.templateName || null,
                templatePackId: data.session.templatePackId || null,
                clausesSelected: data.session.clausesSelected || false,
                clauseCount: data.session.clauseCount || 0,
                // TRAINING MODE ADDITIONS:
                isTraining: data.session.is_training || data.session.isTraining || false,
                notes: data.session.notes || null,
                // STRAIGHT TO CONTRACT OR FULL INTAKE:
                mediationType: data.session.mediationType || data.session.mediation_type || null,
                templateSource: data.session.templateSource || data.session.template_source || null
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
                    positionOptions: c.positionOptions || getPositionOptionsForClause({
                        positionOptions: null,
                        clauseName: c.clauseName
                    } as ContractClause),
                    // Confirmation fields
                    // Confirmation fields
                    customerConfirmedAt: c.customerConfirmedAt || null,
                    customerConfirmedPosition: c.customerConfirmedPosition != null ? Number(c.customerConfirmedPosition) : null,
                    providerConfirmedAt: c.providerConfirmedAt || null,
                    providerConfirmedPosition: c.providerConfirmedPosition != null ? Number(c.providerConfirmedPosition) : null,
                    agreementReachedAt: c.agreementReachedAt || null,
                    finalAgreedPosition: c.finalAgreedPosition != null ? Number(c.finalAgreedPosition) : null,
                    // Locking fields
                    isLocked: c.isLocked || c.is_locked || false,
                    lockedAt: c.lockedAt || c.locked_at || null,
                    lockedByUserId: c.lockedByUserId || c.locked_by_user_id || null
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

    // ========================================================================
    // STRAIGHT TO CONTRACT - BATCH AI CONFIGURATION
    // ========================================================================

    const triggerBatchAIConfiguration = useCallback(async (sessionId: string, clausesToConfigure: ContractClause[]) => {
        if (clausesToConfigure.length === 0) {
            setClauseConfigProgress(prev => ({ ...prev, status: 'complete' }))
            return
        }

        setIsConfiguringClauses(true)
        setClauseConfigProgress({
            total: clausesToConfigure.length,
            configured: 0,
            currentClauseName: null,
            status: 'configuring'
        })

        for (let i = 0; i < clausesToConfigure.length; i++) {
            const clause = clausesToConfigure[i]

            setClauseConfigProgress(prev => ({
                ...prev,
                configured: i,
                currentClauseName: clause.clauseName
            }))

            try {
                // Call AI to suggest range for this clause
                const response = await fetch(`${API_BASE}/clarence-suggest-range`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clause_id: clause.clauseId,
                        clause_name: clause.clauseName,
                        clause_content: clause.clauseContent,
                        clause_category: clause.category,
                        clause_number: clause.clauseNumber,
                        contract_id: null,
                        session_id: sessionId,
                        user_id: userInfo?.userId,
                        auto_configure: true  // Flag to auto-save the suggestion
                    })
                })

                const data = await response.json()

                if (data.success && data.suggestion) {
                    // Update local clause with the configured range
                    setClauses(prev => prev.map(c =>
                        c.clauseId === clause.clauseId
                            ? {
                                ...c,
                                customerPosition: data.suggestion.suggested_target ? parseFloat(data.suggestion.suggested_target) : 5,
                                originalCustomerPosition: data.suggestion.suggested_target ? parseFloat(data.suggestion.suggested_target) : 5,
                                status: 'pending' as const
                            }
                            : c
                    ))
                }

                // Small delay to avoid rate limiting
                if (i < clausesToConfigure.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 800))
                }

            } catch (error) {
                console.error(`Error configuring clause ${clause.clauseName}:`, error)
            }
        }

        setClauseConfigProgress(prev => ({
            ...prev,
            configured: clausesToConfigure.length,
            currentClauseName: null,
            status: 'complete'
        }))
        setIsConfiguringClauses(false)

    }, [userInfo])

    // ========================================================================
    // STRAIGHT TO CONTRACT - DETECT AND TRIGGER CONFIGURATION
    // ========================================================================

    useEffect(() => {
        if (!session || !clauses.length) return

        const isSTC = session.mediationType === 'straight_to_contract'
        setIsStraightToContract(isSTC)

        // For Straight to Contract with UPLOADED templates - may need AI configuration
        if (isSTC && session.templateSource === 'uploaded') {
            // Check which clauses need configuration (no customer position set)
            const unconfiguredClauses = clauses.filter(c =>
                c.customerPosition === null || c.customerPosition === undefined
            )

            if (unconfiguredClauses.length > 0 && clauseConfigProgress.status === 'idle') {
                triggerBatchAIConfiguration(session.sessionId, unconfiguredClauses)
            } else if (unconfiguredClauses.length === 0) {
                setClauseConfigProgress(prev => ({ ...prev, status: 'complete' }))
            }
        }
        // For Straight to Contract with EXISTING templates - clauses already have positions
        else if (isSTC && clauseConfigProgress.status !== 'complete') {
            // Existing templates come pre-configured, mark as complete immediately
            setClauseConfigProgress(prev => ({ ...prev, status: 'complete' }))
        }
    }, [session, clauses.length, clauseConfigProgress.status, triggerBatchAIConfiguration])

    // ========================================================================
    // STRAIGHT TO CONTRACT - PROGRESSIVE LOADING PANEL
    // ========================================================================

    const StraightToContractProgressPanel = () => {
        if (!isStraightToContract || clauseConfigProgress.status === 'complete') return null

        const progressPercent = clauseConfigProgress.total > 0
            ? (clauseConfigProgress.configured / clauseConfigProgress.total) * 100
            : 0

        return (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-800">CLARENCE is Analyzing Your Contract</h3>
                        <p className="text-sm text-slate-500">
                            Configuring clause {clauseConfigProgress.configured + 1} of {clauseConfigProgress.total}
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Progress</span>
                        <span>{Math.round(progressPercent)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                            className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                {/* Current Clause */}
                {clauseConfigProgress.currentClauseName && (
                    <div className="bg-white/60 rounded-lg px-3 py-2 text-sm">
                        <span className="text-slate-500">Now analyzing: </span>
                        <span className="font-medium text-slate-700">{clauseConfigProgress.currentClauseName}</span>
                    </div>
                )}

                {/* Info */}
                <p className="text-xs text-slate-500 mt-3">
                    💡 You can start reviewing configured clauses in the list while others are still processing.
                </p>
            </div>
        )
    }

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

    // ============================================================================
    // SECTION 7C: SWITCH PROVIDER (MULTI-PROVIDER SUPPORT)
    // ============================================================================

    const switchProvider = useCallback(async (providerId: string, providerCompany: string) => {
        if (!session?.sessionId) return

        console.log('Switching to provider:', providerCompany, providerId)
        setSelectedProviderId(providerId)
        setShowProviderDropdown(false)

        // Show loading state
        startWorking('provider_switch')

        try {
            // Reload all data for the selected provider
            const response = await fetch(
                `${API_BASE}/contract-studio-api?session_id=${session.sessionId}&provider_id=${providerId}`
            )

            if (!response.ok) throw new Error('Failed to fetch provider data')

            const data = await response.json()

            // Update session with new provider info
            setSession(prev => prev ? {
                ...prev,
                providerCompany: data.session.providerCompany
            } : null)

            // Update clauses with this provider's positions
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
                    positionOptions: c.positionOptions || getPositionOptionsForClause({
                        positionOptions: null,
                        clauseName: c.clauseName
                    } as ContractClause),
                    // Confirmation fields
                    // Confirmation fields
                    customerConfirmedAt: c.customerConfirmedAt || null,
                    customerConfirmedPosition: c.customerConfirmedPosition != null ? Number(c.customerConfirmedPosition) : null,
                    providerConfirmedAt: c.providerConfirmedAt || null,
                    providerConfirmedPosition: c.providerConfirmedPosition != null ? Number(c.providerConfirmedPosition) : null,
                    agreementReachedAt: c.agreementReachedAt || null,
                    finalAgreedPosition: c.finalAgreedPosition != null ? Number(c.finalAgreedPosition) : null,
                    // Locking fields
                    isLocked: c.isLocked || c.is_locked || false,
                    lockedAt: c.lockedAt || c.locked_at || null,
                    lockedByUserId: c.lockedByUserId || c.locked_by_user_id || null
                }
            })

            setClauses(clauseData)
            setClauseTree(buildClauseTree(clauseData))

            // Update leverage if available
            if (data.leverage) {
                setLeverage(data.leverage)
            }

            // Clear selected clause
            setSelectedClause(null)

            // Log the switch
            eventLogger.completed('contract_negotiation', 'provider_switched', {
                sessionId: session.sessionId,
                providerId: providerId,
                providerCompany: providerCompany
            })

            stopWorking()

        } catch (error) {
            console.error('Error switching provider:', error)
            setWorkingError('Failed to load provider data. Please try again.')
        }
    }, [session?.sessionId, startWorking, stopWorking, setWorkingError])


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
                stopWorking() // Ensure spinner stops after welcome loads
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

    // ========================================================================
    // SECTION 7A: INITIAL LOAD - WITH API VIEWER ROLE DETECTION (V10)
    // ========================================================================

    // Track if we've already started loading to prevent double calls
    const hasInitialized = useRef(false)

    // Initial load
    useEffect(() => {
        // Prevent double initialization (React Strict Mode / dependency changes)
        if (hasInitialized.current) return
        hasInitialized.current = true

        const init = async () => {
            const user = loadUserInfo()
            if (!user) return

            const sessionId = searchParams.get('session_id') || searchParams.get('session')
            const urlStatus = searchParams.get('status')
            const sessionNumber = searchParams.get('session_number')
            const providerIdFromUrl = searchParams.get('provider_id')

            if (!sessionId) {
                router.push('/auth/contracts-dashboard')
                return
            }

            // Handle pending_provider status
            if (urlStatus === 'pending_provider') {
                setSessionStatus('pending_provider')
                // For pending_provider, user is definitely the customer
                user.role = 'customer'
                setUserInfo(user)

                try {
                    const response = await fetch(`${API_BASE}/customer-requirements-api?session_id=${sessionId}`)
                    if (response.ok) {
                        const data = await response.json()

                        setSession({
                            sessionId: sessionId,
                            sessionNumber: data.sessionNumber || sessionNumber || '',
                            customerCompany: data.companyName || data.company_name || user.company || '',
                            providerCompany: 'Provider (Pending)',
                            providerId: null,
                            customerContactName: data.contactName || data.contact_name || user.firstName || '',
                            providerContactName: null,
                            serviceType: data.serviceRequired || data.service_required || 'IT Services',
                            dealValue: formatCurrency(data.dealValue || data.deal_value, data.currency || 'GBP'),
                            phase: 1,
                            status: 'pending_provider'
                        })
                    } else {
                        setSession({
                            sessionId: sessionId,
                            sessionNumber: sessionNumber || '',
                            customerCompany: user.company || 'Your Company',
                            providerCompany: 'Awaiting Provider',
                            providerId: null,
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
                        providerId: null,
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
                stopWorking()
                return
            }

            // ================================================================
            // LOAD CONTRACT DATA WITH VIEWER ROLE DETECTION
            // ================================================================

            // Determine which provider_id to load
            let providerIdToLoad: string | undefined = undefined

            // First priority: provider_id from URL (works for both customer and provider)
            if (providerIdFromUrl) {
                providerIdToLoad = providerIdFromUrl
                console.log('Using provider_id from URL:', providerIdToLoad)
            }
            // Fallback for providers: check localStorage (only if URL doesn't have it)
            else {
                try {
                    const providerSession = localStorage.getItem('clarence_provider_session') || localStorage.getItem('providerSession')
                    if (providerSession) {
                        const parsed = JSON.parse(providerSession)
                        // Only use if session matches current session
                        if (parsed.sessionId === sessionId) {
                            providerIdToLoad = parsed.providerId
                            console.log('Provider loading from localStorage, provider_id:', providerIdToLoad)
                        }
                    }
                } catch (e) {
                    console.error('Error getting provider_id from localStorage:', e)
                }
            }

            // Build API URL with user email for role detection
            const userEmail = user.email || ''
            const userId = user.userId || ''
            const roleParam = user.role ? `&viewer_role=${user.role}` : ''
            const providerParam = providerIdToLoad ? `&provider_id=${providerIdToLoad}` : ''
            const emailParam = userEmail ? `&user_email=${encodeURIComponent(userEmail)}` : ''
            const userIdParam = userId ? `&user_id=${encodeURIComponent(userId)}` : ''

            const apiUrl = `${API_BASE}/contract-studio-api?session_id=${sessionId}${roleParam}${providerParam}${emailParam}${userIdParam}`
            console.log('Fetching contract data with URL:', apiUrl)

            try {
                const response = await fetch(apiUrl)
                if (!response.ok) throw new Error('Failed to fetch')

                const data = await response.json()
                const status = data.session?.status || 'pending_provider'

                // Handle various session statuses
                if (status === 'customer_assessment_complete' || status === 'pending_provider') {
                    setSessionStatus('pending_provider')
                    user.role = 'customer'
                    setUserInfo(user)
                    setLoading(false)
                    stopWorking()
                    return
                } else if (status === 'provider_invited' || status === 'providers_invited') {
                    setSessionStatus('provider_invited')
                    const basicSession: Session = {
                        sessionId: data.session.sessionId || sessionId,
                        sessionNumber: data.session.sessionNumber || '',
                        customerCompany: data.session.customerCompany || '',
                        providerCompany: 'Awaiting Provider Response',
                        providerId: null,
                        customerContactName: data.session.customerContactName || null,
                        providerContactName: null,
                        serviceType: data.session.contractType || 'Service Agreement',
                        dealValue: formatCurrency(data.session.dealValue, data.session.currency || 'GBP'),
                        phase: 1,
                        status: status
                    }
                    setSession(basicSession)
                    // Viewer is customer if they can see this status
                    user.role = 'customer'
                    setUserInfo(user)
                    setLoading(false)
                    stopWorking()
                    return
                } else if (status === 'provider_intake_complete' || status === 'leverage_pending') {
                    setSessionStatus('leverage_pending')
                    setLoading(false)
                    stopWorking()
                    return
                }

                setSessionStatus('ready')

                // ============================================================
                // CRITICAL: USE API's VIEWER ROLE INSTEAD OF LOCALSTORAGE
                // ============================================================

                const apiViewerRole = data.session?.viewer?.role
                console.log('=== VIEWER ROLE FROM API ===')
                console.log('API viewer.role:', apiViewerRole)
                console.log('localStorage role:', user.role)

                // Trust API's viewer role if it returns a valid one
                if (apiViewerRole === 'customer' || apiViewerRole === 'provider') {
                    if (user.role !== apiViewerRole) {
                        console.log(`Role mismatch detected! Changing from ${user.role} to ${apiViewerRole}`)
                    }
                    user.role = apiViewerRole
                } else if (apiViewerRole === 'unknown') {
                    // API couldn't determine role - use fallback logic
                    console.log('API could not determine role, using fallback logic')

                    // If provider_id in URL, likely a provider
                    if (providerIdFromUrl) {
                        user.role = 'provider'
                        console.log('Fallback: provider (provider_id in URL)')
                    } else {
                        // Default to customer (safer assumption)
                        user.role = 'customer'
                        console.log('Fallback: customer (default)')
                    }
                }
                // If API returns no viewer object at all (old API version), use existing logic
                else if (!data.session?.viewer) {
                    console.log('API did not return viewer object - using localStorage role with fallback')
                    // If no provider_id in URL and localStorage says provider, 
                    // check if this is the same session
                    if (user.role === 'provider' && !providerIdFromUrl) {
                        try {
                            const providerSession = localStorage.getItem('clarence_provider_session')
                            if (providerSession) {
                                const parsed = JSON.parse(providerSession)
                                if (parsed.sessionId !== sessionId) {
                                    // Different session - reset to customer
                                    user.role = 'customer'
                                    console.log('Reset to customer - localStorage session mismatch')
                                }
                            } else {
                                // No provider session stored - reset to customer
                                user.role = 'customer'
                                console.log('Reset to customer - no provider session in localStorage')
                            }
                        } catch (e) {
                            user.role = 'customer'
                            console.log('Reset to customer - parse error')
                        }
                    }
                }

                console.log('Final determined role:', user.role)
                setUserInfo(user)
                setRoleUserId(user.userId || null)

                // Update localStorage with correct role for this session
                try {
                    const authData = localStorage.getItem('clarence_auth')
                    if (authData) {
                        const parsed = JSON.parse(authData)
                        if (parsed.userInfo?.role !== user.role) {
                            parsed.userInfo = { ...parsed.userInfo, role: user.role }
                            localStorage.setItem('clarence_auth', JSON.stringify(parsed))
                            console.log('Updated localStorage role to:', user.role)
                        }
                    }
                } catch (e) {
                    console.error('Error updating localStorage role:', e)
                }

                // Build session data
                const sessionData: Session = {
                    sessionId: data.session.sessionId,
                    sessionNumber: data.session.sessionNumber,
                    customerCompany: data.session.customerCompany,
                    providerCompany: data.session.providerCompany || 'Provider (Pending)',
                    providerId: data.session.providerId || null,
                    bidId: data.session.bidId || null,
                    customerContactName: data.session.customerContactName || null,
                    providerContactName: data.session.providerContactName || null,
                    serviceType: data.session.contractType || 'IT Services',
                    dealValue: formatCurrency(data.session.dealValue, data.session.currency || 'GBP'),
                    phase: parsePhaseFromState(data.session.phase),
                    status: data.session.status,
                    templateName: data.session.templateName,
                    templatePackId: data.session.templatePackId,
                    clausesSelected: data.session.clausesSelected,
                    clauseCount: data.session.clauseCount,
                    isTraining: data.session.isTraining || false,
                    notes: data.session.notes,
                    mediationType: data.session.mediationType,
                    templateSource: data.session.templateSource
                }

                // Parse clauses
                const clauseData: ContractClause[] = (data.clauses || []).map((c: ApiClauseResponse) => {
                    const customerPos = c.customerPosition ? parseFloat(String(c.customerPosition)) : null
                    const providerPos = c.providerPosition ? parseFloat(String(c.providerPosition)) : null

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
                            ? parseFloat(String(c.originalCustomerPosition))
                            : customerPos,
                        originalProviderPosition: c.originalProviderPosition != null
                            ? parseFloat(String(c.originalProviderPosition))
                            : providerPos,
                        currentCompromise: c.currentCompromise ? parseFloat(String(c.currentCompromise)) : null,
                        clarenceRecommendation: c.aiSuggestedCompromise ? parseFloat(String(c.aiSuggestedCompromise)) : null,
                        industryStandard: null,
                        gapSize: c.gapSize ? parseFloat(String(c.gapSize)) : 0,
                        customerWeight: c.customerWeight,
                        providerWeight: c.providerWeight,
                        isDealBreakerCustomer: c.isDealBreakerCustomer,
                        isDealBreakerProvider: c.isDealBreakerProvider,
                        clauseContent: c.clauseContent,
                        customerNotes: c.customerNotes,
                        providerNotes: c.providerNotes,
                        status: c.status as 'aligned' | 'negotiating' | 'disputed' | 'pending' | 'agreed' | 'customer_confirmed' | 'provider_confirmed',
                        isExpanded: c.isExpanded,
                        positionOptions: c.positionOptions || getPositionOptionsForClause({
                            positionOptions: null,
                            clauseName: c.clauseName
                        } as ContractClause),
                        sourceType: c.sourceType as 'legacy' | 'template' | 'master' | 'custom' | undefined,
                        sourceMasterClauseId: c.sourceMasterClauseId,
                        sourceTemplateClauseId: c.sourceTemplateClauseId,
                        addedMidSession: c.addedMidSession,
                        addedByParty: c.addedByParty as 'customer' | 'provider' | null | undefined,
                        aiContext: c.aiContext,
                        negotiationGuidance: c.negotiationGuidance,
                        isCategoryHeader: c.isCategoryHeader,
                        customerConfirmedAt: c.customerConfirmedAt,
                        customerConfirmedPosition: c.customerConfirmedPosition,
                        providerConfirmedAt: c.providerConfirmedAt,
                        providerConfirmedPosition: c.providerConfirmedPosition,
                        agreementReachedAt: c.agreementReachedAt,
                        finalAgreedPosition: c.finalAgreedPosition,
                        isAgreed: c.isAgreed,
                        isCustomerConfirmed: c.isCustomerConfirmed,
                        isProviderConfirmed: c.isProviderConfirmed
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

                console.log('=== CLAUSE DATA DEBUG ===')
                console.log('Clauses from API:', clauseData.length)

                setSession(sessionData)
                setRoleSessionId(sessionData.sessionId)
                setIsTrainingMode(sessionData.isTraining || false)

                // Extract avatar info for training mode (for Party Chat AI integration)
                if (sessionData.isTraining) {
                    const avatarInfo = extractTrainingAvatarInfo(
                        sessionData.notes || null,
                        sessionData.providerCompany
                    )
                    setTrainingAvatarInfo(avatarInfo)
                    console.log('Training Avatar Info:', avatarInfo)
                } else {
                    setTrainingAvatarInfo(null)
                }

                setClauses(clauseData)
                const tree = buildClauseTree(clauseData)
                console.log('Clause tree length:', tree.length)
                setClauseTree(tree)
                setLeverage(leverageData)

                // Load range mappings for this session's clauses
                const clauseIds = clauseData.map(c => c.clauseId)
                if (clauseIds.length > 0) {
                    const supabaseClient = createClient()
                    const { data: rangeMappingData } = await supabaseClient
                        .from('clause_range_mappings')
                        .select('clause_id, contract_id, is_displayable, value_type, range_unit, industry_standard_min, industry_standard_max, range_data')
                        .in('clause_id', clauseIds)
                        .eq('is_displayable', true)

                    if (rangeMappingData && rangeMappingData.length > 0) {
                        const mappingMap = new Map<string, RangeMapping>()
                        for (const rm of rangeMappingData) {
                            mappingMap.set(rm.clause_id, {
                                clauseId: rm.clause_id,
                                contractId: rm.contract_id,
                                isDisplayable: rm.is_displayable,
                                valueType: rm.value_type,
                                rangeUnit: rm.range_unit,
                                industryStandardMin: rm.industry_standard_min,
                                industryStandardMax: rm.industry_standard_max,
                                rangeData: rm.range_data as RangeMappingData
                            })
                        }
                        setRangeMappings(mappingMap)
                    }
                }

                const messages = await loadClauseChat(sessionId, null)
                setChatMessages(messages)

                const otherRole = user.role === 'customer' ? 'provider' : 'customer'
                const partyStatus = await checkPartyStatus(sessionId, otherRole)
                setOtherPartyStatus(partyStatus)

                // LOG: Contract Studio loaded successfully
                eventLogger.setSession(sessionId)
                eventLogger.setUser(user.userId || '')
                eventLogger.completed('contract_negotiation', 'contract_studio_loaded', {
                    sessionId: sessionId,
                    sessionNumber: sessionData.sessionNumber,
                    userRole: user.role,
                    roleSource: apiViewerRole ? 'api' : 'fallback',
                    clauseCount: clauseData.length,
                    alignmentPercentage: leverageData?.alignmentPercentage
                })

                // Stop the working overlay - data loaded successfully
                stopWorking()

            } catch (error) {
                console.error('Error fetching contract studio data:', error)
                // On error, default to customer role
                user.role = 'customer'
                setUserInfo(user)
                setSessionStatus('pending_provider')
                setWorkingError('Failed to load contract data. Please refresh the page.')
            }

            setLoading(false)
        }

        init()
    }, [searchParams, router, loadUserInfo, loadClauseChat, checkPartyStatus, buildClauseTree, stopWorking, formatCurrency, parsePhaseFromState, getPositionOptionsForClause])

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

    // Reset trade-off scope when clause changes
    useEffect(() => {
        if (selectedClause) {
            setTradeOffScope('thisClause')
            const opportunities = detectTradeOffOpportunities(clauses, selectedClause)
            setTradeOffOpportunities(opportunities)
            setSelectedTradeOff(null)
            setTradeOffExplanation(null)
        }
    }, [selectedClause?.clauseId])

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
                    change_type,
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

                // Determine event type from change_type column
                const eventType = change.change_type === 'clause_locked'
                    ? 'clause_locked' as const
                    : change.change_type === 'clause_unlocked'
                        ? 'clause_unlocked' as const
                        : 'position_change' as const

                // Build description based on event type
                let description: string
                if (change.change_type === 'clause_locked') {
                    description = `${displayName} locked ${change.clause_name} as non-negotiable`
                } else if (change.change_type === 'clause_unlocked') {
                    description = `${displayName} unlocked ${change.clause_name} for negotiation`
                } else {
                    description = `${displayName} moved position on ${change.clause_name}`
                }

                return {
                    id: change.id,
                    timestamp: change.changed_at,  // REAL TIMESTAMP FROM DB
                    eventType,
                    party: change.party as 'customer' | 'provider',
                    partyName: displayName,
                    clauseId: change.clause_id,
                    clauseName: change.clause_name || 'Unknown Clause',
                    clauseNumber: change.clause_number,
                    description,
                    oldValue: change.change_type === 'position_change' ? parseFloat(change.old_position) : undefined,
                    newValue: change.change_type === 'position_change' ? parseFloat(change.new_position) : undefined,
                    leverageImpact: change.change_type === 'position_change' ? (parseFloat(change.leverage_impact) || 0) : 0,
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
            // ========== ADD CONFIRMATION EVENTS FROM CLAUSE DATA ==========
            clauses.forEach(clause => {
                // Customer confirmed (but not yet fully agreed)
                if (clause.customerConfirmedAt) {
                    history.push({
                        id: `confirm-customer-${clause.clauseId}`,
                        timestamp: clause.customerConfirmedAt,
                        eventType: 'confirmation' as const,
                        party: 'customer' as const,
                        partyName: session.customerCompany,
                        clauseId: clause.clauseId,
                        clauseName: clause.clauseName,
                        clauseNumber: clause.clauseNumber,
                        description: `${session.customerCompany} confirmed position ${clause.customerConfirmedPosition?.toFixed(1)}`,
                        newValue: clause.customerConfirmedPosition || undefined,
                        seen: true
                    })
                }

                // Provider confirmed (but not yet fully agreed)
                if (clause.providerConfirmedAt) {
                    history.push({
                        id: `confirm-provider-${clause.clauseId}`,
                        timestamp: clause.providerConfirmedAt,
                        eventType: 'confirmation' as const,
                        party: 'provider' as const,
                        partyName: session.providerCompany,
                        clauseId: clause.clauseId,
                        clauseName: clause.clauseName,
                        clauseNumber: clause.clauseNumber,
                        description: `${session.providerCompany} confirmed position ${clause.providerConfirmedPosition?.toFixed(1)}`,
                        newValue: clause.providerConfirmedPosition || undefined,
                        seen: true
                    })
                }

                // Full agreement reached (both confirmed)
                if (clause.agreementReachedAt && clause.status === 'agreed') {
                    history.push({
                        id: `agreed-${clause.clauseId}`,
                        timestamp: clause.agreementReachedAt,
                        eventType: 'agreement' as const,
                        party: 'system' as const,
                        partyName: 'CLARENCE',
                        clauseId: clause.clauseId,
                        clauseName: clause.clauseName,
                        clauseNumber: clause.clauseNumber,
                        description: `🎓’ Agreement locked on ${clause.clauseName} at position ${clause.finalAgreedPosition?.toFixed(1)}`,
                        newValue: clause.finalAgreedPosition || undefined,
                        seen: true
                    })
                }
            })

            // Sort all history by timestamp (newest first)
            history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

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

    // ========================================================================
    // DEAL CONTEXT UPDATE HANDLER
    // ========================================================================

    const handleSaveDealContext = async () => {
        if (!session || !userInfo) return

        setIsSavingDealContext(true)

        try {
            const response = await fetch(`${API_BASE}/update-session-context`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: session.sessionId,
                    user_id: userInfo.userId,
                    deal_value: editedDealValue,
                    service_criticality: editedServiceCriticality
                })
            })

            if (!response.ok) throw new Error('Failed to update deal context')

            // Update local session state
            setSession(prev => prev ? {
                ...prev,
                dealValue: editedDealValue
            } : null)

            setIsEditingDealContext(false)

        } catch (err) {
            console.error('Error updating deal context:', err)
            // Could show error toast here
        } finally {
            setIsSavingDealContext(false)
        }
    }

    const openDealContextEditor = () => {
        setEditedDealValue(session?.dealValue || '')
        setEditedServiceCriticality('medium') // Default or load from session if stored
        setIsEditingDealContext(true)
    }

    // ============================================================================
    // SECTION 8a: SUB-CLAUSE HANDLERS
    // ============================================================================

    const handleOpenAddSubClause = (parentClause: ContractClause) => {
        setSubClauseParent(parentClause)
        setNewSubClauseName('')
        setNewSubClauseDescription('')
        setShowAddSubClauseModal(true)
    }

    const handleAddSubClause = async () => {
        if (!subClauseParent || !newSubClauseName.trim() || !newSubClauseReason.trim() || !session || !userInfo) return

        setIsAddingSubClause(true)

        // Build AI context from the reason
        const aiContext = `This sub-clause was added mid-negotiation by the ${userInfo.role}. 
Reason for adding: ${newSubClauseReason.trim()}
Parent clause: ${subClauseParent.clauseNumber} ${subClauseParent.clauseName}
The ${userInfo.role} wants to negotiate specific terms for this aspect of the contract.`

        try {
            const result = await addSubClause(
                session.sessionId,
                subClauseParent.positionId,
                newSubClauseName.trim(),
                newSubClauseDescription.trim() || null,
                userInfo.role as 'customer' | 'provider',
                aiContext  // Pass the context
            )

            if (result.success && result.subClause) {
                // Refresh clause data to show new sub-clause
                try {
                    const response = await fetch(`${API_BASE}/contract-studio-api?session_id=${session.sessionId}`)
                    if (response.ok) {
                        const data = await response.json()
                        if (data.clauses) {
                            const mappedClauses: ContractClause[] = data.clauses.map((c: ApiClauseResponse) => ({
                                positionId: c.positionId,
                                clauseId: c.clauseId,
                                clauseNumber: c.clauseNumber,
                                clauseName: c.clauseName,
                                category: c.category,
                                description: c.description,
                                parentPositionId: c.parentPositionId,
                                clauseLevel: c.clauseLevel,
                                displayOrder: c.displayOrder,
                                customerPosition: c.customerPosition ? parseFloat(String(c.customerPosition)) : null,
                                providerPosition: c.providerPosition ? parseFloat(String(c.providerPosition)) : null,
                                originalCustomerPosition: c.originalCustomerPosition ? parseFloat(String(c.originalCustomerPosition)) : null,
                                originalProviderPosition: c.originalProviderPosition ? parseFloat(String(c.originalProviderPosition)) : null,
                                currentCompromise: c.currentCompromise ? parseFloat(String(c.currentCompromise)) : null,
                                clarenceRecommendation: c.aiSuggestedCompromise ? parseFloat(String(c.aiSuggestedCompromise)) : null,
                                industryStandard: null,
                                gapSize: c.gapSize ? parseFloat(String(c.gapSize)) : 0,
                                customerWeight: c.customerWeight || 5,
                                providerWeight: c.providerWeight || 5,
                                isDealBreakerCustomer: c.isDealBreakerCustomer || false,
                                isDealBreakerProvider: c.isDealBreakerProvider || false,
                                clauseContent: c.clauseContent,
                                customerNotes: c.customerNotes,
                                providerNotes: c.providerNotes,
                                status: c.status as 'aligned' | 'negotiating' | 'disputed' | 'pending',
                                isExpanded: false,
                                positionOptions: c.positionOptions || null,
                                sourceType: c.sourceType || 'legacy',
                                addedMidSession: c.addedMidSession || false,
                                addedByParty: c.addedByParty || null,
                                // Confirmation fields
                                customerConfirmedAt: c.customerConfirmedAt || null,
                                customerConfirmedPosition: c.customerConfirmedPosition || null,
                                providerConfirmedAt: c.providerConfirmedAt || null,
                                providerConfirmedPosition: c.providerConfirmedPosition || null,
                                agreementReachedAt: c.agreementReachedAt || null,
                                finalAgreedPosition: c.finalAgreedPosition || null,
                                isAgreed: c.isAgreed || false,
                                isCustomerConfirmed: c.isCustomerConfirmed || false,
                                isProviderConfirmed: c.isProviderConfirmed || false,
                                // Locking fields
                                isLocked: c.isLocked || c.is_locked || false,
                                lockedAt: c.lockedAt || c.locked_at || null,
                                lockedByUserId: c.lockedByUserId || c.locked_by_user_id || null
                            }))
                            const tree = buildClauseTree(mappedClauses, clauseTree)
                            setClauseTree(tree)
                            setClauses(mappedClauses)
                        }
                    }
                } catch (refreshError) {
                    console.error('Error refreshing clauses:', refreshError)
                }


                // Close modal
                setShowAddSubClauseModal(false)
                setSubClauseParent(null)
                setNewSubClauseName('')
                setNewSubClauseDescription('')
                setNewSubClauseReason('')  // Add this line

                // Select the new sub-clause
                if (result.subClause) {
                    setSelectedClause(result.subClause as ContractClause)
                }
            } else {
                alert(result.error || 'Failed to add sub-clause')
            }
        } catch (error) {
            console.error('Error adding sub-clause:', error)
            alert('Failed to add sub-clause')
        } finally {
            setIsAddingSubClause(false)
        }
    }

    // ============================================================================
    // SECTION 7X: CLAUSE MANAGEMENT HANDLERS (FOCUS-12)
    // ============================================================================

    // Open Add Clause modal
    const handleOpenAddClause = () => {
        setNewClauseName('')
        setNewClauseCategory('')
        setNewClauseDescription('')
        setNewClauseReason('')
        setNewClausePosition(5)
        setNewClauseProposedLanguage('')
        setShowAddClauseModal(true)
    }

    // Add new clause (placeholder - sends to N8N API)
    const handleAddClause = async () => {
        if (!session?.sessionId || !newClauseName.trim() || !newClauseCategory || !newClauseReason.trim()) {
            return
        }

        setIsAddingClause(true)

        try {
            // Get the current provider's bid_id if provider role
            let bidId = null
            if (userInfo?.role === 'provider') {
                const providerSession = localStorage.getItem('clarence_provider_session') || localStorage.getItem('providerSession')
                if (providerSession) {
                    const parsed = JSON.parse(providerSession)
                    const currentProvider = availableProviders.find(p => p.providerId === parsed.providerId)
                    bidId = currentProvider?.bidId
                }
            } else {
                // Customer - use selected provider or first provider
                const targetProvider = availableProviders.find(p => p.isCurrentProvider) || availableProviders[0]
                bidId = targetProvider?.bidId
            }

            const response = await fetch(`${API_BASE}/add-clause-api`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: session.sessionId,
                    bidId: bidId,
                    clauseName: newClauseName.trim(),
                    category: newClauseCategory,
                    description: newClauseDescription.trim(),
                    reason: newClauseReason.trim(),
                    initialPosition: newClausePosition,
                    proposedLanguage: newClauseProposedLanguage.trim(),
                    addedByParty: userInfo?.role,
                    addedByUserId: userInfo?.userId
                })
            })

            if (!response.ok) {
                throw new Error('Failed to add clause')
            }

            const result = await response.json()
            console.log('Clause added:', result)

            // Refresh clauses from API
            const providerIdToLoad = userInfo?.role === 'provider' ? selectedProviderId : undefined
            const data = await loadContractData(session.sessionId, userInfo?.role, providerIdToLoad || undefined)
            if (data) {
                setClauses(data.clauses)
                setClauseTree(buildClauseTree(data.clauses))
            }

            // Close modal and reset
            setShowAddClauseModal(false)
            setNewClauseName('')
            setNewClauseCategory('')
            setNewClauseDescription('')
            setNewClauseReason('')
            setNewClausePosition(5)
            setNewClauseProposedLanguage('')

        } catch (error) {
            console.error('Error adding clause:', error)
            alert('Failed to add clause. Please try again.')
        } finally {
            setIsAddingClause(false)
        }
    }

    // Open Mark as N/A modal
    const handleOpenNaModal = (clause: ContractClause) => {
        setNaTargetClause(clause)
        setNaReason('')
        setShowNaModal(true)
    }

    // Mark clause as N/A
    const handleMarkAsNa = async () => {
        if (!session?.sessionId || !naTargetClause) {
            return
        }

        setIsMarkingNa(true)

        try {
            const response = await fetch(`${API_BASE}/mark-clause-na-api`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: session.sessionId,
                    positionId: naTargetClause.positionId,
                    clauseId: naTargetClause.clauseId,
                    isApplicable: false,
                    markedNaBy: userInfo?.role,
                    naReason: naReason.trim()
                })
            })

            if (!response.ok) {
                throw new Error('Failed to mark clause as N/A')
            }

            // Update local state
            const updateClauseNa = (clauseList: ContractClause[]): ContractClause[] => {
                return clauseList.map(c => {
                    if (c.positionId === naTargetClause.positionId) {
                        return {
                            ...c,
                            isApplicable: false,
                            markedNaBy: userInfo?.role as 'customer' | 'provider',
                            markedNaAt: new Date().toISOString(),
                            naReason: naReason.trim()
                        }
                    }
                    if (c.children) {
                        return { ...c, children: updateClauseNa(c.children) }
                    }
                    return c
                })
            }

            setClauses(updateClauseNa(clauses))
            setClauseTree(updateClauseNa(clauseTree))

            // Close modal
            setShowNaModal(false)
            setNaTargetClause(null)
            setNaReason('')

            // Clear selection if the marked clause was selected
            if (selectedClause?.positionId === naTargetClause.positionId) {
                setSelectedClause(null)
            }

        } catch (error) {
            console.error('Error marking clause as N/A:', error)
            alert('Failed to mark clause as N/A. Please try again.')
        } finally {
            setIsMarkingNa(false)
        }
    }

    // Restore clause from N/A
    const handleRestoreFromNa = async (clause: ContractClause) => {
        if (!session?.sessionId) return

        try {
            const response = await fetch(`${API_BASE}/mark-clause-na-api`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: session.sessionId,
                    positionId: clause.positionId,
                    clauseId: clause.clauseId,
                    isApplicable: true,
                    markedNaBy: null,
                    naReason: null
                })
            })

            if (!response.ok) {
                throw new Error('Failed to restore clause')
            }

            // Update local state
            const restoreClause = (clauseList: ContractClause[]): ContractClause[] => {
                return clauseList.map(c => {
                    if (c.positionId === clause.positionId) {
                        return {
                            ...c,
                            isApplicable: true,
                            markedNaBy: null,
                            markedNaAt: null,
                            naReason: null
                        }
                    }
                    if (c.children) {
                        return { ...c, children: restoreClause(c.children) }
                    }
                    return c
                })
            }

            setClauses(restoreClause(clauses))
            setClauseTree(restoreClause(clauseTree))

        } catch (error) {
            console.error('Error restoring clause:', error)
            alert('Failed to restore clause. Please try again.')
        }
    }

    // Get N/A clauses for display
    const getNaClauses = useCallback((): ContractClause[] => {
        const naClauses: ContractClause[] = []

        const findNaClauses = (clauseList: ContractClause[]) => {
            clauseList.forEach(clause => {
                if (clause.isApplicable === false) {
                    naClauses.push(clause)
                }
                if (clause.children) {
                    findNaClauses(clause.children)
                }
            })
        }

        findNaClauses(clauseTree)
        return naClauses
    }, [clauseTree])


    const handlePositionDrag = (newPosition: number) => {
        if (!selectedClause || !userInfo || !leverage) return

        // Don't allow position changes for agreed clauses
        if (selectedClause.isAgreed) return

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

    // ============================================================================
    // SECTION: handleSetPosition - FIXED VERSION
    // ============================================================================

    // ============================================================================
    // TRAINING MODE: Handle AI counter-move response and update state
    // ============================================================================
    const handleTrainingAIMove = async (
        clauseId: string,
        positionId: string,
        newCustomerPosition: number,
        previousCustomerPosition: number | null,
        currentProviderPosition: number,
        clauseNumber: string,
        clauseName: string
    ) => {
        // Don't trigger if not in training mode
        if (!isTrainingMode || !session) return

        const aiPersonality = extractAIPersonality(session.notes || null)
        // Use avatar name from extracted info, fallback to provider company or default
        const avatarName = trainingAvatarInfo?.characterName || session.providerCompany || 'AI Opponent'

        // Show loading state
        setAiThinking(true)
        setAiThinkingClause(clauseId)

        // Track start time for minimum thinking duration
        const startTime = Date.now()
        const MINIMUM_THINKING_TIME = 2000 // 2 seconds minimum for UX

        try {
            // Call the standalone function
            const result = await triggerAICounterMove(
                session.sessionId,
                clauseId,
                positionId,
                newCustomerPosition,
                previousCustomerPosition,
                currentProviderPosition,
                clauseNumber,
                clauseName,
                aiPersonality,
                session.bidId || null
            )

            // Ensure minimum thinking time has elapsed for better UX
            const elapsedTime = Date.now() - startTime
            if (elapsedTime < MINIMUM_THINKING_TIME) {
                await new Promise(resolve => setTimeout(resolve, MINIMUM_THINKING_TIME - elapsedTime))
            }

            if (result.success && result.newProviderPosition !== undefined) {
                // Update provider position in the clauses state
                setClauses(prev => prev.map(c => {
                    if (c.clauseId === clauseId) {
                        const newGap = calculateGapSize(newCustomerPosition, result.newProviderPosition!)
                        return {
                            ...c,
                            providerPosition: result.newProviderPosition!,
                            gapSize: newGap,
                            status: result.isAligned ? 'agreed' : determineClauseStatus(newGap),
                            isAgreed: result.isAligned || false
                        }
                    }
                    return c
                }))

                // Update the selected clause if it's the one that changed
                if (selectedClause?.clauseId === clauseId) {
                    setSelectedClause(prev => prev ? {
                        ...prev,
                        providerPosition: result.newProviderPosition!,
                        gapSize: calculateGapSize(newCustomerPosition, result.newProviderPosition!),
                        status: result.isAligned ? 'agreed' : prev.status,
                        isAgreed: result.isAligned || false
                    } : null)
                }

                // ==========================================================
                // Route AI response to PARTY CHAT (not CLARENCE Chat)
                // The opponent's words belong in the Party Chat panel.
                // Teaching moments stay in CLARENCE Chat (coach guidance).
                // ==========================================================
                if (result.providerResponse) {
                    const decisionEmoji = result.decision === 'accept' ? '✅'
                        : result.decision === 'counter' ? '↔️'
                            : '✋'

                    const decisionText = result.decision === 'accept'
                        ? `accepted your position`
                        : result.decision === 'counter'
                            ? `countered with position ${result.newProviderPosition?.toFixed(1)}`
                            : `is holding firm`

                    // ADD to Party Chat (opponent's response)
                    setPendingPartyChatMessages(prev => [...prev, {
                        messageId: `training-ai-${Date.now()}`,
                        senderType: 'provider' as const,
                        senderName: avatarName,
                        messageText: `${decisionEmoji} ${decisionText}\n\n"${result.providerResponse}"`,
                        createdAt: new Date().toISOString()
                    }])

                    // Bump unread count if Party Chat panel is closed
                    if (!isChatOpen) {
                        setChatUnreadCount(prev => prev + 1)
                    }

                    // Teaching moment stays in CLARENCE Chat (it's coach guidance, not opponent dialogue)
                    if (result.teachingMoment) {
                        const teachingMessage: ClauseChatMessage = {
                            messageId: `teaching-${Date.now()}`,
                            sessionId: session.sessionId,
                            positionId: positionId,
                            sender: 'clarence',
                            senderUserId: null,
                            message: `💡 **CLARENCE's Tip:** ${result.teachingMoment}`,
                            messageType: 'notification',
                            relatedPositionChange: false,
                            triggeredBy: 'training_ai_move',
                            createdAt: new Date().toISOString()
                        }
                        setChatMessages(prev => [...prev, teachingMessage])
                    }
                }

                // Show celebration if agreement reached
                if (result.isAligned) {
                    const celebrationMessage: ClauseChatMessage = {
                        messageId: `celebration-${Date.now()}`,
                        sessionId: session.sessionId,
                        positionId: positionId,
                        sender: 'clarence',
                        senderUserId: null,
                        message: `🎉 **Agreement Reached!** Both parties have aligned on **${clauseName}** at position ${newCustomerPosition.toFixed(1)}. Great negotiation!`,
                        messageType: 'notification',
                        relatedPositionChange: false,
                        triggeredBy: 'training_ai_move',
                        createdAt: new Date().toISOString()
                    }
                    setChatMessages(prev => [...prev, celebrationMessage])
                }

                // Refresh history to show the AI move
                await fetchNegotiationHistory()

                // Log session progress if available
                if (result.sessionState) {
                    console.log('Training Session Progress:', {
                        agreed: result.sessionState.clausesAgreed,
                        remaining: result.sessionState.clausesRemaining,
                        total: result.sessionState.totalClauses,
                        complete: result.sessionState.isComplete
                    })
                }

            } else {
                console.error('AI move failed:', result.error)

                // Show error message in chat
                const errorMessage: ClauseChatMessage = {
                    messageId: `error-${Date.now()}`,
                    sessionId: session.sessionId,
                    positionId: positionId,
                    sender: 'clarence',
                    senderUserId: null,
                    message: `⚠️ The AI opponent is taking a moment to think. Your position has been saved - they will respond shortly.`,
                    messageType: 'notification',
                    relatedPositionChange: false,
                    triggeredBy: 'training_ai_move',
                    createdAt: new Date().toISOString()
                }
                setChatMessages(prev => [...prev, errorMessage])
            }

        } catch (error) {
            console.error('Error in training AI move:', error)
        } finally {
            // Small delay before clearing thinking state
            setTimeout(() => {
                setAiThinking(false)
                setAiThinkingClause(null)
            }, 500)
        }
    }

    const handleSetPosition = async () => {
        if (!selectedClause || !userInfo || !session || !leverage || proposedPosition === null) return

        // Don't allow position changes for agreed clauses
        if (selectedClause.isAgreed) return

        const currentPosition = userInfo.role === 'customer'
            ? selectedClause.customerPosition
            : userInfo.role === 'provider'
                ? selectedClause.providerPosition
                : null  // For admin, we'll determine from session context

        // For admin role, check both positions to see if proposedPosition matches current
        const customerPos = selectedClause.customerPosition
        const providerPos = selectedClause.providerPosition

        if (currentPosition === proposedPosition) {
            setIsAdjusting(false)
            return
        }

        // Start working overlay
        startWorking('position_commit')
        setIsCommitting(true)

        try {
            // ============================================================
            // CALCULATE NEW LEVERAGE BEFORE API CALL
            // We'll use a preliminary party guess, but API response is authoritative
            // ============================================================
            const preliminaryParty = userInfo.role === 'customer' || userInfo.role === 'provider'
                ? userInfo.role
                : 'customer'  // Default for admin - will be corrected by API

            const previewClauses = clauses.map(c => {
                if (c.positionId === selectedClause.positionId) {
                    return {
                        ...c,
                        customerPosition: preliminaryParty === 'customer' ? proposedPosition : c.customerPosition,
                        providerPosition: preliminaryParty === 'provider' ? proposedPosition : c.providerPosition,
                    }
                }
                return c
            })

            const newLeverage = recalculateLeverageTracker(
                leverage.leverageScoreCustomer,
                leverage.leverageScoreProvider,
                previewClauses,
                preliminaryParty as 'customer' | 'provider'
            )

            // ============================================================
            // COMMIT WITH CALCULATED LEVERAGE VALUES
            // ============================================================
            const result = await commitPositionChange(
                session.sessionId,
                selectedClause.positionId,
                userInfo.role as 'customer' | 'provider',  // API will resolve if needed
                proposedPosition,
                pendingLeverageImpact,
                {
                    userId: userInfo.userId,
                    userName: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || undefined,
                    companyName: userInfo.company,
                    newLeverageCustomer: newLeverage.customerLeverage,
                    newLeverageProvider: newLeverage.providerLeverage
                }
            )

            if (result.success) {
                // ============================================================
                // USE THE RESOLVED PARTY FROM API RESPONSE
                // This is the key fix - API returns the correct negotiation role
                // ============================================================
                const resolvedParty = (result as { success: boolean; positionUpdate?: { party: string } }).positionUpdate?.party || userInfo.role

                const updatedClauses = clauses.map(c => {
                    if (c.positionId === selectedClause.positionId) {
                        const newGap = calculateGapSize(
                            resolvedParty === 'customer' ? proposedPosition : c.customerPosition,
                            resolvedParty === 'provider' ? proposedPosition : c.providerPosition
                        )
                        return {
                            ...c,
                            customerPosition: resolvedParty === 'customer' ? proposedPosition : c.customerPosition,
                            providerPosition: resolvedParty === 'provider' ? proposedPosition : c.providerPosition,
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

                // Use the values we already calculated (before API call)
                setLeverage({
                    ...leverage,
                    leverageTrackerCustomer: newLeverage.customerLeverage,
                    leverageTrackerProvider: newLeverage.providerLeverage,
                    leverageTrackerCalculatedAt: new Date().toISOString()
                })

                // ============================================================
                // CLARENCE INTELLIGENT RESPONSE TO POSITION CHANGE
                // Also use resolvedParty here
                // ============================================================
                const newGap = calculateGapSize(
                    resolvedParty === 'customer' ? proposedPosition : selectedClause.customerPosition,
                    resolvedParty === 'provider' ? proposedPosition : selectedClause.providerPosition
                )
                const isNowAligned = newGap <= 1
                const clarenceRec = selectedClause.clarenceRecommendation
                const alignedWithClarence = clarenceRec !== null && Math.abs(proposedPosition - clarenceRec) < 0.5

                // Determine prompt type based on event
                let promptType: ClarencePromptType
                let triggeredBy: string
                if (isNowAligned) {
                    promptType = 'alignment_reached'
                    triggeredBy = 'alignment_reached'
                } else if (alignedWithClarence) {
                    promptType = 'recommendation_adopted'
                    triggeredBy = 'recommendation_adopted'
                } else {
                    promptType = 'position_change'
                    triggeredBy = 'position_change'
                }

                // Call CLARENCE AI for intelligent response
                try {
                    const aiResponse = await callClarenceAI(session.sessionId, promptType, resolvedParty || 'customer', {
                        clauseId: selectedClause.clauseId,
                        positionChange: {
                            clauseName: selectedClause.clauseName,
                            clauseNumber: selectedClause.clauseNumber,
                            party: resolvedParty || 'customer',
                            oldPosition: currentPosition ?? 5,
                            newPosition: proposedPosition ?? 5,
                            newGapSize: newGap,
                            otherPartyPosition: resolvedParty === 'customer' ? selectedClause.providerPosition : selectedClause.customerPosition,
                            clarenceRecommendation: clarenceRec,
                            clauseWeight: resolvedParty === 'customer' ? selectedClause.customerWeight : selectedClause.providerWeight,
                            leverageImpact: pendingLeverageImpact,
                            customerLeverage: newLeverage.customerLeverage,
                            providerLeverage: newLeverage.providerLeverage,
                            isAligned: isNowAligned,
                            alignedWithClarence: alignedWithClarence
                        }
                    })

                    if (aiResponse?.success && aiResponse.response) {
                        const clarenceResponse: ClauseChatMessage = {
                            messageId: `clarence-position-${Date.now()}`,
                            sessionId: session.sessionId,
                            positionId: selectedClause.positionId,
                            sender: 'clarence',
                            senderUserId: null,
                            message: aiResponse.response,
                            messageType: 'auto_response',
                            relatedPositionChange: true,
                            triggeredBy: triggeredBy,
                            createdAt: new Date().toISOString()
                        }
                        setChatMessages(prev => [...prev, clarenceResponse])
                    }
                } catch (error) {
                    console.error('CLARENCE AI response error:', error)
                    // Fallback to simple message on error
                    const fallbackMessage = isNowAligned
                        ? '🎉 Agreement reached on **${selectedClause.clauseName}**! Both parties are now aligned.'
                        : alignedWithClarence
                            ? `Position updated to match CLARENCE recommendation on **${selectedClause.clauseName}**.`
                            : `Position updated on **${selectedClause.clauseName}**. Current gap: ${newGap.toFixed(1)} points.`

                    const clarenceResponse: ClauseChatMessage = {
                        messageId: `clarence-position-${Date.now()}`,
                        sessionId: session.sessionId,
                        positionId: selectedClause.positionId,
                        sender: 'clarence',
                        senderUserId: null,
                        message: fallbackMessage,
                        messageType: 'auto_response',
                        relatedPositionChange: true,
                        triggeredBy: triggeredBy,
                        createdAt: new Date().toISOString()
                    }
                    setChatMessages(prev => [...prev, clarenceResponse])
                }
                // ============================================================

                setIsAdjusting(false)
                setPendingLeverageImpact(0)
                // Refresh negotiation history to include the new move
                await fetchNegotiationHistory()

                // ============================================================
                // Clear the overlay BEFORE AI counter-move
                // The AI thinking has its own indicator (aiThinking state)
                // so the user can see the workspace while the AI responds
                // ============================================================
                stopWorking()

                // TRAINING MODE: Trigger AI opponent counter-move
                // Now runs WITHOUT the overlay - user can see the workspace
                // The aiThinking/aiThinkingClause states show a subtle
                // indicator on the clause while the AI is thinking
                // ============================================================
                if (isTrainingMode && resolvedParty === 'customer') {
                    // Don't await - let it run in the background
                    // so the user can see their position change first
                    handleTrainingAIMove(
                        selectedClause.clauseId,
                        selectedClause.positionId,
                        proposedPosition,
                        currentPosition,
                        selectedClause.providerPosition || 5,
                        selectedClause.clauseNumber,
                        selectedClause.clauseName
                    )
                }
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
            // Pre-calculate leverage BEFORE the API call
            const preCalcClauses = clauses.map(c => {
                if (c.positionId === selectedClause.positionId) {
                    const newGap = calculateGapSize(
                        userInfo.role === 'customer' ? originalPosition : c.customerPosition,
                        userInfo.role === 'provider' ? originalPosition : c.providerPosition
                    )
                    return {
                        ...c,
                        customerPosition: userInfo.role === 'customer' ? originalPosition : c.customerPosition,
                        providerPosition: userInfo.role === 'provider' ? originalPosition : c.providerPosition,
                        gapSize: newGap
                    }
                }
                return c
            })

            const preCalcLeverage = recalculateLeverageTracker(
                leverage.leverageScoreCustomer,
                leverage.leverageScoreProvider,
                preCalcClauses,
                userInfo.role as 'customer' | 'provider'
            )

            const result = await commitPositionChange(
                session.sessionId,
                selectedClause.positionId,
                userInfo.role as 'customer' | 'provider',
                originalPosition,
                0,
                {
                    userId: userInfo.userId,
                    userName: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || undefined,
                    companyName: userInfo.company,
                    newLeverageCustomer: preCalcLeverage.customerLeverage,
                    newLeverageProvider: preCalcLeverage.providerLeverage
                }
            )

            if (result.success) {
                setClauses(preCalcClauses)
                setClauseTree(buildClauseTree(preCalcClauses))

                const updatedSelectedClause = preCalcClauses.find(c => c.positionId === selectedClause.positionId)
                if (updatedSelectedClause) {
                    setSelectedClause(updatedSelectedClause)
                }

                setLeverage({
                    ...leverage,
                    leverageTrackerCustomer: preCalcLeverage.customerLeverage,
                    leverageTrackerProvider: preCalcLeverage.providerLeverage,
                    leverageTrackerCalculatedAt: new Date().toISOString()
                })

                setProposedPosition(originalPosition)
                setIsAdjusting(false)
                setPendingLeverageImpact(0)

                // Refresh negotiation history to include the reset
                await fetchNegotiationHistory()
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
    // SECTION 8Y: CLAUSE CONFIRMATION HANDLERS
    // ============================================================================

    const handleConfirmAgreement = async () => {
        if (!selectedClause || !session || !userInfo) return

        const myPosition = userInfo.role === 'customer'
            ? selectedClause.customerPosition
            : selectedClause.providerPosition

        if (myPosition === null) {
            alert('Cannot confirm - no position set')
            return
        }

        setIsConfirming(true)

        try {
            const result = await confirmClausePosition(
                session.sessionId,
                selectedClause.positionId,
                userInfo.role as 'customer' | 'provider',
                myPosition
            )

            if (result.success) {
                // ============================================================
                // TRAINING MODE: Auto-confirm for AI opponent after customer confirms
                // ============================================================
                if (isTrainingMode && userInfo.role === 'customer') {
                    // Show "AI is confirming" message
                    const confirmingMessage: ClauseChatMessage = {
                        messageId: `ai-confirming-${Date.now()}`,
                        sessionId: session.sessionId,
                        positionId: selectedClause.positionId,
                        sender: 'clarence',
                        senderUserId: null,
                        message: `⏳ **${session.providerContactName || 'AI Opponent'}** is reviewing your confirmation...`,
                        messageType: 'notification',
                        relatedPositionChange: false,
                        triggeredBy: 'training_auto_confirm',
                        createdAt: new Date().toISOString()
                    }
                    setChatMessages(prev => [...prev, confirmingMessage])

                    // Wait 2-3 seconds for realism, then auto-confirm for AI
                    await new Promise(resolve => setTimeout(resolve, 2500))

                    // Get the provider's current position for confirmation
                    const providerPosition = selectedClause.providerPosition

                    if (providerPosition !== null) {
                        const aiConfirmResult = await confirmClausePosition(
                            session.sessionId,
                            selectedClause.positionId,
                            'provider',
                            providerPosition
                        )

                        if (aiConfirmResult.success) {
                            // Add success message to chat
                            const confirmedMessage: ClauseChatMessage = {
                                messageId: `ai-confirmed-${Date.now()}`,
                                sessionId: session.sessionId,
                                positionId: selectedClause.positionId,
                                sender: 'clarence',
                                senderUserId: null,
                                message: `✅ **${session.providerContactName || 'AI Opponent'}** has confirmed the agreement!\n\n⚠ **Clause Locked:** ${selectedClause.clauseName} is now agreed at position ${providerPosition.toFixed(1)}.`,
                                messageType: 'notification',
                                relatedPositionChange: true,
                                triggeredBy: 'training_auto_confirm',
                                createdAt: new Date().toISOString()
                            }
                            setChatMessages(prev => [...prev, confirmedMessage])
                        }
                    }
                }
                // ============================================================

                // Refresh clause data
                try {
                    const response = await fetch(`${API_BASE}/contract-studio-api?session_id=${session.sessionId}`)
                    if (response.ok) {
                        const data = await response.json()
                        if (data.clauses) {
                            const mappedClauses: ContractClause[] = data.clauses.map((c: ApiClauseResponse) => ({
                                positionId: c.positionId,
                                clauseId: c.clauseId,
                                clauseNumber: c.clauseNumber,
                                clauseName: c.clauseName,
                                category: c.category,
                                description: c.description,
                                parentPositionId: c.parentPositionId,
                                clauseLevel: c.clauseLevel,
                                displayOrder: c.displayOrder,
                                customerPosition: c.customerPosition ? parseFloat(String(c.customerPosition)) : null,
                                providerPosition: c.providerPosition ? parseFloat(String(c.providerPosition)) : null,
                                originalCustomerPosition: c.originalCustomerPosition ? parseFloat(String(c.originalCustomerPosition)) : null,
                                originalProviderPosition: c.originalProviderPosition ? parseFloat(String(c.originalProviderPosition)) : null,
                                currentCompromise: c.currentCompromise ? parseFloat(String(c.currentCompromise)) : null,
                                clarenceRecommendation: c.aiSuggestedCompromise ? parseFloat(String(c.aiSuggestedCompromise)) : null,
                                industryStandard: null,
                                gapSize: c.gapSize ? parseFloat(String(c.gapSize)) : 0,
                                customerWeight: c.customerWeight || 5,
                                providerWeight: c.providerWeight || 5,
                                isDealBreakerCustomer: c.isDealBreakerCustomer || false,
                                isDealBreakerProvider: c.isDealBreakerProvider || false,
                                clauseContent: c.clauseContent,
                                customerNotes: c.customerNotes,
                                providerNotes: c.providerNotes,
                                status: c.status as 'aligned' | 'negotiating' | 'disputed' | 'pending',
                                isExpanded: false,
                                positionOptions: c.positionOptions || null,
                                sourceType: c.sourceType || 'legacy',
                                addedMidSession: c.addedMidSession || false,
                                addedByParty: c.addedByParty || null,
                                // Confirmation fields
                                customerConfirmedAt: c.customerConfirmedAt || null,
                                customerConfirmedPosition: c.customerConfirmedPosition || null,
                                providerConfirmedAt: c.providerConfirmedAt || null,
                                providerConfirmedPosition: c.providerConfirmedPosition || null,
                                agreementReachedAt: c.agreementReachedAt || null,
                                finalAgreedPosition: c.finalAgreedPosition || null,
                                isAgreed: c.isAgreed || false,
                                isCustomerConfirmed: c.isCustomerConfirmed || false,
                                isProviderConfirmed: c.isProviderConfirmed || false,
                                // Locking fields
                                isLocked: c.isLocked || c.is_locked || false,
                                lockedAt: c.lockedAt || c.locked_at || null,
                                lockedByUserId: c.lockedByUserId || c.locked_by_user_id || null,
                            }))
                            const tree = buildClauseTree(mappedClauses, clauseTree)
                            setClauseTree(tree)
                            setClauses(mappedClauses)

                            // Update selected clause
                            const updatedClause = mappedClauses.find(c => c.positionId === selectedClause.positionId)
                            if (updatedClause) {
                                setSelectedClause(updatedClause)
                            }
                        }
                    }
                } catch (refreshError) {
                    console.error('Error refreshing clauses:', refreshError)
                }
            } else {
                alert(result.error || 'Failed to confirm agreement')
            }
        } catch (error) {
            console.error('Error confirming agreement:', error)
            alert('Failed to confirm agreement')
        } finally {
            setIsConfirming(false)
        }
    }

    // ============================================================================
    // SECTION 8Z: CONTRACT PREVIEW HANDLER
    // ============================================================================

    const handlePreviewContract = useCallback(async () => {
        if (!session?.sessionId || isGeneratingPreview) return

        setIsGeneratingPreview(true)

        // Open blank window IMMEDIATELY (before async operation)
        // This is allowed because it's directly triggered by user click
        const previewWindow = window.open('', '_blank')

        // Show loading message in the new window
        if (previewWindow) {
            previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Generating Contract Preview...</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        background: #f8fafc;
                        color: #334155;
                    }
                    .spinner {
                        width: 40px;
                        height: 40px;
                        border: 4px solid #e2e8f0;
                        border-top-color: #10b981;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin-bottom: 20px;
                    }
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                    h2 { margin: 0 0 10px 0; font-size: 18px; }
                    p { margin: 0; color: #64748b; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="spinner"></div>
                <h2>Generating Contract Preview</h2>
                <p>Please wait while CLARENCE prepares your document...</p>
            </body>
            </html>
        `)
        }

        try {
            const response = await fetch('https://spikeislandstudios.app.n8n.cloud/webhook/document-contract-preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: session.sessionId,
                    user_id: userInfo?.userId,
                    provider_id: session.providerId || null,
                    viewer_role: userInfo?.role || 'customer'
                })
            })

            if (!response.ok) {
                throw new Error('Failed to generate preview')
            }

            const result = await response.json()
            console.log('Preview result:', result)

            if (result.success && result.pdf_url) {
                // Redirect the already-open window to the PDF
                if (previewWindow) {
                    previewWindow.location.href = result.pdf_url
                }
            } else {
                // Show error in the window
                if (previewWindow) {
                    previewWindow.document.body.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <h2 style="color: #dc2626;">Generation Failed</h2>
                        <p>Unable to generate the contract preview. Please close this window and try again.</p>
                    </div>
                `
                }
                console.error('Missing pdf_url:', result)
            }

        } catch (error) {
            console.error('Preview contract error:', error)
            // Show error in the window
            if (previewWindow) {
                previewWindow.document.body.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <h2 style="color: #dc2626;">Error</h2>
                    <p>An error occurred while generating the preview. Please close this window and try again.</p>
                </div>
            `
            }
        } finally {
            setIsGeneratingPreview(false)
        }
    }, [session?.sessionId, session?.providerId, userInfo?.userId, userInfo?.role, isGeneratingPreview])

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
            userInfo={userInfo}
            handleSignOut={handleSignOut}
        />
    }

    if (!session || !userInfo) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 mb-4">Failed to load contract data</p>
                    <button
                        onClick={() => userInfo?.role === 'provider' ? handleSignOut() : router.push('/auth/contracts-dashboard')}
                        className="px-6 py-2 text-slate-600 border border-slate-300 rounded-lg"
                    >
                        {userInfo?.role === 'provider' ? '← Sign Out' : '← Return to Dashboard'}
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
        const isLocked = selectedClause.isLocked || false
        const myDbPosition = isCustomer ? selectedClause.customerPosition : selectedClause.providerPosition
        const otherDbPosition = isCustomer ? selectedClause.providerPosition : selectedClause.customerPosition
        const originalDbPosition = isCustomer ? selectedClause.originalCustomerPosition : selectedClause.originalProviderPosition
        const clarenceDbPosition = selectedClause.clarenceRecommendation
        const myWeight = isCustomer ? selectedClause.customerWeight : selectedClause.providerWeight

        const hasChanged = originalDbPosition !== null && myDbPosition !== originalDbPosition
        const resolvedPositionOptions = getPositionOptionsForClause(selectedClause)
        const hasPositionOptions = resolvedPositionOptions !== null && resolvedPositionOptions.length > 0
        const positionOptionsArray = selectedClause.positionOptions
            ? (Array.isArray(selectedClause.positionOptions)
                ? selectedClause.positionOptions
                : (selectedClause.positionOptions as { options: PositionOption[] })?.options)
            : null
        const optionCount = positionOptionsArray?.length || 10

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

            // Handle both array format and nested object format
            const posOpts = selectedClause.positionOptions as PositionOption[] | { type: string; options: PositionOption[] } | null
            const optionsArray = Array.isArray(posOpts)
                ? posOpts
                : (posOpts as { options: PositionOption[] } | null)?.options

            const option = optionsArray?.find(o => o.value === optVal)
            return option?.label || `Position ${optVal}`
        }

        // RANGE MAPPING: Translate a 1-10 position to a real-world value
        const translatePosition = (position: number | null): { value: number; label: string; description: string } | null => {
            if (position === null || !selectedClause) return null
            const mapping = rangeMappings.get(selectedClause.clauseId)
            if (!mapping || !mapping.isDisplayable || !mapping.rangeData?.scale_points?.length) return null

            const points = mapping.rangeData.scale_points

            // Exact match
            const exact = points.find(p => Math.abs(p.position - position) < 0.1)
            if (exact) return exact

            // Interpolation
            const lower = [...points].filter(p => p.position <= position).pop()
            const upper = points.find(p => p.position > position)

            if (!lower || !upper) {
                return position <= points[0].position ? points[0] : points[points.length - 1]
            }

            const fraction = (position - lower.position) / (upper.position - lower.position)
            let interpolatedValue: number

            if (mapping.rangeData.interpolation === 'logarithmic') {
                const logLower = Math.log(lower.value || 1)
                const logUpper = Math.log(upper.value || 1)
                interpolatedValue = Math.exp(logLower + fraction * (logUpper - logLower))
            } else if (mapping.rangeData.interpolation === 'stepped') {
                return lower
            } else {
                interpolatedValue = lower.value + fraction * (upper.value - lower.value)
            }

            const precision = mapping.rangeData.display_precision ?? 0
            const rounded = Number(interpolatedValue.toFixed(precision))

            const label = mapping.rangeData.format_pattern
                .replace('{value}', rounded.toLocaleString())
                .replace('{unit}', mapping.rangeUnit || '')
                .trim()

            return {
                value: rounded,
                label: label,
                description: `Between ${lower.label} and ${upper.label}`
            }
        }

        const hasRangeMapping = selectedClause ? rangeMappings.has(selectedClause.clauseId) : false

        return (
            <div className="mb-3">
                {/* Header - CONDENSED */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isCustomer ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                        <h4 className="font-semibold text-slate-800 text-sm">Your Position</h4>
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

                {/* Locked Clause Banner */}
                {isLocked && (
                    <div className="mb-3 p-3 bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <div>
                            <div className="font-medium text-slate-800 text-sm">This clause is locked</div>
                            <div className="text-xs text-slate-500">
                                {isCustomer
                                    ? "You have locked this clause. Use the clause menu to unlock it."
                                    : `${session?.customerCompany || 'The customer'} has locked this clause as non-negotiable.`
                                }
                            </div>
                        </div>
                    </div>
                )}

                {/* Position Options View */}
                {hasPositionOptions ? (
                    <div className="space-y-2">
                        {(() => {
                            // Resolve position options - handle both API format and direct array
                            const resolvedOptions: PositionOption[] = (() => {
                                // Check for API nested format: { type: "options", options: [...] }
                                if (selectedClause.positionOptions &&
                                    typeof selectedClause.positionOptions === 'object' &&
                                    'options' in selectedClause.positionOptions &&
                                    Array.isArray((selectedClause.positionOptions as { options: PositionOption[] }).options)) {
                                    return (selectedClause.positionOptions as { options: PositionOption[] }).options
                                }
                                // Check for direct array format
                                if (Array.isArray(selectedClause.positionOptions)) {
                                    return selectedClause.positionOptions
                                }
                                // Fallback to empty array (shouldn't happen if hasPositionOptions is true)
                                return []
                            })()

                            // DEBUG: Position marker colors
                            console.log('=== POSITION DEBUG ===')
                            console.log('isCustomer:', isCustomer)
                            console.log('userInfo.role:', userInfo?.role)
                            console.log('myDbPosition:', myDbPosition)
                            console.log('otherDbPosition:', otherDbPosition)
                            console.log('selectedClause.customerPosition:', selectedClause.customerPosition)
                            console.log('selectedClause.providerPosition:', selectedClause.providerPosition)
                            // ============================================================
                            // COMPACT SPECTRUM BAR WITH ZONE LABELS
                            // FLIPPED: Customer (Green) on LEFT, Provider (Blue) on RIGHT
                            // ============================================================

                            // Convert DB positions (1-10) to percentage for bar placement
                            // FLIPPED: Value 10 (customer-friendly) = LEFT (0%), Value 1 (provider-friendly) = RIGHT (100%)
                            const toBarPercent = (dbPos: number | null) => dbPos !== null ? ((10 - dbPos) / 9) * 100 : null

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
                                if (pos === null || resolvedOptions.length === 0) return null
                                const zoneIndex = Math.min(
                                    Math.floor((pos - 1) / (9 / resolvedOptions.length)),
                                    resolvedOptions.length - 1
                                )
                                return resolvedOptions[zoneIndex]
                            }

                            const currentZone = getZoneForPosition(proposedPosition ?? myDbPosition)
                            const zoneCount = resolvedOptions.length || 4

                            // Handle bar click to set position - FLIPPED
                            const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
                                if (isLocked) return // Don't allow changes on locked clauses
                                const rect = e.currentTarget.getBoundingClientRect()
                                const clickPercent = ((e.clientX - rect.left) / rect.width) * 100
                                // FLIPPED: 0% = value 10, 100% = value 1
                                const newPosition = Math.round((10 - (clickPercent / 100) * 9) * 10) / 10
                                const clampedPosition = Math.max(1, Math.min(10, newPosition))
                                handlePositionDrag(clampedPosition)
                            }

                            // Reverse the options for display (customer-friendly first on left)
                            const reversedOptions = [...resolvedOptions].reverse()

                            return (
                                <div className="space-y-3">
                                    {/* Spectrum Labels - FLIPPED */}
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                            Customer-Friendly
                                        </span>
                                        <span className="flex items-center gap-1">
                                            Provider-Friendly
                                            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                                        </span>
                                    </div>

                                    {/* Main Interactive Bar - FLIPPED gradient */}
                                    <div
                                        className={`relative h-12 bg-gradient-to-r from-emerald-200 via-slate-100 to-blue-200 rounded-lg border transition-all ${isLocked
                                            ? 'border-slate-400 opacity-60 cursor-not-allowed'
                                            : 'border-slate-300 cursor-pointer hover:border-slate-400'
                                            }`}
                                        onClick={handleBarClick}
                                        title={isLocked ? "This clause is locked" : "Click to set your position"}
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
                                        {/* Other Party marker - ONLY show if provider has been invited */}
                                        {(hasProviderInvited || isTrainingMode) && otherBarPercent !== null && !isAligned && (
                                            <div
                                                className={`absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold z-10 shadow-md ${isOtherAtClarence ? 'ring-2 ring-purple-400 ring-offset-1' : ''}`}
                                                style={{
                                                    left: `${otherBarPercent}%`,
                                                    transform: 'translate(-50%, -50%)',
                                                    backgroundColor: isCustomer ? '#3b82f6' : '#10b981',
                                                    borderColor: isCustomer ? '#1d4ed8' : '#047857',
                                                    color: 'white'
                                                }}
                                                title={`${roleContext ? roleContext.counterpartyRoleLabel : (isCustomer ? 'Provider' : 'Customer')}: ${otherDbPosition?.toFixed(1)}`}
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

                                    {/* Zone Labels - REVERSED ORDER (customer-friendly on left) */}
                                    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${zoneCount}, 1fr)` }}>
                                        {reversedOptions.map((option, idx) => {
                                            const isCurrentZone = currentZone?.value === option.value
                                            // Calculate zone boundaries for reversed display
                                            const originalIdx = zoneCount - 1 - idx
                                            const zoneStart = 1 + (originalIdx * 9 / zoneCount)
                                            const zoneEnd = 1 + ((originalIdx + 1) * 9 / zoneCount)
                                            const hasMyPosition = myDbPosition !== null && myDbPosition >= zoneStart && myDbPosition < zoneEnd
                                            const hasOtherPosition = otherDbPosition !== null && otherDbPosition >= zoneStart && otherDbPosition < zoneEnd
                                            const hasClarence = clarenceDbPosition !== null && clarenceDbPosition >= zoneStart && clarenceDbPosition < zoneEnd

                                            return (
                                                <div
                                                    key={option.value}
                                                    onClick={() => {
                                                        if (isLocked) return // Don't allow changes on locked clauses
                                                        // Click zone to jump to zone midpoint
                                                        const midpoint = (zoneStart + zoneEnd) / 2
                                                        handlePositionDrag(Math.round(midpoint * 10) / 10)
                                                    }}
                                                    className={`p-2 rounded text-center transition-all ${isLocked
                                                        ? 'cursor-not-allowed opacity-60 ' + (isCurrentZone ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-500')
                                                        : 'cursor-pointer ' + (isCurrentZone ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600')
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

                                    {/* Current Zone Description — Enhanced with Range Mapping */}
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
                                                        {hasRangeMapping && translatePosition(proposedPosition ?? myDbPosition)
                                                            ? (
                                                                <>
                                                                    <span className="text-purple-700 font-bold">
                                                                        {translatePosition(proposedPosition ?? myDbPosition)?.label}
                                                                    </span>
                                                                    <span className="ml-2 text-xs text-slate-400">
                                                                        {currentZone.label}
                                                                    </span>
                                                                    <span className="ml-1 text-xs text-slate-400 font-mono">
                                                                        ({(proposedPosition ?? myDbPosition)?.toFixed(1)})
                                                                    </span>
                                                                </>
                                                            )
                                                            : (
                                                                <>
                                                                    {currentZone.label}
                                                                    <span className="ml-2 text-xs text-slate-400 font-mono">
                                                                        ({(proposedPosition ?? myDbPosition)?.toFixed(1)})
                                                                    </span>
                                                                </>
                                                            )
                                                        }
                                                    </div>
                                                </div>
                                                {isAdjusting && (
                                                    <span className="px-2 py-1 bg-amber-200 text-amber-800 text-xs font-medium rounded">
                                                        Unsaved
                                                    </span>
                                                )}
                                            </div>
                                            {hasRangeMapping && translatePosition(proposedPosition ?? myDbPosition) ? (
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {translatePosition(proposedPosition ?? myDbPosition)?.description}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-slate-500 mt-1">{currentZone.description}</p>
                                            )}
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
                                            <span>{roleContext ? roleContext.counterpartyRoleLabel : (isCustomer ? 'Provider' : 'Customer')}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                                            <span>CLARENCE</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                            <span>Proposed</span>
                                        </div>
                                        {hasProviderInvited && (
                                            <div className="flex items-center gap-1">
                                                <div className="w-3 h-3 rounded-full overflow-hidden flex">
                                                    <div className="w-1/2 h-full bg-emerald-500"></div>
                                                    <div className="w-1/2 h-full bg-blue-500"></div>
                                                </div>
                                                <span>Aligned</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })()
                        }
                    </div>

                ) : (
                    /* Numeric Slider Fallback - for clauses without position options - FLIPPED */
                    <div className="space-y-4">
                        {(() => {
                            // Convert DB positions (1-10) to percentage for marker placement
                            // FLIPPED: Value 10 (customer-friendly) = LEFT (0%), Value 1 (provider-friendly) = RIGHT (100%)
                            const toBarPercent = (dbPos: number | null) => dbPos !== null ? ((10 - dbPos) / 9) * 100 : null

                            const myBarPercent = toBarPercent(myDbPosition)
                            const otherBarPercent = toBarPercent(otherDbPosition)
                            const proposedBarPercent = toBarPercent(proposedPosition)

                            // Check for alignment
                            const isAligned = myDbPosition !== null && otherDbPosition !== null &&
                                Math.abs(myDbPosition - otherDbPosition) < 0.5

                            const isProposing = isAdjusting && proposedPosition !== myDbPosition

                            return (
                                <div className="space-y-3">
                                    {/* Spectrum Labels */}
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                            Customer-Friendly
                                        </span>
                                        <span className="flex items-center gap-1">
                                            Provider-Friendly
                                            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                                        </span>
                                    </div>

                                    {/* Position Bar with Markers */}
                                    <div
                                        className="relative h-12 bg-gradient-to-r from-emerald-200 via-slate-100 to-blue-200 rounded-lg border border-slate-300 cursor-pointer hover:border-slate-400 transition-all"
                                        onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect()
                                            const clickPercent = ((e.clientX - rect.left) / rect.width) * 100
                                            // FLIPPED: 0% = value 10, 100% = value 1
                                            const newPosition = Math.round((10 - (clickPercent / 100) * 9) * 10) / 10
                                            const clampedPosition = Math.max(1, Math.min(10, newPosition))
                                            handlePositionDrag(clampedPosition)
                                        }}
                                        title="Click to set your position"
                                    >
                                        {/* Other Party marker - ONLY show if provider has been invited */}
                                        {(hasProviderInvited || isTrainingMode) && otherBarPercent !== null && !isAligned && (
                                            <div
                                                className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold z-10 shadow-md"
                                                style={{
                                                    left: `${otherBarPercent}%`,
                                                    transform: 'translate(-50%, -50%)',
                                                    backgroundColor: isCustomer ? '#3b82f6' : '#10b981',
                                                    borderColor: isCustomer ? '#1d4ed8' : '#047857',
                                                    color: 'white'
                                                }}
                                                title={`${roleContext ? roleContext.counterpartyRoleLabel : (isCustomer ? 'Provider' : 'Customer')}: ${otherDbPosition?.toFixed(1)}`}
                                            >
                                                {isCustomer ? 'P' : 'C'}
                                            </div>
                                        )}

                                        {/* Your position / Aligned marker - Aligned only shows if provider invited */}
                                        {hasProviderInvited && isAligned && myBarPercent !== null ? (
                                            <div
                                                className="absolute top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold z-20 shadow-lg"
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
                                                className="absolute top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold z-20 shadow-lg"
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

                                    {/* Fine-tune controls */}
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1">
                                            <input
                                                type="range"
                                                min="1"
                                                max="10"
                                                step="0.5"
                                                value={11 - (proposedPosition ?? myDbPosition ?? 5)}
                                                onChange={(e) => handlePositionDrag(11 - parseFloat(e.target.value))}
                                                className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer"
                                            />
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

                                    {/* Position Info */}
                                    <div className={`p-3 rounded-lg border-2 ${isProposing
                                        ? 'bg-amber-50 border-amber-300'
                                        : isAligned
                                            ? 'bg-emerald-50 border-emerald-300'
                                            : 'bg-slate-50 border-slate-200'
                                        }`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="text-xs text-slate-500">
                                                    {isAligned ? 'Aligned Position' : isProposing ? 'Proposed Position' : 'Your Position'}
                                                </span>
                                                <div className="font-medium text-slate-800">
                                                    {(proposedPosition ?? myDbPosition)?.toFixed(1)} / 10
                                                    {hasProviderInvited && isAligned && <span className="ml-2 text-emerald-600">✓ Aligned with {roleContext ? roleContext.counterpartyRoleLabel : (isCustomer ? 'Provider' : 'Customer')}</span>}
                                                </div>
                                            </div>
                                            {isProposing && (
                                                <span className="px-2 py-1 bg-amber-200 text-amber-800 text-xs font-medium rounded">
                                                    Unsaved
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Legend */}
                                    <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500 pt-2 border-t border-slate-200">
                                        <div className="flex items-center gap-1">
                                            <div className={`w-3 h-3 rounded-full ${isCustomer ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                                            <span>You</span>
                                        </div>
                                        {hasProviderInvited && (
                                            <div className="flex items-center gap-1">
                                                <div className={`w-3 h-3 rounded-full ${isCustomer ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                                                <span>{roleContext ? roleContext.counterpartyRoleLabel : (isCustomer ? 'Provider' : 'Customer')}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                            <span>Proposed</span>
                                        </div>
                                        {hasProviderInvited && (
                                            <div className="flex items-center gap-1">
                                                <div className="w-3 h-3 rounded-full overflow-hidden flex">
                                                    <div className="w-1/2 h-full bg-emerald-500"></div>
                                                    <div className="w-1/2 h-full bg-blue-500"></div>
                                                </div>
                                                <span>Aligned</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })()}
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

                {/* Action Buttons - CONDENSED (hidden when locked) */}
                {!isLocked && (
                    <div className="flex gap-2 mt-2">
                        <button
                            onClick={handleSetPosition}
                            disabled={!isProposing || isCommitting}
                            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 text-sm ${isProposing && !isCommitting
                                ? isTrainingMode
                                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
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
                )}

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
    // REVERSED ORIENTATION: Provider (Blue) on LEFT, Customer (Emerald) on RIGHT
    // With No-Provider State
    // ============================================================================

    const LeverageIndicator = () => {
        // Determine viewer's perspective
        const isCustomer = userInfo?.role === 'customer'

        // ========================================================================
        // CHECK IF PROVIDER IS INVITED/AVAILABLE
        // ========================================================================
        const hasProvider = session?.providerId !== null && session?.providerId !== undefined
        const hasProviderBids = availableProviders && availableProviders.length > 0
        const providerReady = hasProvider || hasProviderBids

        // ========================================================================
        // NO PROVIDER STATE - Show greyed out placeholder with invite button
        // ========================================================================
        if (!providerReady && !isTrainingMode) {
            return (
                <div className="bg-white rounded-xl border border-slate-200 p-3 mb-2 relative">
                    {/* Greyed out overlay */}
                    <div className="absolute inset-0 bg-slate-100/80 backdrop-blur-[1px] rounded-xl z-10 flex flex-col items-center justify-center">
                        <div className="text-center px-4">
                            <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <p className="text-sm font-medium text-slate-600 mb-1">Leverage Not Available</p>
                            <p className="text-xs text-slate-500 mb-3">Invite a provider to enable leverage calculations</p>
                            <button
                                onClick={() => {
                                    const sessionNum = session?.sessionNumber || ''
                                    router.push(`/auth/invite-providers?session_id=${session?.sessionId}&session_number=${sessionNum}`)
                                }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2 mx-auto"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                                Invite Provider
                            </button>
                        </div>
                    </div>

                    {/* Placeholder content (visible but greyed) */}
                    <div className="opacity-30 pointer-events-none">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-slate-700">Negotiation Metrics</h3>
                            </div>
                            <div className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-400">
                                --% Aligned
                            </div>
                        </div>

                        <div className="flex items-center gap-3 mb-2">
                            <div className="flex items-center gap-1.5 bg-slate-50 rounded px-2 py-1">
                                <span className="text-xs text-slate-500">◆ Baseline:</span>
                                <span className="text-sm font-bold text-slate-400">--:--</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-slate-50 rounded px-2 py-1">
                                <span className="text-xs text-slate-500">⬡ Tracker:</span>
                                <span className="text-sm font-bold text-slate-400">--:--</span>
                            </div>
                        </div>

                        <div className="h-3 bg-slate-200 rounded-full"></div>
                    </div>
                </div>
            )
        }

        // ========================================================================
        // NORMAL STATE - Full leverage display
        // REVERSED: Provider (Blue) on LEFT, Customer (Emerald) on RIGHT
        // ========================================================================

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
        // Use server-calculated alignment (matches Clarence AI) when available,
        // fall back to local calculation only when no leverage data exists
        const dynamicAlignmentPercentage = (leverage && displayLeverage.alignmentPercentage > 0)
            ? Math.round(displayLeverage.alignmentPercentage)
            : calculateAlignmentPercentage(clauses)

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
                {/* REVERSED: Provider (Blue) shown first (left), Customer (Emerald) shown second (right) */}
                <div className="flex items-center gap-3 mb-2">
                    {/* Baseline - REVERSED: Provider first, Customer second */}
                    <div className="flex items-center gap-1.5 bg-slate-50 rounded px-2 py-1">
                        <span className="text-xs text-slate-500">◆ Baseline:</span>
                        <span className="text-sm font-bold">
                            <span className="text-blue-600">{providerBaseline}</span>
                            <span className="text-slate-400">:</span>
                            <span className="text-emerald-600">{customerBaseline}</span>
                        </span>
                    </div>

                    {/* Tracker - REVERSED: Provider first, Customer second */}
                    <div className="flex items-center gap-1.5 bg-slate-50 rounded px-2 py-1">
                        <span className="text-xs text-slate-500">⬡ Tracker:</span>
                        <span className="text-sm font-bold">
                            <span className="text-blue-600">{providerTracker}</span>
                            <span className="text-slate-400">:</span>
                            <span className="text-emerald-600">{customerTracker}</span>
                        </span>
                        {(Math.abs(customerShift) > 0 || Math.abs(providerShift) > 0) && (
                            <span className="text-xs text-slate-400">
                                ({providerShift > 0 ? '+' : ''}{providerShift.toFixed(0)})
                            </span>
                        )}
                    </div>

                    {/* Company Labels - REVERSED: Provider first, Customer second */}
                    <div className="text-xs text-slate-400 ml-auto">
                        <span className="text-blue-600">{providerCompanyName}</span>
                        {' vs '}
                        <span className="text-emerald-600">{customerCompanyName}</span>
                    </div>
                </div>

                {/* Visual Leverage Bar - Compact */}
                {/* REVERSED: Provider (Blue) fills from LEFT, Customer (Emerald) fills from RIGHT */}
                <div className="relative">
                    {/* Split Bar */}
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative">
                        {/* Provider portion - Blue from left (REVERSED) */}
                        <div
                            className="absolute left-0 top-0 bottom-0 bg-blue-500 transition-all duration-500"
                            style={{ width: `${providerTracker}%` }}
                        />

                        {/* Customer portion - Emerald from right (REVERSED) */}
                        <div
                            className="absolute right-0 top-0 bottom-0 bg-emerald-500 transition-all duration-500"
                            style={{ width: `${customerTracker}%` }}
                        />

                        {/* Center line (50% mark) */}
                        <div
                            className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white z-30"
                            style={{ transform: 'translateX(-50%)', boxShadow: '0 0 2px rgba(0,0,0,0.3)' }}
                            title="50-50 neutral point"
                        ></div>

                        {/* Provider Baseline marker (REVERSED: now on left side) */}
                        <div
                            className="absolute top-0 bottom-0 w-1.5 bg-blue-950 z-20 rounded-sm"
                            style={{
                                left: `${providerBaseline}%`,
                                transform: 'translateX(-50%)',
                                boxShadow: '0 0 3px rgba(0,0,0,0.5)'
                            }}
                            title={`Provider Baseline: ${providerBaseline}%`}
                        />

                        {/* Customer Baseline marker (REVERSED: now on right side) */}
                        <div
                            className="absolute top-0 bottom-0 w-1.5 bg-emerald-950 z-20 rounded-sm"
                            style={{
                                left: `${100 - customerBaseline}%`,
                                transform: 'translateX(-50%)',
                                boxShadow: '0 0 3px rgba(0,0,0,0.5)'
                            }}
                            title={`Customer Baseline: ${customerBaseline}%`}
                        />
                    </div>

                    {/* Labels under bar - REVERSED - ROLE MATRIX dynamic */}
                    <div className="flex justify-between mt-1 text-xs text-slate-400">
                        <span>{roleContext ? `${roleContext.providingPartyLabel} Favoured` : 'Provider Favoured'}</span>
                        <span>{roleContext ? `${roleContext.protectedPartyLabel} Favoured` : 'Customer Favoured'}</span>
                    </div>
                </div>

                {/* Expandable Details Section */}
                {showLeverageDetails && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                        <div className="grid grid-cols-2 gap-3">
                            {/* Leverage Factor Breakdown */}
                            <div>
                                <h4 className="text-xs font-semibold text-slate-600 mb-2">Leverage Factors</h4>
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-500">Market Dynamics</span>
                                        <div className="flex items-center gap-1">
                                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500" style={{ width: `${marketDynamicsScore}%` }} />
                                            </div>
                                            <span className="text-xs font-medium text-slate-600">{marketDynamicsScore}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-500">Economic Factors</span>
                                        <div className="flex items-center gap-1">
                                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500" style={{ width: `${economicFactorsScore}%` }} />
                                            </div>
                                            <span className="text-xs font-medium text-slate-600">{economicFactorsScore}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-500">Strategic Position</span>
                                        <div className="flex items-center gap-1">
                                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500" style={{ width: `${strategicPositionScore}%` }} />
                                            </div>
                                            <span className="text-xs font-medium text-slate-600">{strategicPositionScore}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-500">BATNA Strength</span>
                                        <div className="flex items-center gap-1">
                                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500" style={{ width: `${batnaScore}%` }} />
                                            </div>
                                            <span className="text-xs font-medium text-slate-600">{batnaScore}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Stats */}
                            <div>
                                <h4 className="text-xs font-semibold text-slate-600 mb-2">Session Stats</h4>
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500">Total Clauses</span>
                                        <span className="font-medium text-slate-700">{clauses.length}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500">Aligned</span>
                                        <span className="font-medium text-emerald-600">{clauseStats.aligned}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500">Negotiating</span>
                                        <span className="font-medium text-amber-600">{clauseStats.negotiating}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500">Disputed</span>
                                        <span className="font-medium text-red-600">{clauseStats.disputed}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ============================================================================
    // SECTION 12: CLAUSE TREE ITEM COMPONENT (FOCUS-12 Updated)
    // ============================================================================

    const ClauseTreeItem = ({ clause, depth = 0 }: { clause: ContractClause, depth?: number }) => {
        // Skip N/A clauses in main tree (they show in separate section)
        if (clause.isApplicable === false) return null

        const hasChildren = clause.children && clause.children.filter(c => c.isApplicable !== false).length > 0
        const isSelected = selectedClause?.positionId === clause.positionId

        // Get the weight based on current user's role
        const clauseWeight = userInfo?.role === 'provider'
            ? clause.providerWeight
            : clause.customerWeight
        const weightDisplay = clauseWeight ? clauseWeight.toFixed(0) : null

        // Can add sub-clauses to level 1 clauses only
        const canAddSubClause = clause.clauseLevel === 1

        // Check for unseen moves on this clause
        const unseenCount = unseenMoves.get(clause.clauseId) || 0

        // Context menu state (local to this component instance)
        const [showContextMenu, setShowContextMenu] = useState(false)
        const contextMenuRef = useRef<HTMLDivElement>(null)

        // Close context menu when clicking outside
        useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                    setShowContextMenu(false)
                }
            }
            if (showContextMenu) {
                document.addEventListener('mousedown', handleClickOutside)
            }
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }, [showContextMenu])

        return (
            <div>
                <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition group relative ${isSelected
                        ? 'bg-emerald-50 border border-emerald-200'
                        : 'hover:bg-slate-50'
                        }`}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                    onClick={() => {
                        if (clause.clauseLevel === 0) {
                            handleClauseToggle(clause.positionId)
                        } else {
                            handleClauseSelect(clause)
                        }
                    }}
                    onContextMenu={(e) => {
                        if (clause.clauseLevel !== 0) {
                            e.preventDefault()
                            setShowContextMenu(true)
                        }
                    }}
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
                                fill="currentColor"
                                viewBox="0 0 20 20"
                            >
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                        </button>
                    ) : (
                        <span className="w-4" />
                    )}

                    {/* Status indicator */}
                    {clause.status === 'agreed' ? (
                        <div
                            className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"
                            title="Agreement Locked"
                        >
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    ) : (
                        <div
                            className={`w-2 h-2 rounded-full ${getStatusBgColor(clause.status)}`}
                            title={clause.status}
                        />
                    )}

                    <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-mono">{clause.clauseNumber}</span>
                        <span className={`text-sm truncate ${clause.clauseLevel === 0 ? 'font-semibold text-slate-700' :
                            isSelected ? 'text-emerald-700 font-medium' : 'text-slate-700'}`}>
                            {clause.clauseName}
                        </span>

                        {/* Custom clause badge */}
                        {clause.isCustomClause && (
                            <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
                                Custom
                            </span>
                        )}

                        {/* Sub-clause badge */}
                        {clause.clauseLevel === 2 && clause.addedMidSession && (
                            <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
                                Added
                            </span>
                        )}

                        {/* Straight to Contract - Configuration Status */}
                        {isStraightToContract && clause.clauseLevel !== 0 && clauseConfigProgress.status === 'configuring' && (
                            clause.customerPosition === null ? (
                                <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <span className="w-2 h-2 border border-amber-500 border-t-transparent rounded-full animate-spin"></span>
                                    Pending
                                </span>
                            ) : (
                                <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded">
                                    ✓ Ready
                                </span>
                            )
                        )}
                    </div>

                    {/* Unseen moves indicator */}
                    {unseenCount > 0 && (
                        <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                            {unseenCount > 9 ? '9+' : unseenCount}
                        </span>
                    )}

                    {/* Weight badge */}
                    {weightDisplay && clause.clauseLevel !== 0 && parseInt(weightDisplay) >= 3 && (
                        <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${clauseWeight && clauseWeight >= 4 ? 'bg-red-100 text-red-700' :
                                clauseWeight && clauseWeight >= 3 ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-600'
                                }`}
                            title={`Weight: ${weightDisplay}/5`}
                        >
                            W{weightDisplay}
                        </span>
                    )}

                    {/* More options button (three dots) - only for negotiable clauses */}
                    {clause.clauseLevel !== 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setShowContextMenu(!showContextMenu)
                            }}
                            className="w-6 h-6 rounded hover:bg-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="More options"
                        >
                            <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                        </button>
                    )}

                    {/* Add Sub-Clause button - only on level 1 clauses */}
                    {canAddSubClause && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleOpenAddSubClause(clause)
                            }}
                            className="w-5 h-5 rounded bg-slate-200 hover:bg-emerald-500 hover:text-white text-slate-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Add sub-clause"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    )}

                    {/* Context Menu */}
                    {showContextMenu && (
                        <div
                            ref={contextMenuRef}
                            className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => {
                                    handleOpenNaModal(clause)
                                    setShowContextMenu(false)
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                                Mark as N/A
                            </button>
                            {canAddSubClause && (
                                <button
                                    onClick={() => {
                                        handleOpenAddSubClause(clause)
                                        setShowContextMenu(false)
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Sub-Clause
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Children */}
                {hasChildren && clause.isExpanded && (
                    <div>
                        {clause.children!
                            .filter(c => c.isApplicable !== false)
                            .map(child => (
                                <ClauseTreeItem key={child.positionId} clause={child} depth={depth + 1} />
                            ))}
                    </div>
                )}
            </div>
        )
    }

    // ============================================================================
    // COMPLETE UPDATED SECTION 13: PartyStatusBanner WITH TRAINING MODE
    // Replace your entire existing PartyStatusBanner component with this
    // ============================================================================

    const PartyStatusBanner = () => {

        console.log('PartyStatusBanner - clauses.length:', clauses.length, 'isGeneratingPreview:', isGeneratingPreview)

        const isCustomer = userInfo.role === 'customer'
        const customerCompany = session.customerCompany
        const providerCompany = session.providerCompany

        // ========== TRAINING MODE STYLING HELPERS ==========
        const headerBg = isTrainingMode ? 'bg-amber-900' : 'bg-slate-800'
        const borderColor = isTrainingMode ? 'border-amber-700' : 'border-slate-700'
        const accentColor = isTrainingMode ? 'text-amber-400' : 'text-emerald-400'
        const buttonBg = isTrainingMode ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
        const logoBg = isTrainingMode ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
        const dotColor = isTrainingMode ? 'bg-amber-400' : 'bg-emerald-400'
        const youBadgeBg = isTrainingMode ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
        const previewButtonBg = isTrainingMode ? 'bg-amber-700 hover:bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'

        return (
            <div className={`${headerBg} text-white`}>
                {/* ============================================================ */}
                {/* ROW 1: Navigation Row */}
                {/* ============================================================ */}
                <div className={`px-6 py-2 border-b ${borderColor}`}>
                    <div className="flex items-center justify-between">
                        {/* Left: Home + CLARENCE Branding */}
                        <div className="flex items-center gap-3">
                            {/* Home Icon */}
                            {userInfo?.role !== 'provider' && (
                                <>
                                    <button
                                        onClick={() => router.push('/auth/contracts-dashboard')}
                                        className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                        </svg>
                                    </button>
                                    <div className="h-5 w-px bg-slate-600"></div>
                                </>
                            )}
                            {/* CLARENCE Branding */}
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 ${logoBg} rounded-lg flex items-center justify-center`}>
                                    <span className="text-white font-bold text-sm">C</span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-white tracking-wide">CLARENCE</span>
                                        <span className={`font-semibold ${isTrainingMode ? 'text-amber-400' : 'text-slate-300'}`}>
                                            {isTrainingMode ? 'Training' : 'Negotiate'}
                                        </span>
                                    </div>
                                    <span className="text-slate-500 text-xs">The Honest Broker</span>
                                </div>
                            </div>
                        </div>

                        {/* Right: Feedback + Preview Contract + Documents Centre Buttons */}
                        <div className="flex items-center gap-2">
                            {/* Feedback Button */}
                            <FeedbackButton position="header" />

                            {/* Preview Contract Button */}
                            <button
                                onClick={handlePreviewContract}
                                disabled={isGeneratingPreview || clauses.length === 0}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition ${isGeneratingPreview || clauses.length === 0
                                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                    : previewButtonBg + ' text-white'
                                    }`}
                            >
                                {isGeneratingPreview ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        <span>Preview Contract</span>
                                    </>
                                )}
                            </button>

                            {/* Documents Centre Button */}
                            <button
                                onClick={() => router.push(`/auth/document-centre?session_id=${session.sessionId}`)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 ${buttonBg} text-white text-sm font-medium rounded-lg transition`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Agree
                            </button>
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
                            <div className={`w-3 h-3 rounded-full ${isCustomer
                                ? `${dotColor} animate-pulse`
                                : (otherPartyStatus.isOnline ? dotColor : 'bg-slate-500')
                                }`}></div>
                            <div>
                                <div className="text-xs text-slate-400">Customer</div>
                                <div className={`text-sm font-medium ${accentColor}`}>{customerCompany}</div>
                                <div className="text-xs text-slate-500">
                                    {isCustomer
                                        ? `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || session.customerContactName || 'Contact'
                                        : session.customerContactName || 'Contact'
                                    }
                                </div>
                            </div>
                            {isCustomer && (
                                <span className={`text-xs ${youBadgeBg} px-2 py-0.5 rounded`}>
                                    You
                                </span>
                            )}
                        </div>

                        {/* Center: Session Details (truly centered) */}
                        <div className="flex items-center gap-6">
                            {/* Session Number */}
                            <div className="text-center">
                                <div className="text-xs text-slate-400">Session</div>
                                <div className="text-sm font-mono text-white">{session.sessionNumber}</div>
                            </div>

                            {/* Deal Value - Editable by Customer only */}
                            {isCustomer ? (
                                <button
                                    onClick={openDealContextEditor}
                                    className="text-center group hover:bg-slate-700/50 px-3 py-1 rounded transition"
                                    title="Click to edit deal context"
                                >
                                    <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
                                        Deal Value
                                        <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </div>
                                    <div className={`text-sm font-semibold ${accentColor}`}>
                                        {session.dealValue || 'Not set'}
                                    </div>
                                </button>
                            ) : (
                                <div className="text-center px-3 py-1">
                                    <div className="text-xs text-slate-400">Deal Value</div>
                                    <div className={`text-sm font-semibold ${accentColor}`}>
                                        {session.dealValue || 'Not set'}
                                    </div>
                                </div>
                            )}

                            {/* Provider Status Indicator */}
                            {!session.providerId && !isTrainingMode && (
                                <div className="text-center px-3 py-1 bg-amber-500/20 rounded-lg">
                                    <div className="text-xs text-amber-400">Provider</div>
                                    <div className="text-sm font-medium text-amber-300">Not Invited</div>
                                </div>
                            )}
                        </div>

                        {/* Right: Provider Info with Dropdown (customers) or Static (providers) + Party Chat */}
                        <div className="flex items-center gap-3 min-w-[280px] justify-end">
                            {!isCustomer && (
                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                                    You
                                </span>
                            )}

                            {/* TRAINING MODE: Show AI Opponent indicator */}
                            {isTrainingMode ? (
                                <div className="text-right">
                                    <div className="text-xs text-slate-400">AI Opponent</div>
                                    <div className="text-sm font-medium text-amber-400 flex items-center gap-1 justify-end">
                                        <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                                        {providerCompany}
                                    </div>
                                    <div className="text-xs text-slate-500">{session.providerContactName || 'AI Negotiator'}</div>
                                </div>
                            ) : isCustomer && !hasProviderInvited ? (
                                /* No provider invited yet - show invite prompt */
                                <div className="text-right">
                                    <div className="text-xs text-slate-400">Provider</div>
                                    <div className="text-sm font-medium text-slate-500">Awaiting Provider</div>
                                    <button
                                        onClick={() => router.push(`/auth/provider-invite?session_id=${session.sessionId}`)}
                                        className="mt-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
                                    >
                                        Invite Provider
                                    </button>
                                </div>
                            ) : isCustomer ? (
                                /* Customer sees provider dropdown */
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
                                                                if (provider.questionnaireComplete && provider.providerId) {
                                                                    switchProvider(provider.providerId, provider.providerCompany)
                                                                } else {
                                                                    alert(`${provider.providerCompany} has not completed their intake yet.`)
                                                                }
                                                            }}
                                                            className={`w-full px-3 py-2 text-left hover:bg-slate-700 transition flex items-center justify-between`}
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

                            {/* Online indicator and Party Chat - NOW VISIBLE in training mode with amber styling */}
                            {isTrainingMode ? (
                                <>
                                    {/* Training Mode: Amber indicator for AI opponent */}
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse"></div>
                                        <span className="text-xs text-amber-400">AI Active</span>
                                    </div>

                                    {/* Training Mode Chat Button - Amber themed */}
                                    <button
                                        onClick={() => setIsChatOpen(true)}
                                        className="relative ml-2 p-2 hover:bg-amber-900/30 rounded-lg transition group"
                                        title={`Chat with ${session.providerContactName || 'AI Opponent'}`}
                                    >
                                        <svg
                                            className="w-5 h-5 text-amber-400 group-hover:text-amber-300 transition"
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

                                        {/* Unread Badge - Amber for training */}
                                        {chatUnreadCount > 0 && (
                                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                                                {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                                            </span>
                                        )}
                                    </button>
                                </>
                            ) : (
                                <>
                                    {/* Live Mode: Original green indicator */}
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
                                </>
                            )}
                        </div>
                    </div>
                </div>
                {/* Deal Context Edit Modal */}
                {isEditingDealContext && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-200">
                                <h3 className="text-lg font-semibold text-slate-800">Edit Deal Context</h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    This information helps CLARENCE provide better guidance
                                </p>
                            </div>

                            {/* Body */}
                            <div className="px-6 py-4 space-y-4">
                                {/* Deal Value */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Deal Value
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {DEAL_VALUE_OPTIONS.map(option => (
                                            <button
                                                key={option.value}
                                                onClick={() => setEditedDealValue(option.value)}
                                                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${editedDealValue === option.value
                                                    ? 'bg-emerald-600 text-white'
                                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                    }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Service Criticality */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Service Criticality
                                    </label>
                                    <div className="space-y-2">
                                        {SERVICE_CRITICALITY_OPTIONS.map(option => (
                                            <button
                                                key={option.value}
                                                onClick={() => setEditedServiceCriticality(option.value)}
                                                className={`w-full px-4 py-3 rounded-lg text-left transition ${editedServiceCriticality === option.value
                                                    ? 'bg-emerald-50 border-2 border-emerald-500'
                                                    : 'bg-slate-50 border-2 border-transparent hover:border-slate-200'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className={`font-medium ${editedServiceCriticality === option.value
                                                        ? 'text-emerald-700'
                                                        : 'text-slate-700'
                                                        }`}>
                                                        {option.label}
                                                    </span>
                                                    {editedServiceCriticality === option.value && (
                                                        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5">{option.description}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Info Box */}
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <p className="text-sm text-blue-800">
                                        <strong>💡 Why this matters:</strong> Deal value and service criticality help
                                        CLARENCE calibrate its range suggestions and negotiation guidance.
                                    </p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsEditingDealContext(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                    disabled={isSavingDealContext}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveDealContext}
                                    disabled={isSavingDealContext || !editedDealValue}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isSavingDealContext ? (
                                        <>
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Saving...
                                        </>
                                    ) : (
                                        'Save Changes'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ============================================================================
    // SECTION 13Y: CLAUSE CONFIRMATION PANEL
    // ============================================================================

    const ClauseConfirmationPanel = () => {
        if (!selectedClause || !userInfo) return null

        const isCustomer = userInfo.role === 'customer'
        const myPosition = isCustomer ? selectedClause.customerPosition : selectedClause.providerPosition
        const otherPosition = isCustomer ? selectedClause.providerPosition : selectedClause.customerPosition
        const otherPartyName = isCustomer ? session.providerCompany : session.customerCompany

        const iHaveConfirmed = isCustomer ? selectedClause.isCustomerConfirmed : selectedClause.isProviderConfirmed
        const otherHasConfirmed = isCustomer ? selectedClause.isProviderConfirmed : selectedClause.isCustomerConfirmed
        const isFullyAgreed = selectedClause.isAgreed

        const myConfirmedAt = isCustomer ? selectedClause.customerConfirmedAt : selectedClause.providerConfirmedAt
        const myConfirmedPosition = isCustomer ? selectedClause.customerConfirmedPosition : selectedClause.providerConfirmedPosition

        // Calculate if positions are close enough to confirm (gap < 1)
        const gap = myPosition !== null && otherPosition !== null
            ? Math.abs(myPosition - otherPosition)
            : 999
        const canConfirm = gap < 1 && !iHaveConfirmed && !isFullyAgreed

        // Don't show for category headers
        if (selectedClause.clauseLevel === 0) return null

        // Fully Agreed State - LOCKED
        if (isFullyAgreed) {
            return (
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-emerald-800">🎓 Agreement Locked</h4>
                            <p className="text-sm text-emerald-600">
                                Both parties confirmed position {selectedClause.finalAgreedPosition?.toFixed(1)} — Ready for drafting
                            </p>
                            <p className="text-xs text-emerald-500 mt-1">
                                Agreed on {selectedClause.agreementReachedAt
                                    ? new Date(selectedClause.agreementReachedAt).toLocaleString()
                                    : 'Unknown'}
                            </p>
                        </div>
                    </div>
                </div>
            )
        }

        // I have confirmed, waiting for other party
        if (iHaveConfirmed && !otherHasConfirmed) {
            return (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-amber-800">⏳ Awaiting {otherPartyName}</h4>
                            <p className="text-sm text-amber-600">
                                You confirmed position {myConfirmedPosition?.toFixed(1)}. Waiting for the other party to confirm.
                            </p>
                            <p className="text-xs text-amber-500 mt-1">
                                Confirmed on {myConfirmedAt
                                    ? new Date(myConfirmedAt).toLocaleString()
                                    : 'Unknown'}
                            </p>
                        </div>
                        <div className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Confirmed
                        </div>
                    </div>
                </div>
            )
        }

        // Other party confirmed, waiting for me
        if (!iHaveConfirmed && otherHasConfirmed) {
            const otherConfirmedPosition = isCustomer
                ? selectedClause.providerConfirmedPosition
                : selectedClause.customerConfirmedPosition
            const otherConfirmedAt = isCustomer
                ? selectedClause.providerConfirmedAt
                : selectedClause.customerConfirmedAt

            return (
                <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-blue-800">📩 {otherPartyName} Has Confirmed</h4>
                            <p className="text-sm text-blue-600">
                                They confirmed position {otherConfirmedPosition?.toFixed(1)} on {otherConfirmedAt
                                    ? new Date(otherConfirmedAt).toLocaleString()
                                    : 'Unknown'}
                            </p>
                            <p className="text-xs text-blue-500 mt-1">
                                Your confirmation will lock this clause for drafting.
                            </p>
                        </div>
                        <button
                            onClick={handleConfirmAgreement}
                            disabled={isConfirming || gap >= 1}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isConfirming ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Confirming...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Confirm Agreement
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )
        }

        // Both not confirmed, but positions are aligned - can confirm
        if (canConfirm) {
            return (
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-emerald-800">✓ Positions Aligned</h4>
                            <p className="text-sm text-emerald-600">
                                Both parties are at position {myPosition?.toFixed(1)}. Ready to confirm agreement.
                            </p>
                        </div>
                        <button
                            onClick={handleConfirmAgreement}
                            disabled={isConfirming}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isConfirming ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Confirming...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Confirm Agreement
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )
        }

        // Positions not aligned - no confirmation UI
        return null
    }

    // ============================================================================
    // SECTION 14: MAIN LAYOUT RENDER
    // ============================================================================

    // ============================================================================
    // SECTION 14A:  SUB-CLAUSE MODAL
    // ============================================================================

    const AddSubClauseModal = () => {
        if (!showAddSubClauseModal || !subClauseParent) return null

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-800">Add Sub-Clause</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Adding under: <span className="font-medium">{subClauseParent.clauseNumber} {subClauseParent.clauseName}</span>
                        </p>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Sub-Clause Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={newSubClauseName}
                                onChange={(e) => setNewSubClauseName(e.target.value)}
                                placeholder="e.g., Data Breach Notification Timeline"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Description <span className="text-slate-400">(optional)</span>
                            </label>
                            <textarea
                                value={newSubClauseDescription}
                                onChange={(e) => setNewSubClauseDescription(e.target.value)}
                                placeholder="Brief description of what this sub-clause covers..."
                                rows={2}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Why are you adding this? <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={newSubClauseReason}
                                onChange={(e) => setNewSubClauseReason(e.target.value)}
                                placeholder="e.g., We need specific timelines for GDPR compliance - the parent clause is too vague on notification windows..."
                                rows={3}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                This helps CLARENCE understand your intent and mediate effectively.
                            </p>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-sm text-amber-800">
                                <strong>Note:</strong> This sub-clause will be visible to both parties.
                                Your reason for adding it will help CLARENCE provide balanced mediation.
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                        <button
                            onClick={() => {
                                setShowAddSubClauseModal(false)
                                setSubClauseParent(null)
                                setNewSubClauseName('')
                                setNewSubClauseDescription('')
                                setNewSubClauseReason('')
                            }}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                            disabled={isAddingSubClause}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddSubClause}
                            disabled={!newSubClauseName.trim() || !newSubClauseReason.trim() || isAddingSubClause}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isAddingSubClause ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Adding...
                                </>
                            ) : (
                                'Add Sub-Clause'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ============================================================================
    // SECTION 14B: ADD CLAUSE MODAL (FOCUS-12)
    // ============================================================================

    const AddClauseModal = () => {
        if (!showAddClauseModal) return null

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
                        <h3 className="text-lg font-semibold text-slate-800">Add New Clause</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Add a custom clause to this negotiation
                        </p>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Clause Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={newClauseName}
                                onChange={(e) => setNewClauseName(e.target.value)}
                                placeholder="e.g., Anti-Bribery Compliance"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Category <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={newClauseCategory}
                                onChange={(e) => setNewClauseCategory(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            >
                                <option value="">Select a category...</option>
                                {CLAUSE_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Description <span className="text-slate-400">(optional)</span>
                            </label>
                            <textarea
                                value={newClauseDescription}
                                onChange={(e) => setNewClauseDescription(e.target.value)}
                                placeholder="Brief description of what this clause covers..."
                                rows={2}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Why are you adding this? <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={newClauseReason}
                                onChange={(e) => setNewClauseReason(e.target.value)}
                                placeholder="e.g., Required for regulatory compliance in our industry..."
                                rows={3}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                This helps CLARENCE understand your intent and mediate effectively.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Your Initial Position
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    step="1"
                                    value={newClausePosition}
                                    onChange={(e) => setNewClausePosition(parseInt(e.target.value))}
                                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="w-12 text-center font-semibold text-emerald-600">
                                    {newClausePosition}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-400 mt-1">
                                <span>{roleContext ? `${roleContext.providingPartyLabel}-Favourable` : 'Provider-Favourable'}</span>
                                <span>{roleContext ? `${roleContext.protectedPartyLabel}-Favourable` : 'Customer-Favourable'}</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Proposed Language <span className="text-slate-400">(optional)</span>
                            </label>
                            <textarea
                                value={newClauseProposedLanguage}
                                onChange={(e) => setNewClauseProposedLanguage(e.target.value)}
                                placeholder="Draft the clause language you'd like to propose..."
                                rows={4}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none font-mono text-sm"
                            />
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-sm text-amber-800">
                                <strong>Note:</strong> This clause will be visible to both parties.
                                The other party will be notified and can negotiate positions on this clause.
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 bg-white">
                        <button
                            onClick={() => {
                                setShowAddClauseModal(false)
                                setNewClauseName('')
                                setNewClauseCategory('')
                                setNewClauseDescription('')
                                setNewClauseReason('')
                                setNewClausePosition(5)
                                setNewClauseProposedLanguage('')
                            }}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                            disabled={isAddingClause}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddClause}
                            disabled={!newClauseName.trim() || !newClauseCategory || !newClauseReason.trim() || isAddingClause}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isAddingClause ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Clause
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ============================================================================
    // SECTION 14C: MARK AS N/A MODAL (FOCUS-12)
    // ============================================================================

    const MarkAsNaModal = () => {
        if (!showNaModal || !naTargetClause) return null

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-800">Mark as Not Applicable</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Marking: <span className="font-medium">{naTargetClause.clauseNumber} {naTargetClause.clauseName}</span>
                        </p>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Reason <span className="text-slate-400">(optional)</span>
                            </label>
                            <textarea
                                value={naReason}
                                onChange={(e) => setNaReason(e.target.value)}
                                placeholder="e.g., This clause is not relevant to our service type..."
                                rows={3}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                                autoFocus
                            />
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-sm text-blue-800">
                                <strong>What happens:</strong> This clause will be moved to a separate "N/A" section.
                                It won't be included in the final contract. The other party can see that you marked it as N/A.
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                        <button
                            onClick={() => {
                                setShowNaModal(false)
                                setNaTargetClause(null)
                                setNaReason('')
                            }}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                            disabled={isMarkingNa}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleMarkAsNa}
                            disabled={isMarkingNa}
                            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isMarkingNa ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Marking...
                                </>
                            ) : (
                                'Mark as N/A'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )
    }


    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Training Mode Banner - shows only in training mode */}
            {isTrainingMode && (
                <TrainingModeBanner
                    scenarioName={trainingAvatarInfo?.scenarioName}
                    aiPersonality={trainingAvatarInfo?.aiPersonality}
                    onExitTraining={() => router.push('/auth/training')}
                />
            )}
            <PartyStatusBanner />

            {/* Party Chat Slide-Out Panel - Rendered at main component level to prevent remounting */}
            {session && userInfo && (
                <PartyChatPanel
                    sessionId={session.sessionId}
                    providerId=""
                    providerName={userInfo.role === 'customer' ? session.providerCompany : session.customerCompany}
                    currentUserType={userInfo.role === 'customer' ? 'customer' : 'provider'}
                    currentUserName={userInfo.firstName || 'User'}
                    isProviderOnline={otherPartyStatus.isOnline}
                    isOpen={isChatOpen}
                    onClose={() => setIsChatOpen(false)}
                    onUnreadCountChange={setChatUnreadCount}
                    // Training Mode AI Props
                    isAIOpponent={isTrainingMode}
                    aiPersonality={trainingAvatarInfo?.aiPersonality}
                    avatarName={trainingAvatarInfo?.characterName}
                    avatarInitials={trainingAvatarInfo?.avatarInitials}
                    avatarCompany={trainingAvatarInfo?.companyName}
                    // NEW: Inject messages from AI counter-moves into Party Chat
                    externalMessages={pendingPartyChatMessages}
                    onExternalMessagesConsumed={() => setPendingPartyChatMessages([])}
                />
            )}

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
                    {/* Panel Header */}
                    <div className="flex-shrink-0 p-4 border-b border-slate-200">
                        {/* Title Row */}
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-semibold text-slate-800">Contract Clauses</h2>
                            <button
                                onClick={handleOpenAddClause}
                                className="flex items-center gap-1 px-2 py-1 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                title="Add new clause"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add
                            </button>
                        </div>

                        {/* Template & Clause Builder Row - REDESIGNED FOR BETTER VISIBILITY */}
                        <div className="mb-3 py-2 px-3 bg-slate-50 rounded-lg border border-slate-200">
                            {/* Row 1: Template Name - Full Width */}
                            <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs text-slate-500">Template</div>
                                    <div className="text-sm font-medium text-slate-700">
                                        {session?.templateName || 'Not selected'}
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Clause Count + Clause Builder Link */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                                {session?.clauseCount && session.clauseCount > 0 ? (
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                                        {session.clauseCount} clauses selected
                                    </span>
                                ) : (
                                    <span className="text-xs text-slate-400">No clauses configured</span>
                                )}
                            </div>
                        </div>

                        {/* Stats Grid */}
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

                    {/* Clause Tree */}
                    <div className="flex-1 overflow-y-auto p-2">
                        {/* Main clause tree */}
                        {clauseTree.map(clause => (
                            <ClauseTreeItem key={clause.positionId} clause={clause} />
                        ))}

                        {/* N/A Clauses Section */}
                        {getNaClauses().length > 0 && (
                            <div className="mt-4 border-t border-slate-200 pt-4">
                                <button
                                    onClick={() => setShowNaClauses(!showNaClauses)}
                                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 rounded-lg"
                                >
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                        </svg>
                                        <span>Not Applicable ({getNaClauses().length})</span>
                                    </div>
                                    <svg
                                        className={`w-4 h-4 transition-transform ${showNaClauses ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {showNaClauses && (
                                    <div className="mt-2 space-y-1">
                                        {getNaClauses().map(clause => (
                                            <div
                                                key={clause.positionId}
                                                className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-slate-400"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-xs font-mono">{clause.clauseNumber}</span>
                                                    <span className="text-sm truncate line-through">{clause.clauseName}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleRestoreFromNa(clause)}
                                                    className="text-xs text-emerald-600 hover:text-emerald-700 whitespace-nowrap"
                                                    title="Restore this clause"
                                                >
                                                    Restore
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
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
                                            selectedClause.status === 'agreed' ? 'bg-emerald-100 text-emerald-700' :
                                                selectedClause.status === 'customer_confirmed' ? 'bg-amber-100 text-amber-700' :
                                                    selectedClause.status === 'provider_confirmed' ? 'bg-amber-100 text-amber-700' :
                                                        selectedClause.status === 'negotiating' ? 'bg-amber-100 text-amber-700' :
                                                            selectedClause.status === 'disputed' ? 'bg-red-100 text-red-700' :
                                                                'bg-slate-100 text-slate-700'
                                            }`}>
                                            {selectedClause.status === 'agreed' ? '🔒 Agreed' :
                                                selectedClause.status === 'customer_confirmed' ? '⏳ Awaiting Provider' :
                                                    selectedClause.status === 'provider_confirmed' ? '⏳ Awaiting Customer' :
                                                        selectedClause.status === 'aligned' ? '✓ Aligned' :
                                                            selectedClause.status}
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

                        {/* Straight to Contract Progress Panel */}
                        <StraightToContractProgressPanel />

                        {/* ==================== POSITIONS TAB ==================== */}
                        {activeTab === 'positions' && selectedClause && (
                            <div
                                ref={positionPanelRef}
                                className="flex-1 overflow-y-auto p-3 bg-white mx-4 mb-2 rounded-b-xl border border-t-0 border-slate-200"
                            >
                                {/* Clause Confirmation Panel */}
                                <ClauseConfirmationPanel />

                                {/* Position Adjustment Panel */}
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
                            <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-4">
                                <div className="space-y-3">
                                    {/* Header */}
                                    <div>
                                        <h3 className="text-base font-semibold text-slate-800">Trade-Off Opportunities</h3>
                                        <p className="text-xs text-slate-500">
                                            Exchange concessions on low-priority clauses for gains on high-priority ones
                                        </p>
                                    </div>

                                    {/* Scope Toggle + Refresh */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex bg-slate-100 rounded-lg p-0.5">
                                            <button
                                                onClick={() => {
                                                    setTradeOffScope('thisClause')
                                                    const opportunities = detectTradeOffOpportunities(clauses, selectedClause)
                                                    setTradeOffOpportunities(opportunities)
                                                    setSelectedTradeOff(null)
                                                    setTradeOffExplanation(null)
                                                }}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${tradeOffScope === 'thisClause'
                                                    ? 'bg-white text-slate-800 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                            >
                                                This Clause
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setTradeOffScope('allClauses')
                                                    const opportunities = detectTradeOffOpportunities(clauses, null)
                                                    setTradeOffOpportunities(opportunities)
                                                    setSelectedTradeOff(null)
                                                    setTradeOffExplanation(null)
                                                }}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${tradeOffScope === 'allClauses'
                                                    ? 'bg-white text-slate-800 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                            >
                                                All Clauses
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const opportunities = detectTradeOffOpportunities(
                                                    clauses,
                                                    tradeOffScope === 'thisClause' ? selectedClause : null
                                                )
                                                setTradeOffOpportunities(opportunities)
                                                setSelectedTradeOff(null)
                                                setTradeOffExplanation(null)
                                            }}
                                            className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition flex items-center gap-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Refresh
                                        </button>
                                    </div>

                                    {/* Results Summary */}
                                    <div className="text-xs text-slate-500 border-b border-slate-100 pb-2">
                                        {tradeOffOpportunities.length > 0 ? (
                                            <>
                                                Showing <span className="font-medium text-slate-700">{tradeOffOpportunities.length}</span> trade-off{tradeOffOpportunities.length !== 1 ? 's' : ''}{' '}
                                                {tradeOffScope === 'thisClause' ? (
                                                    <>involving <span className="font-medium text-emerald-600">{selectedClause.clauseName}</span></>
                                                ) : (
                                                    <>across <span className="font-medium text-slate-700">all clauses</span></>
                                                )}
                                            </>
                                        ) : (
                                            <>No trade-offs found {tradeOffScope === 'thisClause' ? `for ${selectedClause.clauseName}` : 'across all clauses'}</>
                                        )}
                                    </div>

                                    {/* Trade-off List */}
                                    {tradeOffOpportunities.length === 0 ? (
                                        <div className="text-center py-6">
                                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                                <span className="text-xl">⇄</span>
                                            </div>
                                            <p className="text-slate-600 text-sm mb-1">No trade-off opportunities detected</p>
                                            <p className="text-xs text-slate-400">
                                                Trade-offs appear when parties have complementary priorities on different clauses
                                            </p>
                                            {tradeOffScope === 'thisClause' && (
                                                <button
                                                    onClick={() => {
                                                        setTradeOffScope('allClauses')
                                                        const opportunities = detectTradeOffOpportunities(clauses, null)
                                                        setTradeOffOpportunities(opportunities)
                                                    }}
                                                    className="mt-3 px-3 py-1.5 text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition"
                                                >
                                                    Try Scanning All Clauses
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {tradeOffOpportunities.map((tradeOff) => (
                                                <div
                                                    key={tradeOff.id}
                                                    className={`border rounded-lg p-3 cursor-pointer transition ${selectedTradeOff?.id === tradeOff.id
                                                        ? 'border-emerald-300 bg-emerald-50'
                                                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                        }`}
                                                    onClick={() => {
                                                        if (selectedTradeOff?.id === tradeOff.id) {
                                                            setSelectedTradeOff(null)
                                                            setTradeOffExplanation(null)
                                                        } else {
                                                            explainTradeOff(tradeOff)
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            {/* Trade pair */}
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                                                    {tradeOff.clauseA.clauseNumber}
                                                                </span>
                                                                <span className="text-slate-400">⇄</span>
                                                                <span className="text-xs font-medium text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                                                                    {tradeOff.clauseB.clauseNumber}
                                                                </span>
                                                            </div>

                                                            {/* Clause names */}
                                                            <div className="text-sm text-slate-700">
                                                                <span className="font-medium">{tradeOff.clauseA.clauseName}</span>
                                                                <span className="text-slate-400 mx-1">↔</span>
                                                                <span className="font-medium">{tradeOff.clauseB.clauseName}</span>
                                                            </div>

                                                            {/* Gap info */}
                                                            <div className="flex gap-3 mt-1 text-xs text-slate-500">
                                                                <span>Gap A: {tradeOff.clauseA.gapSize.toFixed(1)}</span>
                                                                <span>Gap B: {tradeOff.clauseB.gapSize.toFixed(1)}</span>
                                                                <span>Value: {tradeOff.tradeOffValue.toFixed(1)}</span>
                                                            </div>
                                                        </div>

                                                        <div className="text-right ml-2">
                                                            <div className="text-xs text-slate-500">Impact</div>
                                                            <div className="text-sm font-bold text-emerald-600">
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
                                        <div className="mt-3 border-t border-slate-200 pt-3">
                                            <h4 className="text-xs font-semibold text-slate-700 mb-2">
                                                CLARENCE Analysis
                                            </h4>
                                            {isLoadingTradeOff ? (
                                                <div className="flex items-center gap-2 text-slate-500">
                                                    <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-xs">Analyzing trade-off...</span>
                                                </div>
                                            ) : tradeOffExplanation ? (
                                                <div className="bg-slate-50 rounded-lg p-3">
                                                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{tradeOffExplanation}</p>
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
                                            {(['all', 'positions', 'locks', 'agreements'] as const).map(filter => (
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
                                                    if (historyFilter === 'locks') return entry.eventType === 'clause_locked' || entry.eventType === 'clause_unlocked'
                                                    if (historyFilter === 'agreements') return entry.eventType === 'agreement'
                                                    return true
                                                })
                                                .slice(0, 20)
                                                .map((entry) => {
                                                    // Determine if this is a lock event
                                                    const isLockEvent = entry.eventType === 'clause_locked' || entry.eventType === 'clause_unlocked'
                                                    const isLocked = entry.eventType === 'clause_locked'

                                                    return (
                                                        <div key={entry.id} className="relative pl-10">
                                                            {/* Timeline dot */}
                                                            <div className={`absolute left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${entry.eventType === 'agreement'
                                                                ? 'border-emerald-400 bg-emerald-100 text-emerald-600'
                                                                : isLockEvent
                                                                    ? 'border-slate-500 bg-slate-600 text-white'
                                                                    : entry.party === 'customer'
                                                                        ? 'border-emerald-400 bg-white text-emerald-600'
                                                                        : entry.party === 'provider'
                                                                            ? 'border-blue-400 bg-white text-blue-600'
                                                                            : 'border-slate-400 bg-slate-100 text-slate-600'
                                                                }`}>
                                                                {entry.eventType === 'position_change' ? '↔' :
                                                                    entry.eventType === 'agreement' ? '✓' :
                                                                        entry.eventType === 'clause_locked' ? '🔒' :
                                                                            entry.eventType === 'clause_unlocked' ? '🔓' :
                                                                                entry.eventType === 'session_started' ? '🚀' : '•'}
                                                            </div>

                                                            {/* Entry content */}
                                                            <div className={`border rounded-lg p-3 ${entry.eventType === 'agreement' ? 'border-emerald-400 bg-emerald-50' :
                                                                isLockEvent ? 'border-slate-400 bg-slate-50' :
                                                                    entry.eventType === 'session_started' ? 'border-slate-400 bg-slate-50' :
                                                                        entry.party === 'customer' ? 'border-emerald-300 bg-white' :
                                                                            entry.party === 'provider' ? 'border-blue-300 bg-white' :
                                                                                'border-slate-300 bg-white'
                                                                }`}>
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className={`text-xs font-medium ${isLockEvent ? 'text-slate-600' :
                                                                        entry.party === 'customer' ? 'text-emerald-600' :
                                                                            entry.party === 'provider' ? 'text-blue-600' :
                                                                                'text-slate-600'
                                                                        }`}>
                                                                        {entry.partyName}
                                                                    </span>
                                                                    <span className="text-xs text-slate-400">
                                                                        {formatHistoryTimestamp(entry.timestamp)}
                                                                    </span>
                                                                </div>

                                                                <p className="text-sm text-slate-700">
                                                                    {isLockEvent
                                                                        ? isLocked
                                                                            ? 'Locked this clause as non-negotiable'
                                                                            : 'Unlocked this clause for negotiation'
                                                                        : entry.description
                                                                    }
                                                                </p>

                                                                {/* Lock badge */}
                                                                {isLockEvent && (
                                                                    <div className="flex items-center gap-2 mt-2">
                                                                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${isLocked
                                                                            ? 'bg-slate-200 text-slate-700'
                                                                            : 'bg-emerald-100 text-emerald-700'
                                                                            }`}>
                                                                            {isLocked ? '🔒 Locked' : '🔓 Unlocked'}
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {entry.oldValue !== undefined && entry.newValue !== undefined && !isLockEvent && (
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

                                                                {entry.clauseName && entry.eventType !== 'position_change' && !isLockEvent && (
                                                                    <div className="mt-1">
                                                                        <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                                                                            {entry.clauseName}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })}

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
                                        <div className={`grid ${hasProviderInvited ? 'grid-cols-3' : 'grid-cols-2'} gap-4 text-center`}>
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
                                            {hasProviderInvited && (
                                                <div>
                                                    <div className="text-xs text-slate-500 mb-1">Provider Position</div>
                                                    <div className="text-lg font-bold text-blue-600">
                                                        {selectedClause.providerPosition ?? '-'}
                                                    </div>
                                                </div>
                                            )}
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
                                            '⚠️ Generate Balanced Draft'
                                        )}
                                    </button>
                                </div>

                                {/* Draft Output */}
                                {draftLanguage && lastDraftedClauseId === selectedClause.clauseId && (
                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                                            <span className="text-sm font-medium text-slate-700">
                                                ⚠️ Balanced Draft Language
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
                                            <span className="text-amber-500">⚠ï¸</span>
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
                            <div className={`w-10 h-10 ${isTrainingMode ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'} rounded-full flex items-center justify-center`}>
                                <span className="text-white font-bold">C</span>
                            </div>
                            <div className="flex-1">
                                <div className="font-semibold text-slate-800">CLARENCE</div>
                                <div className="text-xs text-slate-500">
                                    {isTrainingMode
                                        ? (selectedClause
                                            ? `Training: ${selectedClause.clauseNumber} ${selectedClause.clauseName}`
                                            : 'Training Session - AI Opponent')
                                        : (selectedClause
                                            ? `Discussing: ${selectedClause.clauseNumber} ${selectedClause.clauseName}`
                                            : 'General Discussion')
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
            {/* Add Sub-Clause Modal */}
            <AddSubClauseModal />
            {/* FOCUS-12: Add Clause Modal */}
            <AddClauseModal />
            {/* FOCUS-12: Mark as N/A Modal */}
            <MarkAsNaModal />

            {/* AI Opponent Thinking Indicator - Training Mode - ENHANCED VERSION */}
            {aiThinking && isTrainingMode && (
                <>
                    {/* Semi-transparent overlay to draw attention */}
                    <div className="fixed inset-0 bg-amber-900/10 z-30 pointer-events-none" />

                    {/* Main thinking indicator - larger and more prominent */}
                    <div className="fixed bottom-6 right-6 z-50">
                        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-pulse">
                            {/* Animated avatar */}
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>

                            {/* Text content */}
                            <div>
                                <div className="font-semibold text-lg">
                                    {session?.providerContactName || 'AI Opponent'}
                                </div>
                                <div className="flex items-center gap-2 text-white/90">
                                    <span className="text-sm">is considering your move</span>
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>

                            {/* Training badge */}
                            <div className="ml-2 px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
                                🎓 Training
                            </div>
                        </div>
                    </div>

                    {/* Optional: Top notification bar */}
                    <div className="fixed top-0 left-0 right-0 z-50">
                        <div className="bg-amber-500 text-white text-center py-2 text-sm font-medium shadow-lg">
                            ⏳ Waiting for {session?.providerContactName || 'AI Opponent'} to respond...
                        </div>
                    </div>
                </>
            )}

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
    userInfo: UserInfo | null
    handleSignOut: () => Promise<void>
}

function PendingProviderView({
    session,
    sessionStatus,
    providerEmail,
    setProviderEmail,
    inviteSending,
    inviteSent,
    handleSendInvite,
    router,
    userInfo,
    handleSignOut
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
                        onClick={() => userInfo?.role === 'provider' ? handleSignOut() : router.push('/auth/contracts-dashboard')}
                        className="mt-6 px-6 py-2 text-slate-600 hover:text-slate-800 transition cursor-pointer"
                    >
                        {userInfo?.role === 'provider' ? '← Sign Out' : '← Return to Dashboard'}
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
                                onClick={() => userInfo?.role === 'provider' ? handleSignOut() : router.push('/auth/contracts-dashboard')}
                                className="text-slate-400 hover:text-white transition"
                            >
                                {userInfo?.role === 'provider' ? '← Sign Out' : '← Back to Dashboard'}
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